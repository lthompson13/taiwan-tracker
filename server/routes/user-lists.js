/**
 * User bill list routes — Pro feature.
 *
 * GET    /api/user/lists                          — all lists (with bill count)
 *                                                   ?billId=xxx adds hasBill boolean
 * POST   /api/user/lists                          — create list { name, description? }
 * GET    /api/user/lists/:listId                  — list detail with enriched bills
 * PATCH  /api/user/lists/:listId                  — rename { name?, description? }
 * DELETE /api/user/lists/:listId                  — delete list + items
 * POST   /api/user/lists/:listId/bills/:billId    — add bill to list
 * DELETE /api/user/lists/:listId/bills/:billId    — remove bill from list
 *
 * Mounted at /api/user/lists in server/index.js (before /api/user).
 */

const express = require('express');
const router = express.Router();
const { requireAuth, getUser, isSubscriber } = require('../lib/auth');
const { getDb } = require('../lib/db');

router.use(requireAuth);
router.use((req, res, next) => {
  if (!getUser(req)) return res.status(401).json({ error: 'Unauthorized' });
  next();
});
router.use(async (req, res, next) => {
  if (!await isSubscriber(getUser(req))) return res.status(403).json({ error: 'Pro subscription required' });
  next();
});

// ---------------------------------------------------------------------------
// GET / — all lists for the user, with bill count
// Optional ?billId=xxx — adds hasBill: boolean to each list
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const userId = getUser(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not configured' });
  try {
    const lists = await db.billList.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { items: true } } },
    });

    const { billId } = req.query;
    if (billId) {
      const memberships = await db.billListItem.findMany({
        where: { listId: { in: lists.map((l) => l.id) }, billId },
        select: { listId: true },
      });
      const memberSet = new Set(memberships.map((m) => m.listId));
      return res.json(lists.map((l) => ({ ...l, hasBill: memberSet.has(l.id) })));
    }

    res.json(lists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST / — create a list
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const userId = getUser(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not configured' });
  const name = req.body?.name?.trim();
  if (!name) return res.status(400).json({ error: 'name is required' });
  const description = req.body?.description?.trim() || null;
  try {
    const list = await db.billList.create({
      data: { userId, name, description },
      include: { _count: { select: { items: true } } },
    });
    res.status(201).json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /:listId — list detail with enriched bills
// ---------------------------------------------------------------------------
router.get('/:listId', async (req, res) => {
  const userId = getUser(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not configured' });
  const listId = parseInt(req.params.listId, 10);
  if (isNaN(listId)) return res.status(400).json({ error: 'Invalid listId' });
  try {
    const list = await db.billList.findUnique({
      where: { id: listId },
      include: { items: { orderBy: { addedAt: 'desc' } } },
    });
    if (!list || list.userId !== userId) return res.status(404).json({ error: 'List not found' });

    const billIds = list.items.map((i) => i.billId);
    const bills = billIds.length
      ? await db.bill.findMany({
          where: { billId: { in: billIds } },
          select: {
            billId: true, billName: true, status: true, category: true,
            sectors: true, term: true, session: true, latestProgressDate: true,
          },
        })
      : [];
    const billMap = Object.fromEntries(bills.map((b) => [b.billId, b]));

    res.json({
      ...list,
      items: list.items.map((item) => ({ ...item, bill: billMap[item.billId] || null })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PATCH /:listId — rename / update description
// ---------------------------------------------------------------------------
router.patch('/:listId', async (req, res) => {
  const userId = getUser(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not configured' });
  const listId = parseInt(req.params.listId, 10);
  if (isNaN(listId)) return res.status(400).json({ error: 'Invalid listId' });
  try {
    const list = await db.billList.findUnique({ where: { id: listId } });
    if (!list || list.userId !== userId) return res.status(404).json({ error: 'List not found' });
    const data = {};
    if (req.body?.name?.trim()) data.name = req.body.name.trim();
    if (req.body?.description !== undefined) data.description = req.body.description?.trim() || null;
    const updated = await db.billList.update({ where: { id: listId }, data });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /:listId — delete list (cascades to items)
// ---------------------------------------------------------------------------
router.delete('/:listId', async (req, res) => {
  const userId = getUser(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not configured' });
  const listId = parseInt(req.params.listId, 10);
  if (isNaN(listId)) return res.status(400).json({ error: 'Invalid listId' });
  try {
    const list = await db.billList.findUnique({ where: { id: listId } });
    if (!list || list.userId !== userId) return res.status(404).json({ error: 'List not found' });
    await db.billList.delete({ where: { id: listId } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /:listId/bills/:billId — add bill to list
// ---------------------------------------------------------------------------
router.post('/:listId/bills/:billId', async (req, res) => {
  const userId = getUser(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not configured' });
  const listId = parseInt(req.params.listId, 10);
  if (isNaN(listId)) return res.status(400).json({ error: 'Invalid listId' });
  try {
    const list = await db.billList.findUnique({ where: { id: listId } });
    if (!list || list.userId !== userId) return res.status(404).json({ error: 'List not found' });
    await db.billListItem.upsert({
      where: { listId_billId: { listId, billId: req.params.billId } },
      update: {},
      create: { listId, billId: req.params.billId },
    });
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /:listId/bills/:billId — remove bill from list
// ---------------------------------------------------------------------------
router.delete('/:listId/bills/:billId', async (req, res) => {
  const userId = getUser(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not configured' });
  const listId = parseInt(req.params.listId, 10);
  if (isNaN(listId)) return res.status(400).json({ error: 'Invalid listId' });
  try {
    await db.billListItem.delete({
      where: { listId_billId: { listId, billId: req.params.billId } },
    });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Bill not in list' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
