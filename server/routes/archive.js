/**
 * Archive search — queries locally synced bills in PostgreSQL.
 * Unlike /api/bills (which proxies the live LY API), this endpoint searches
 * the full historical dataset and supports free-text queries.
 *
 * GET /api/archive
 *   q        — free-text search (matches English bill name OR Chinese bill name)
 *   sector   — exact sector label, e.g. "Semiconductors"
 *   term     — legislative term number, e.g. 11
 *   status   — English status label, e.g. "Third Reading (Passed)"
 *   page     — page number (default 1)
 *   limit    — results per page (default 20, max 50)
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../lib/db');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

router.get('/', async (req, res) => {
  const db = getDb();
  if (!db) {
    return res.status(503).json({
      error: 'Archive not available — database not configured',
      bills: [],
      total: 0,
      totalInArchive: 0,
    });
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;

  const { q, sector, term, status } = req.query;

  // Build Prisma where clause
  const where = {};

  if (q && q.trim()) {
    const trimmed = q.trim();
    where.OR = [
      { billId:     { contains: trimmed, mode: 'insensitive' } },
      { billName:   { contains: trimmed, mode: 'insensitive' } },
      { billNameZh: { contains: trimmed, mode: 'insensitive' } },
      { proposer:   { contains: trimmed, mode: 'insensitive' } },
    ];
  }

  if (sector) {
    where.sectors = { has: sector };
  }

  if (term) {
    const termNum = parseInt(term, 10);
    if (!isNaN(termNum)) where.term = termNum;
  }

  const { session } = req.query;
  if (session) {
    const sessionNum = parseInt(session, 10);
    if (!isNaN(sessionNum)) where.session = sessionNum;
  }

  if (status) {
    where.status = { equals: status, mode: 'insensitive' };
  }

  try {
    const [bills, total, totalInArchive, latestSync] = await Promise.all([
      db.bill.findMany({
        where,
        orderBy: [
          { latestProgressDate: 'desc' },
          { billId: 'desc' },
        ],
        skip,
        take: limit,
        select: {
          billId: true,
          billName: true,
          billNameZh: true,
          term: true,
          session: true,
          category: true,
          status: true,
          proposer: true,
          latestProgressDate: true,
          sectors: true,
          url: true,
        },
      }),
      db.bill.count({ where }),
      db.bill.count(),
      db.bill.findFirst({
        orderBy: { syncedAt: 'desc' },
        select: { syncedAt: true },
      }),
    ]);

    res.json({
      bills,
      total,
      totalPages: Math.ceil(total / limit),
      page,
      limit,
      totalInArchive,
      lastSyncedAt: latestSync?.syncedAt || null,
    });
  } catch (err) {
    console.error('[archive] Query error:', err.message);
    res.status(500).json({ error: 'Search failed', bills: [], total: 0, totalInArchive: 0 });
  }
});

module.exports = router;
