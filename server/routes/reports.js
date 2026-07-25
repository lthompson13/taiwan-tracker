/**
 * Bill report generation — Pro feature.
 *
 * POST /api/user/reports
 *   Body: { billIds: string[], format: 'docx' | 'xlsx' }
 *   Returns the generated file as an attachment download.
 *
 * Data assembled per bill:
 *   - Bill metadata (local DB)
 *   - User annotations + tags (local DB)
 *   - AI summary (local DB)
 *   - Upcoming hearings (LY API, fetched in parallel, capped at 5 concurrent)
 */

const express = require('express');
const router = express.Router();
const { requireAuth, getUser, isSubscriber } = require('../lib/auth');
const { getDb } = require('../lib/db');
const { fetchFromLY } = require('../lib/lyApi');
const { buildWordReport, buildExcelReport } = require('../lib/reportBuilder');

router.use(requireAuth);
router.use((req, res, next) => {
  if (!getUser(req)) return res.status(401).json({ error: 'Unauthorized' });
  next();
});
router.use(async (req, res, next) => {
  if (!await isSubscriber(getUser(req))) return res.status(403).json({ error: 'Pro subscription required' });
  next();
});

// Concurrency-limited parallel fetch
async function fetchWithConcurrency(items, fn, limit = 5) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

async function fetchHearings(billId) {
  try {
    const data = await fetchFromLY('meets', {
      '議事網資料.關係文書.議案.議案編號': billId,
      limit: 10,
    });
    if (data.error || !Array.isArray(data.meets)) return [];
    return data.meets.map((raw) => {
      const details = Array.isArray(raw['會議資料']) ? raw['會議資料'] : [];
      const primary = details[0] || {};
      return {
        meetingCode: raw['會議代碼'] || '',
        dates:    Array.isArray(raw['日期']) ? raw['日期'] : [],
        title:    raw['會議標題'] || null,
        location: primary['會議地點'] || null,
        url:      primary['ppg_url'] || null,
      };
    });
  } catch {
    return [];
  }
}

router.post('/', async (req, res) => {
  const userId = getUser(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not configured' });

  const { billIds, format } = req.body;
  if (!Array.isArray(billIds) || billIds.length === 0) {
    return res.status(400).json({ error: 'billIds array is required' });
  }
  if (!['docx', 'xlsx'].includes(format)) {
    return res.status(400).json({ error: 'format must be docx or xlsx' });
  }
  if (billIds.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 bills per report' });
  }

  try {
    // Fetch all data in parallel where possible
    const [bills, annotations, billTags, summaries] = await Promise.all([
      db.bill.findMany({
        where: { billId: { in: billIds } },
        select: {
          billId: true, billName: true, status: true, category: true,
          sectors: true, term: true, session: true, proposer: true,
          latestProgressDate: true, url: true,
        },
      }),
      db.userBill.findMany({
        where: { userId, billId: { in: billIds } },
      }),
      db.userBillTag.findMany({
        where: { userId, billId: { in: billIds } },
        include: { tag: true },
        orderBy: { tag: { name: 'asc' } },
      }),
      db.billSummary.findMany({
        where: { billId: { in: billIds } },
        select: { billId: true, summary: true },
      }),
    ]);

    // Build lookup maps
    const billMap        = Object.fromEntries(bills.map((b) => [b.billId, b]));
    const annotationMap  = Object.fromEntries(annotations.map((a) => [a.billId, a]));
    const summaryMap     = Object.fromEntries(summaries.map((s) => [s.billId, s.summary]));
    const tagsByBill     = {};
    for (const bt of billTags) {
      (tagsByBill[bt.billId] = tagsByBill[bt.billId] || []).push(bt.tag);
    }

    // Fetch hearings from LY API (5 concurrent)
    const hearingsArr = await fetchWithConcurrency(billIds, fetchHearings, 5);
    const hearingsMap = Object.fromEntries(billIds.map((id, i) => [id, hearingsArr[i]]));

    // Assemble bill objects in requested order
    const reportBills = billIds
      .filter((id) => billMap[id])
      .map((id) => ({
        ...billMap[id],
        summary:    summaryMap[id] || null,
        annotation: annotationMap[id] || {},
        tags:       tagsByBill[id] || [],
        hearings:   hearingsMap[id] || [],
      }));

    if (reportBills.length === 0) {
      return res.status(404).json({ error: 'None of the requested bills were found in the database' });
    }

    const dateStr = new Date().toISOString().slice(0, 10);

    if (format === 'docx') {
      const buffer = await buildWordReport(reportBills);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="billscope-report-${dateStr}.docx"`);
      res.send(buffer);
    } else {
      const buffer = await buildExcelReport(reportBills);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="billscope-report-${dateStr}.xlsx"`);
      res.send(Buffer.from(buffer));
    }
  } catch (err) {
    console.error('[reports] generation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
