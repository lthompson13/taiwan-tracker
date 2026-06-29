/**
 * User tag routes — Pro feature.
 *
 * GET    /api/user/tags                        — list all user tags
 * POST   /api/user/tags                        — create a tag { name }
 * DELETE /api/user/tags/:tagId                 — delete tag + all its bill associations
 * GET    /api/user/tags/bills/:billId           — tags applied to a specific bill
 * POST   /api/user/tags/bills/:billId/:tagId    — apply tag to bill
 * DELETE /api/user/tags/bills/:billId/:tagId    — remove tag from bill
 *
 * Mounted at /api/user/tags in server/index.js (before /api/user to avoid prefix clash).
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
// GET / — list all tags for the signed-in user
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const userId = getUser(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not configured' });
  try {
    const tags = await db.userTag.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
    res.json(tags);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST / — create a tag
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const userId = getUser(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not configured' });
  const name = req.body?.name?.trim();
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const tag = await db.userTag.create({ data: { userId, name } });
    res.status(201).json(tag);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Tag already exists' });
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /:tagId — delete a tag (cascades to UserBillTag)
// ---------------------------------------------------------------------------
router.delete('/:tagId', async (req, res) => {
  const userId = getUser(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not configured' });
  const tagId = parseInt(req.params.tagId, 10);
  if (isNaN(tagId)) return res.status(400).json({ error: 'Invalid tagId' });
  try {
    const tag = await db.userTag.findUnique({ where: { id: tagId } });
    if (!tag || tag.userId !== userId) return res.status(404).json({ error: 'Tag not found' });
    await db.userTag.delete({ where: { id: tagId } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /bills/:billId — tags applied to a specific bill
// ---------------------------------------------------------------------------
router.get('/bills/:billId', async (req, res) => {
  const userId = getUser(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not configured' });
  try {
    const rows = await db.userBillTag.findMany({
      where: { userId, billId: req.params.billId },
      include: { tag: true },
      orderBy: { tag: { name: 'asc' } },
    });
    res.json(rows.map((r) => r.tag));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /bills/:billId/:tagId — apply tag to bill
// ---------------------------------------------------------------------------
router.post('/bills/:billId/:tagId', async (req, res) => {
  const userId = getUser(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not configured' });
  const tagId = parseInt(req.params.tagId, 10);
  if (isNaN(tagId)) return res.status(400).json({ error: 'Invalid tagId' });
  const { billId } = req.params;
  try {
    const tag = await db.userTag.findUnique({ where: { id: tagId } });
    if (!tag || tag.userId !== userId) return res.status(404).json({ error: 'Tag not found' });
    await db.userBillTag.upsert({
      where: { userId_billId_tagId: { userId, billId, tagId } },
      update: {},
      create: { userId, billId, tagId },
    });
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /bills/:billId/:tagId — remove tag from bill
// ---------------------------------------------------------------------------
router.delete('/bills/:billId/:tagId', async (req, res) => {
  const userId = getUser(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not configured' });
  const tagId = parseInt(req.params.tagId, 10);
  if (isNaN(tagId)) return res.status(400).json({ error: 'Invalid tagId' });
  try {
    await db.userBillTag.delete({
      where: { userId_billId_tagId: { userId, billId: req.params.billId, tagId } },
    });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Tag not applied to this bill' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
