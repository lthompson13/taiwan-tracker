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
const { upsertSummary, deleteSummary, getAllSummaries, getSummary } = require('../lib/summaries');

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

// POST /api/editorial/generate
// Body: { billId, meta } — meta is optional translated metadata (sectors, category, status)
// Returns: { draft, billId }
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

module.exports = router;
