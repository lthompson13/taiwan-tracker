const express = require('express');
const router = express.Router();
const { fetchFromLY } = require('../lib/lyApi');
const { translateBill } = require('../lib/translateFields');
const { getStatus: getTranslationStatus } = require('../lib/translate');
const { tagBill } = require('../lib/sectorTags');
const { getSummary } = require('../lib/summaries');
const { getUser, isSubscriber } = require('../lib/auth');
const {
  BILL_CATEGORY_MAP,
  BILL_STATUS_MAP,
  mapValue,
} = require('../lib/filterMaps');
const { translateMeet } = require('../lib/translateFields');

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

  const subscribed = await isSubscriber(getUser(req));

  await Promise.all(bills.map(async (bill) => {
    bill.sectors = tagBill(bill);
    bill.crossStraitFlag = bill.sectors.includes('Cross-Strait');
    bill.summary = subscribed ? await getSummary(bill.billId) : undefined;
  }));

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
 * Map a raw meet object from the LY API to English-keyed fields.
 * Duplicated from routes/meets.js to keep the bills route self-contained.
 */
function mapMeet(raw) {
  const details  = Array.isArray(raw['會議資料'])  ? raw['會議資料']  : [];
  const sittings = Array.isArray(raw['議事網資料']) ? raw['議事網資料'] : [];
  const primary  = details[0] || {};

  const seenUrls = new Set();
  const attachments = sittings
    .flatMap((s) => s['附件'] || [])
    .filter((a) => {
      if (!a['連結'] || !a['格式']) return false;
      if (seenUrls.has(a['連結'])) return false;
      seenUrls.add(a['連結']);
      return true;
    })
    .map((a) => ({ url: a['連結'], title: a['標題'], format: a['格式'] }));

  const videoUrl =
    sittings
      .flatMap((s) => s['連結'] || [])
      .find((l) => l['類型'] === 'video')?.['連結'] || null;

  return {
    meetingCode:    raw['會議代碼'],
    term:           raw['屆'],
    session:        raw['會期'],
    meetingNumber:  raw['會次'],
    meetingType:    raw['會議種類'],
    committeeIds:   raw['委員會代號']      || [],
    committeeNames: raw['委員會代號:str']  || [],
    dates:          raw['日期']            || [],
    title:          raw['會議標題']        || null,
    location:       primary['會議地點']    || null,
    agenda:         primary['會議事由']    || null,
    convener:       primary['委員會召集委員'] || null,
    startTime:      primary['開始時間']    || null,
    endTime:        primary['結束時間']    || null,
    url:            primary['ppg_url']     || null,
    isMultiDay:     (raw['日期'] || []).length > 1,
    attachments,
    videoUrl,
  };
}

/**
 * GET /:id/meets
 * Fetch committee meetings associated with a specific bill.
 * Queries the LY API with the bill ID; returns meetings sorted soonest first.
 */
router.get('/:id/meets', async (req, res) => {
  const { id } = req.params;
  const data = await fetchFromLY('meets', { '議案編號': id, limit: 20 });
  if (data.error) {
    return res.status(data.status || 500).json(data);
  }
  const meets = Array.isArray(data.meets) ? data.meets.map(mapMeet) : [];
  // Sort: upcoming first (by earliest date in the meeting), then most-recent past
  const today = new Date().toISOString().slice(0, 10);
  meets.sort((a, b) => {
    const aDate = (a.dates || [])[0] || '';
    const bDate = (b.dates || [])[0] || '';
    const aUp = aDate >= today;
    const bUp = bDate >= today;
    if (aUp && !bUp) return -1;
    if (!aUp && bUp) return 1;
    // Both upcoming: soonest first; both past: most-recent first
    return aUp ? aDate.localeCompare(bDate) : bDate.localeCompare(aDate);
  });
  const translated = await Promise.all(meets.map(translateMeet));
  res.json({ meets: translated, total: data.total || meets.length });
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
  bill.crossStraitFlag = bill.sectors.includes('Cross-Strait');

  // Preserve Chinese originals for the zh news query before translation overwrites them
  bill.billNameZh = bill.billName || '';
  bill.lawNamesZh = Array.isArray(bill.lawNames) ? [...bill.lawNames] : [];

  const subscribed = await isSubscriber(getUser(req));
  bill.summary = subscribed ? await getSummary(bill.billId) : undefined;

  res.json(await translateBill(bill));
});

module.exports = router;
