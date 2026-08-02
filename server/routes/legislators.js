const express = require('express');
const router = express.Router();
const { fetchFromLY } = require('../lib/lyApi');
const { translateLegislator } = require('../lib/translateFields');
const { getStatus: getTranslationStatus } = require('../lib/translate');
const { PARTY_MAP, mapValue } = require('../lib/filterMaps');
const { getDb } = require('../lib/db');

/**
 * Map a raw legislator object from the LY API to English keys.
 */
function mapLegislator(raw) {
  return {
    term: raw['屆'],
    name: raw['委員姓名'],
    nameEn: raw['委員英文姓名'],
    gender: raw['性別'],
    party: raw['黨籍'],
    caucus: raw['黨團'],
    district: raw['選區名稱'],
    committees: raw['委員會'],
    startDate: raw['到職日'],
    education: raw['學歷'],
    experience: raw['經歷'],
    photo: raw['照片位址'],
    resigned: raw['是否離職'],
    legislatorId: raw['歷屆立法委員編號'],
  };
}

/**
 * Build the upstream LY query params from incoming request query.
 * Translates English-friendly keys/values to the Chinese keys/values
 * the LY API expects.
 *
 * Supported incoming params (all optional):
 *   page, limit              — pagination, forwarded as-is
 *   party                    — DPP / KMT / TPP / NPP / Independent (or full name)
 *   term                     — legislative term number, e.g. 11
 *   district                 — district name (passed through)
 *   caucus                   — caucus name (passed through)
 */
function buildLegislatorQuery(reqQuery) {
  const out = {};

  if (reqQuery.page) out.page = reqQuery.page;
  if (reqQuery.limit) out.limit = reqQuery.limit;

  const party = mapValue(reqQuery.party, PARTY_MAP);
  if (party) out['黨籍'] = party;

  if (reqQuery.term) out['屆'] = reqQuery.term;
  if (reqQuery.district) out['選區名稱'] = reqQuery.district;
  if (reqQuery.caucus) out['黨團'] = reqQuery.caucus;

  return out;
}

/**
 * GET /
 * List legislators with pagination and optional filters.
 * Filters (party, term, district, caucus) are forwarded to the LY API.
 */
router.get('/', async (req, res) => {
  const queryParams = buildLegislatorQuery(req.query);

  const data = await fetchFromLY('legislators', queryParams);

  if (data.error) {
    return res.status(data.status || 500).json(data);
  }

  const legislators = Array.isArray(data.legislators)
    ? data.legislators.map(mapLegislator)
    : [];

  const translated = await Promise.all(legislators.map(translateLegislator));

  res.json({
    total: data.total || 0,
    totalPages: data.total_page || 0,
    page: data.page || 1,
    limit: data.limit || 20,
    translated: getTranslationStatus().healthy,
    legislators: translated,
  });
});

/**
 * GET /:name
 * Find a legislator by name (Chinese or English).
 * Searches Term 11 first, then falls back to all terms if not found.
 */
router.get('/:name', async (req, res) => {
  const { name } = req.params;

  async function findInData(params) {
    const data = await fetchFromLY('legislators', params);
    if (data.error) return { error: data };
    const list = Array.isArray(data.legislators) ? data.legislators : [];
    return { match: list.find((l) => l['委員姓名'] === name || l['委員英文姓名'] === name) };
  }

  // Search current term first (covers most cases and avoids large responses)
  let result = await findInData({ '屆': '11', limit: 200 });
  if (result.error) return res.status(result.error.status || 500).json(result.error);

  // Fall back to all terms if not found in term 11
  if (!result.match) {
    result = await findInData({ limit: 200 });
    if (result.error) return res.status(result.error.status || 500).json(result.error);
  }

  if (!result.match) {
    return res.status(404).json({ error: true, message: 'Legislator not found' });
  }

  res.json(await translateLegislator(mapLegislator(result.match)));
});

/**
 * GET /:name/bills
 * Return synced bills where the proposer field contains this legislator's name.
 * Searches the local archive (Chinese proposer text) for sponsored bills.
 */
router.get('/:name/bills', async (req, res) => {
  const { name } = req.params;
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not configured', bills: [] });

  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
  const skip  = (page - 1) * limit;

  try {
    const where = { proposerZh: { contains: name } };

    const [bills, total] = await Promise.all([
      db.bill.findMany({
        where,
        orderBy: [{ latestProgressDate: 'desc' }, { billId: 'desc' }],
        skip,
        take: limit,
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
      }),
      db.bill.count({ where }),
    ]);

    res.json({ bills, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('[legislators/:name/bills]', err.message);
    res.status(500).json({ error: err.message, bills: [] });
  }
});

module.exports = router;
