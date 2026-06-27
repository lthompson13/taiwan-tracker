/**
 * Editorial API — for the founder to draft, edit, and publish bill summaries.
 *
 * Protected by Clerk authentication + ADMIN_USER_IDS env var.
 * Set ADMIN_USER_IDS to a comma-separated list of Clerk user IDs that should
 * have editorial access (e.g. "user_abc123,user_def456").
 * If ADMIN_USER_IDS is not set, any authenticated Clerk user can access these
 * routes (useful during local development).
 *
 * Mounted at /api/editorial in server/index.js.
 */

const express = require('express');
const router = express.Router();
const { getAuth } = require('@clerk/express');
const { generateSummary } = require('../lib/generateSummary');
const { upsertSummary, deleteSummary, getAllSummaries } = require('../lib/summaries');
const { getDb } = require('../lib/db');
const { syncBills } = require('../lib/billSync');
const { buildDigestHtml, sendDigest } = require('../lib/digest');

function requireEditorialAccess(req, res, next) {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const adminIds = (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (adminIds.length > 0 && !adminIds.includes(userId)) {
    return res.status(403).json({ error: 'Forbidden — not an admin user' });
  }

  next();
}

router.use(requireEditorialAccess);

// ---------------------------------------------------------------------------
// Bill summaries
// ---------------------------------------------------------------------------

// POST /api/editorial/generate
// Body: { billId, meta } — meta is optional translated metadata (sectors, category, status)
// Returns: { draft, searchTerms, billId }
router.post('/generate', async (req, res) => {
  const { billId, meta } = req.body;
  if (!billId) {
    return res.status(400).json({ error: 'billId is required' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not configured on this server' });
  }

  try {
    const { summary, searchTerms } = await generateSummary(billId, meta || {});
    res.json({ draft: summary, searchTerms, billId });
  } catch (err) {
    console.error('[editorial/generate] Error:', err.message);
    res.status(500).json({ error: 'Failed to generate summary: ' + err.message });
  }
});

// GET /api/editorial/summaries — list all published summaries
router.get('/summaries', async (req, res) => {
  try {
    const summaries = await getAllSummaries();
    res.json(summaries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/editorial/summaries — save (create or update) a summary
// Body: { billId, summary, searchTerms? }
router.post('/summaries', async (req, res) => {
  const { billId, summary, searchTerms } = req.body;
  if (!billId || !summary) {
    return res.status(400).json({ error: 'billId and summary are required' });
  }
  try {
    const result = await upsertSummary(billId, summary, Array.isArray(searchTerms) ? searchTerms : []);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/editorial/summaries/:billId
router.delete('/summaries/:billId', async (req, res) => {
  try {
    await deleteSummary(req.params.billId);
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Summary not found' });
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Subscribers
// ---------------------------------------------------------------------------

// GET /api/editorial/subscribers — list all
router.get('/subscribers', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database not configured' });
    const subscribers = await db.subscriber.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(subscribers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/editorial/subscribers — add a subscriber
router.post('/subscribers', async (req, res) => {
  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database not configured' });
    const subscriber = await db.subscriber.create({ data: { email, name: name || null } });
    res.status(201).json(subscriber);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Email already subscribed' });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/editorial/subscribers/:id/toggle — flip active status
router.patch('/subscribers/:id/toggle', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database not configured' });
    const id = parseInt(req.params.id, 10);
    const existing = await db.subscriber.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Subscriber not found' });
    const updated = await db.subscriber.update({
      where: { id },
      data: { active: !existing.active },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/editorial/subscribers/:id
router.delete('/subscribers/:id', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database not configured' });
    await db.subscriber.delete({ where: { id: parseInt(req.params.id, 10) } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Subscriber not found' });
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Sync status & trigger
// ---------------------------------------------------------------------------

// GET /api/editorial/sync/status
router.get('/sync/status', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database not configured' });
    const [billCount, summaryCount, subscriberCount, latest] = await Promise.all([
      db.bill.count(),
      db.billSummary.count(),
      db.subscriber.count({ where: { active: true } }),
      db.bill.findFirst({ orderBy: { syncedAt: 'desc' }, select: { syncedAt: true } }),
    ]);
    res.json({ billCount, summaryCount, subscriberCount, lastSyncedAt: latest?.syncedAt || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/editorial/sync — trigger a background sync
// Body: { terms?: number[], session?: number, maxPages?: number }
router.post('/sync', async (req, res) => {
  const terms = Array.isArray(req.body?.terms) ? req.body.terms.map(Number) : [11];
  const validTerms = terms.filter((t) => Number.isInteger(t) && t > 0);
  if (validTerms.length === 0) {
    return res.status(400).json({ error: 'Provide at least one valid term number in "terms"' });
  }
  const maxPages = Number.isInteger(req.body?.maxPages) && req.body.maxPages > 0 ? req.body.maxPages : 150;
  const session = Number.isInteger(req.body?.session) && req.body.session > 0 ? req.body.session : null;

  res.json({ message: 'Sync started', terms: validTerms, maxPages, session });

  syncBills(validTerms, maxPages, session)
    .then(({ synced, skipped, errors }) => {
      console.log(`[editorial/sync] Complete — synced: ${synced}, skipped: ${skipped}, errors: ${errors}`);
    })
    .catch((err) => {
      console.error('[editorial/sync] Failed:', err.message);
    });
});

// ---------------------------------------------------------------------------
// Digest
// ---------------------------------------------------------------------------

async function enrichBills(billIds, db) {
  const [summaries, bills] = await Promise.all([
    db.billSummary.findMany({ where: { billId: { in: billIds } } }),
    db.bill.findMany({
      where: { billId: { in: billIds } },
      select: { billId: true, billName: true, status: true, sectors: true },
    }),
  ]);
  const billMap = Object.fromEntries(bills.map((b) => [b.billId, b]));
  const enriched = summaries.map((s) => ({
    billId: s.billId,
    billName: billMap[s.billId]?.billName || s.billId,
    status: billMap[s.billId]?.status || '',
    sectors: billMap[s.billId]?.sectors || [],
    summary: s.summary,
    updatedAt: s.updatedAt.toISOString().slice(0, 10),
  }));
  // Preserve caller-specified order
  enriched.sort((a, b) => billIds.indexOf(a.billId) - billIds.indexOf(b.billId));
  return enriched;
}

// GET /api/editorial/digest/preview?billIds=a,b&intro=...
// Returns the full HTML email so the admin can open it in a new tab
router.get('/digest/preview', async (req, res) => {
  const billIds = (req.query.billIds || '').split(',').map((s) => s.trim()).filter(Boolean);
  const intro = req.query.intro || '';

  if (billIds.length === 0) {
    return res.status(400).send('<p>No bills selected.</p>');
  }

  try {
    const db = getDb();
    if (!db) return res.status(503).send('<p>Database not configured</p>');
    const bills = await enrichBills(billIds, db);
    const weekEnding = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const html = buildDigestHtml(bills, { introText: intro, weekEnding, platformUrl: process.env.CLIENT_URL });
    res.type('html').send(html);
  } catch (err) {
    res.status(500).send(`<p>Error: ${err.message}</p>`);
  }
});

// POST /api/editorial/digest/send
// Body: { billIds: string[], intro?: string }
router.post('/digest/send', async (req, res) => {
  const { billIds, intro } = req.body;
  if (!Array.isArray(billIds) || billIds.length === 0) {
    return res.status(400).json({ error: 'billIds array is required' });
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({ error: 'RESEND_API_KEY is not configured on this server' });
  }

  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database not configured' });

    const [bills, subscribers] = await Promise.all([
      enrichBills(billIds, db),
      db.subscriber.findMany({ where: { active: true } }),
    ]);

    if (subscribers.length === 0) {
      return res.json({ sent: 0, failed: 0, message: 'No active subscribers' });
    }

    const weekEnding = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const { sent, failed } = await sendDigest(bills, subscribers, {
      introText: intro || '',
      weekEnding,
      platformUrl: process.env.CLIENT_URL,
    });

    console.log(`[editorial/digest] Sent ${sent}/${subscribers.length}, failed: ${failed}`);
    res.json({ sent, failed, total: subscribers.length });
  } catch (err) {
    console.error('[editorial/digest/send] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/editorial/batch-options
// Returns available terms, sectors, and total eligible count for the batch UI.
// ---------------------------------------------------------------------------
router.get('/batch-options', async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not configured' });

  try {
    const existing = await db.billSummary.findMany({ select: { billId: true } });
    const doneIds = new Set(existing.map((s) => s.billId));

    const bills = await db.bill.findMany({
      where: { sectors: { isEmpty: false } },
      select: { billId: true, term: true, sectors: true },
    });

    const eligible = bills.filter((b) => !doneIds.has(b.billId));

    const termsSet = new Set();
    const sectorsSet = new Set();
    for (const bill of eligible) {
      if (bill.term != null) termsSet.add(bill.term);
      for (const s of bill.sectors) sectorsSet.add(s);
    }

    res.json({
      terms: [...termsSet].sort((a, b) => b - a),
      sectors: [...sectorsSet].sort(),
      totalEligible: eligible.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/editorial/batch-generate
// SSE stream — generates summaries for bills with sectors but no summary yet.
// Optional query params: term=11, sectors=Healthcare,Technology
// Sends JSON events: { type: 'start'|'progress'|'complete'|'error', ... }
// ---------------------------------------------------------------------------
router.get('/batch-generate', async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not configured' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const termFilter = req.query.term ? parseInt(req.query.term, 10) : null;
    const sectorFilter = req.query.sectors
      ? req.query.sectors.split(',').map((s) => s.trim()).filter(Boolean)
      : null;

    // Find bills that have sector tags but no summary yet
    const existing = await db.billSummary.findMany({ select: { billId: true } });
    const doneIds = new Set(existing.map((s) => s.billId));

    const where = { sectors: { isEmpty: false } };
    if (termFilter) where.term = termFilter;
    if (sectorFilter?.length > 0) where.sectors = { hasSome: sectorFilter };

    const bills = await db.bill.findMany({
      where,
      select: { billId: true, billName: true, sectors: true, category: true, status: true },
      orderBy: { updatedAt: 'desc' },
    });

    const eligible = bills.filter((b) => !doneIds.has(b.billId));
    const total = eligible.length;

    send({ type: 'start', total });

    if (total === 0) {
      send({ type: 'complete', done: 0, errors: 0 });
      res.end();
      return;
    }

    let done = 0;
    let errors = 0;

    for (let i = 0; i < eligible.length; i++) {
      if (res.destroyed) break;

      const bill = eligible[i];
      send({ type: 'progress', current: i + 1, total, billId: bill.billId, billName: bill.billName, status: 'generating' });

      try {
        const { summary, searchTerms } = await generateSummary(bill.billId, {
          sectors: bill.sectors,
          category: bill.category,
          status: bill.status,
        });
        await upsertSummary(bill.billId, summary, searchTerms);
        done++;
        send({ type: 'progress', current: i + 1, total, billId: bill.billId, billName: bill.billName, status: 'done' });
      } catch (err) {
        errors++;
        send({ type: 'progress', current: i + 1, total, billId: bill.billId, billName: bill.billName, status: 'error', error: err.message });
      }
    }

    send({ type: 'complete', done, errors });
    res.end();
  } catch (err) {
    console.error('[editorial/batch-generate] error:', err.message);
    send({ type: 'error', error: err.message });
    res.end();
  }
});

module.exports = router;
