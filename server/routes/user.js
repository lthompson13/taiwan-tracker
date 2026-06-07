/**
 * User bill annotation API — requires Clerk authentication on all routes.
 *
 * GET  /api/user/bills              — all bills the user has annotated
 * GET  /api/user/bills/:billId      — annotations for a single bill (or null)
 * PUT  /api/user/bills/:billId      — upsert annotations
 *                                     body: { watching, stance, priority, note }
 * DELETE /api/user/bills/:billId    — remove all annotations for a bill
 */

const express = require('express');
const router = express.Router();
const { requireAuth, getUser, isSubscriber } = require('../lib/auth');
const { getDb } = require('../lib/db');

const VALID_STANCES = ['support', 'oppose', 'monitor'];
const VALID_PRIORITIES = ['high', 'medium', 'low'];

// All routes require authentication
router.use(requireAuth);

// Hard guard: if requireAuth passes but userId is still null, return 401
router.use((req, res, next) => {
  if (!getUser(req)) {
    return res.status(401).json({ error: 'Unauthorized — could not resolve user ID' });
  }
  next();
});

// Subscription guard: annotations are a Pro feature
router.use(async (req, res, next) => {
  if (!await isSubscriber(getUser(req))) {
    return res.status(403).json({ error: 'Pro subscription required' });
  }
  next();
});

// ---------------------------------------------------------------------------
// GET /api/user/bills — list all annotated bills for the current user
// ---------------------------------------------------------------------------
router.get('/bills', async (req, res) => {
  const userId = getUser(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not configured' });

  try {
    const userBills = await db.userBill.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    // Enrich with bill metadata from the local archive
    const billIds = userBills.map((ub) => ub.billId);
    const bills = billIds.length
      ? await db.bill.findMany({
          where: { billId: { in: billIds } },
          select: {
            billId: true,
            billName: true,
            status: true,
            category: true,
            sectors: true,
            term: true,
            session: true,
            latestProgressDate: true,
            proposer: true,
          },
        })
      : [];

    const billMap = Object.fromEntries(bills.map((b) => [b.billId, b]));

    const result = userBills.map((ub) => ({
      ...ub,
      bill: billMap[ub.billId] || null,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/user/bills/:billId — get annotations for a specific bill
// ---------------------------------------------------------------------------
router.get('/bills/:billId', async (req, res) => {
  const userId = getUser(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not configured' });

  try {
    const userBill = await db.userBill.findUnique({
      where: { userId_billId: { userId, billId: req.params.billId } },
    });
    res.json(userBill || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/user/bills/:billId — create or update annotations
// ---------------------------------------------------------------------------
router.put('/bills/:billId', async (req, res) => {
  const userId = getUser(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not configured' });

  const { billId } = req.params;
  const {
    watching,
    stance,
    priority,
    note,
  } = req.body;

  // Validate optional enum fields
  if (stance !== undefined && stance !== null && !VALID_STANCES.includes(stance)) {
    return res.status(400).json({ error: `stance must be one of: ${VALID_STANCES.join(', ')}` });
  }
  if (priority !== undefined && priority !== null && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: `priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
  }

  try {
    const data = {};
    if (watching !== undefined) data.watching = Boolean(watching);
    if (stance !== undefined) data.stance = stance || null;
    if (priority !== undefined) data.priority = priority || null;
    if (note !== undefined) data.note = note || null;

    const userBill = await db.userBill.upsert({
      where: { userId_billId: { userId, billId } },
      update: data,
      create: { userId, billId, ...data },
    });

    res.json(userBill);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/user/bills/:billId — remove all annotations for a bill
// ---------------------------------------------------------------------------
router.delete('/bills/:billId', async (req, res) => {
  const userId = getUser(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not configured' });

  try {
    await db.userBill.delete({
      where: { userId_billId: { userId, billId: req.params.billId } },
    });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'No annotations found' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
