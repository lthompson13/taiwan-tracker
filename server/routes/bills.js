const express = require('express');
const router = express.Router();
const { fetchFromLY } = require('../lib/lyApi');
const { translateBill } = require('../lib/translateFields');
const { getStatus: getTranslationStatus } = require('../lib/translate');
const { tagBill } = require('../lib/sectorTags');
const { getSummary } = require('../lib/summaries');
const {
  BILL_CATEGORY_MAP,
  BILL_STATUS_MAP,
  mapValue,
} = require('../lib/filterMaps');

/**
 * Map a raw bill object from the LY API to English keys.
 */
function mapBill(raw) {
  const attachments = Array.isArray(raw['相關附件'])
    ? raw['相關附件'].map((a) => ({ url: a['網址'], name: a['名稱'] }))
    : [];

  return {
    term: raw['屆'],
    billId: raw['議案編號'],
    meetingDescription: raw['會議代碼:str'],
    latestProgressDate: raw['最新進度日期'],
    lawNames: raw['法律編號:str'],
    attachments,
    billName: raw['議案名稱'],
    proposer: raw['提案單位/提案委員'],
    status: raw['議案狀態'],
    category: raw['議案類別'],
    source: raw['提案來源'],
    session: raw['會期'],
    referenceNumber: raw['字號'],
    proposalNumber: raw['提案編號'],
    url: raw['url'],
  };
}

/**
 * Build the upstream LY query params from incoming request query.
 * Translates English-friendly keys/values to the Chinese keys/values
 * the LY API expects.
 *
 * Supported incoming params (all optional):
 *   page, limit              — pagination, forwarded as-is
 *   term                     — legislative term number, e.g. 11
 *   session                  — legislative session number
 *   category                 — Legislation / Budget / Resolution / Other
 *   status                   — Scheduled for Plenary / Review Complete / etc.
 *   proposer                 — proposer name (passed through)
 */
function buildBillQuery(reqQuery) {
  const out = {};

  if (reqQuery.page) out.page = reqQuery.page;
  if (reqQuery.limit) out.limit = reqQuery.limit;

  if (reqQuery.term) out['屆'] = reqQuery.term;
  if (reqQuery.session) out['會期'] = reqQuery.session;

  const category = mapValue(reqQuery.category, BILL_CATEGORY_MAP);
  if (category) out['議案類別'] = category;

  const status = mapValue(reqQuery.status, BILL_STATUS_MAP);
  if (status) out['議案狀態'] = status;

  if (reqQuery.proposer) out['提案單位/提案委員'] = reqQuery.proposer;

  return out;
}

/**
 * GET /
 * List bills with pagination and optional filters.
 * Filters (term, session, category, status, proposer) are forwarded to the LY API.
 */
router.get('/', async (req, res) => {
  const queryParams = buildBillQuery(req.query);

  const data = await fetchFromLY('bills', queryParams);

  if (data.error) {
    return res.status(data.status || 500).json(data);
  }

  const bills = Array.isArray(data.bills) ? data.bills.map(mapBill) : [];

  // Tag and attach editorial summary before translation
  bills.forEach((bill) => {
    bill.sectors = tagBill(bill);
    bill.summary = getSummary(bill.billId);
  });

  const translated = await Promise.all(bills.map(translateBill));

  res.json({
    total: data.total || 0,
    totalPages: data.total_page || 0,
    page: data.page || 1,
    limit: data.limit || 20,
    translated: getTranslationStatus().healthy,
    bills: translated,
  });
});

/**
 * GET /:id
 * Fetch a specific bill by its bill ID (議案編號).
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const data = await fetchFromLY('bills', { '議案編號': id });

  if (data.error) {
    return res.status(data.status || 500).json(data);
  }

  const bills = Array.isArray(data.bills) ? data.bills.map(mapBill) : [];

  if (bills.length === 0) {
    return res.status(404).json({ error: true, message: 'Bill not found' });
  }

  const bill = bills[0];
  bill.sectors = tagBill(bill);
  bill.summary = getSummary(bill.billId);
  res.json(await translateBill(bill));
});

module.exports = router;
