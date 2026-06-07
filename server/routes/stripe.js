/**
 * Stripe subscription routes.
 *
 * POST /api/stripe/checkout  — create a Stripe Checkout session (requires auth)
 * POST /api/stripe/webhook   — Stripe webhook handler (raw body, no auth)
 * GET  /api/stripe/portal    — create a Stripe Customer Portal session (requires auth)
 * GET  /api/stripe/status    — return current subscription status for the signed-in user
 */

const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { clerkClient } = require('@clerk/express');
const { requireAuth, getUser } = require('../lib/auth');

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

const CLIENT_URL = process.env.CLIENT_URL || 'https://taiwan-tracker-production-1118.up.railway.app';

// ---------------------------------------------------------------------------
// POST /api/stripe/checkout
// Creates a Stripe Checkout session and returns the URL.
// ---------------------------------------------------------------------------
router.post('/checkout', requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });

  const userId = getUser(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  if (!process.env.STRIPE_PRICE_ID) {
    return res.status(503).json({ error: 'STRIPE_PRICE_ID not configured' });
  }

  try {
    // Get the user's email from Clerk to pre-fill Stripe checkout
    const user = await clerkClient.users.getUser(userId);
    const email = user.emailAddresses?.[0]?.emailAddress;

    // Check if user already has a Stripe customer ID
    const existingCustomerId = user.publicMetadata?.stripeCustomerId;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      ...(existingCustomerId
        ? { customer: existingCustomerId }
        : { customer_email: email }),
      success_url: `${CLIENT_URL}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_URL}/upgrade`,
      metadata: { clerkUserId: userId },
      subscription_data: { metadata: { clerkUserId: userId } },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[stripe] checkout error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/stripe/webhook
// Handles Stripe events — updates Clerk user metadata on subscription changes.
// NOTE: this route uses express.raw() middleware (set in index.js) to preserve
// the raw body needed for Stripe's webhook signature verification.
// ---------------------------------------------------------------------------
router.post('/webhook', async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).send('Stripe not configured');

  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET not set');
    return res.status(500).send('Webhook secret not configured');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('[stripe/webhook] signature verification failed:', err.message);
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const clerkUserId = session.metadata?.clerkUserId;
        if (!clerkUserId) break;

        const subscription = await stripe.subscriptions.retrieve(session.subscription);

        await clerkClient.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            subscriptionStatus: subscription.status,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
          },
        });
        console.log(`[stripe/webhook] checkout complete — user ${clerkUserId} subscribed`);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const clerkUserId = sub.metadata?.clerkUserId;
        if (!clerkUserId) break;

        await clerkClient.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            subscriptionStatus: sub.status,
          },
        });
        console.log(`[stripe/webhook] subscription updated — user ${clerkUserId}, status: ${sub.status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const clerkUserId = sub.metadata?.clerkUserId;
        if (!clerkUserId) break;

        await clerkClient.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            subscriptionStatus: 'cancelled',
          },
        });
        console.log(`[stripe/webhook] subscription cancelled — user ${clerkUserId}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const sub = await stripe.subscriptions.retrieve(invoice.subscription);
        const clerkUserId = sub.metadata?.clerkUserId;
        if (!clerkUserId) break;

        await clerkClient.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            subscriptionStatus: 'past_due',
          },
        });
        console.log(`[stripe/webhook] payment failed — user ${clerkUserId}`);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('[stripe/webhook] handler error:', err.message);
  }

  res.json({ received: true });
});

// ---------------------------------------------------------------------------
// GET /api/stripe/portal
// Creates a Stripe Customer Portal session so the user can manage billing.
// ---------------------------------------------------------------------------
router.get('/portal', requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });

  const userId = getUser(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const user = await clerkClient.users.getUser(userId);
    const customerId = user.publicMetadata?.stripeCustomerId;

    if (!customerId) {
      return res.status(404).json({ error: 'No billing account found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${CLIENT_URL}/watchlist`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[stripe] portal error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/stripe/status
// Returns the current subscription status for the signed-in user.
// ---------------------------------------------------------------------------
router.get('/status', requireAuth, async (req, res) => {
  const userId = getUser(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const user = await clerkClient.users.getUser(userId);
    const { subscriptionStatus, stripeCustomerId } = user.publicMetadata || {};
    res.json({
      subscriptionStatus: subscriptionStatus || 'none',
      hasCustomer: Boolean(stripeCustomerId),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
