const express = require('express');
const router = express.Router();
const { fetchFromLY } = require('../lib/lyApi');
const { translateLegislator } = require('../lib/translateFields');
const { PARTY_MAP, mapValue } = require('../lib/filterMaps');

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
    legislators: translated,
  });
});

/**
 * GET /:name
 * Find a legislator by name (Chinese or English).
 */
router.get('/:name', async (req, res) => {
  const { name } = req.params;

  const data = await fetchFromLY('legislators', { limit: 100 });

  if (data.error) {
    return res.status(data.status || 500).json(data);
  }

  const list = Array.isArray(data.legislators) ? data.legislators : [];

  const match = list.find(
    (l) => l['委員姓名'] === name || l['委員英文姓名'] === name
  );

  if (!match) {
    return res.status(404).json({ error: true, message: 'Legislator not found' });
  }

  res.json(await translateLegislator(mapLegislator(match)));
});

module.exports = router;
