/**
 * Admin API — protected by ADMIN_SECRET environment variable.
 *
 * All routes require the header:
 *   Authorization: Bearer <ADMIN_SECRET>
 *
 * If ADMIN_SECRET is not set, all routes return 503.
 * If DATABASE_URL is not set, all routes return 503.
 *
 * Mounted at /api/admin in server/index.js.
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../lib/db');
const { upsertSummary, deleteSummary, getAllSummaries } = require('../lib/summaries');
const { syncBills } = require('../lib/billSync');

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

function requireAdmin(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return res.status(503).json({ error: 'ADMIN_SECRET not configured on this server' });
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function requireDb(req, res, next) {
  if (!getDb()) {
    return res.status(503).json({ error: 'DATABASE_URL not configured on this server' });
  }
  next();
}

// Apply both to all admin routes
router.use(requireAdmin, requireDb);

// ---------------------------------------------------------------------------
// Bill summaries
// ---------------------------------------------------------------------------

// GET /api/admin/summaries — list all
router.get('/summaries', async (req, res) => {
  try {
    const summaries = await getAllSummaries();
    res.json(summaries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/summaries — create or update
router.post('/summaries', async (req, res) => {
  const { billId, summary } = req.body;
  if (!billId || !summary) {
    return res.status(400).json({ error: 'billId and summary are required' });
  }
  try {
    const result = await upsertSummary(billId, summary);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/summaries/:billId
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

// GET /api/admin/subscribers — list all
router.get('/subscribers', async (req, res) => {
  try {
    const db = getDb();
    const subscribers = await db.subscriber.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(subscribers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/subscribers — add a subscriber
router.post('/subscribers', async (req, res) => {
  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });
  try {
    const db = getDb();
    const subscriber = await db.subscriber.create({ data: { email, name: name || null } });
    res.status(201).json(subscriber);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Email already subscribed' });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/subscribers/:id/toggle — flip active status
router.patch('/subscribers/:id/toggle', async (req, res) => {
  try {
    const db = getDb();
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

// DELETE /api/admin/subscribers/:id
router.delete('/subscribers/:id', async (req, res) => {
  try {
    const db = getDb();
    await db.subscriber.delete({ where: { id: parseInt(req.params.id, 10) } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Subscriber not found' });
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Bill archive sync
// ---------------------------------------------------------------------------

// POST /api/admin/sync — trigger a bill sync for one or more terms
// Body: { terms: [11] }  (defaults to [11] if omitted)
// Returns immediately; sync runs in background and logs to console.
router.post('/sync', async (req, res) => {
  const terms = Array.isArray(req.body.terms) ? req.body.terms.map(Number) : [11];
  const validTerms = terms.filter((t) => Number.isInteger(t) && t > 0);
  if (validTerms.length === 0) {
    return res.status(400).json({ error: 'Provide at least one valid term number in "terms"' });
  }

  // Respond immediately — sync runs in background
  res.json({ message: 'Sync started', terms: validTerms });

  syncBills(validTerms).then(({ synced, skipped, errors }) => {
    console.log(`[admin/sync] Complete — synced: ${synced}, skipped: ${skipped}, errors: ${errors}`);
  }).catch((err) => {
    console.error('[admin/sync] Failed:', err.message);
  });
});

// GET /api/admin/sync/status — count of bills in archive + last sync time
router.get('/sync/status', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database not configured' });

    const [count, latest] = await Promise.all([
      db.bill.count(),
      db.bill.findFirst({ orderBy: { syncedAt: 'desc' }, select: { syncedAt: true } }),
    ]);
    res.json({ billsInArchive: count, lastSyncedAt: latest?.syncedAt || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
