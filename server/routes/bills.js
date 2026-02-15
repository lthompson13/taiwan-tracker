const express = require('express');
const router = express.Router();
const { fetchFromLY } = require('../lib/lyApi');
const { translateBill } = require('../lib/translateFields');

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
 * GET /
 * List bills with pagination and optional filters.
 * Supported query params: page, limit, 屆 (term), status, category, and others.
 */
router.get('/', async (req, res) => {
  // Build query params to forward to the LY API
  const queryParams = { ...req.query };

  // Allow English aliases for common filters
  if (queryParams.term) {
    queryParams['屆'] = queryParams.term;
    delete queryParams.term;
  }
  if (queryParams.status) {
    queryParams['議案狀態'] = queryParams.status;
    delete queryParams.status;
  }
  if (queryParams.category) {
    queryParams['議案類別'] = queryParams.category;
    delete queryParams.category;
  }

  const data = await fetchFromLY('bills', queryParams);

  if (data.error) {
    return res.status(data.status || 500).json(data);
  }

  const bills = Array.isArray(data.bills) ? data.bills.map(mapBill) : [];

  const translated = await Promise.all(bills.map(translateBill));

  res.json({
    total: data.total || 0,
    totalPages: data.total_page || 0,
    page: data.page || 1,
    limit: data.limit || 20,
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

  res.json(await translateBill(bills[0]));
});

module.exports = router;
