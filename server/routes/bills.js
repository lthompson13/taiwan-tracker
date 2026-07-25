const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const Anthropic = require('@anthropic-ai/sdk');
const { fetchFromLY } = require('../lib/lyApi');
const { translateBill } = require('../lib/translateFields');
const { getStatus: getTranslationStatus } = require('../lib/translate');
const { tagBill } = require('../lib/sectorTags');
const { getSummary } = require('../lib/summaries');
const { requireAuth, getUser, isSubscriber } = require('../lib/auth');
const { getDb } = require('../lib/db');
const {
  BILL_CATEGORY_MAP,
  BILL_STATUS_MAP,
  mapValue,
} = require('../lib/filterMaps');
const { translateMeet } = require('../lib/translateFields');

const LY_BASE = 'https://v2.ly.govapi.tw';

let _anthropic = null;
function getAnthropic() {
  if (!_anthropic && process.env.ANTHROPIC_API_KEY) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

async function fetchBillTextFromLY(billId) {
  const url = `${LY_BASE}/bills/${encodeURIComponent(billId)}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'BillScopeTW/1.0' }, timeout: 10000 });
  if (!r.ok) return null;
  const json = await r.json();
  if (json.error) return null;
  return json.data || null;
}

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
  // '議事網資料.關係文書.議案.議案編號' is the nested filter path that links a
  // specific bill ID to the meetings in which it appeared.
  const data = await fetchFromLY('meets', { '議事網資料.關係文書.議案.議案編號': id, limit: 20 });
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
 * GET /:id/text
 * Fetch the full Chinese bill text (案由, 說明, 對照表) directly from the LY API.
 * Also returns the cached English translation if one exists.
 * Available to all authenticated users; translation is Pro-only.
 */
router.get('/:id/text', async (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const [raw, translation] = await Promise.all([
    fetchBillTextFromLY(id),
    db ? db.billTextTranslation.findUnique({ where: { billId: id } }) : null,
  ]);

  if (!raw) {
    return res.status(404).json({ error: 'Bill text not available from LY API' });
  }

  const reason      = raw['案由']     || null;
  const explanation = raw['說明']     || null;
  const rawComparisons = Array.isArray(raw['對照表']) ? raw['對照表'] : [];

  const comparisons = rawComparisons.map((entry) => ({
    title:           entry['title'] || entry['law_name'] || null,
    lawName:         entry['law_name'] || null,
    legislationType: entry['立法種類'] || null,
    rows: (Array.isArray(entry['rows']) ? entry['rows'] : []).map((row) => ({
      proposed: row['修正'] || null,
      current:  row['現行'] || null,
      note:     row['說明'] || null,
    })),
  }));

  // PDF attachment — accept any variant name that indicates a PDF document
  const attachments = Array.isArray(raw['相關附件']) ? raw['相關附件'] : [];
  const pdfAtt = attachments.find((a) => {
    const name = a['名稱'] || '';
    return name.includes('PDF') || (a['網址'] || '').toLowerCase().endsWith('.pdf');
  });
  const pdfUrl  = pdfAtt?.['網址'] || null;
  const lyUrl   = raw['url'] || null;
  const docType = raw['提案來源'] || null;

  // Related bills (關連議案) — links between original proposals and review reports
  const relatedBills = (Array.isArray(raw['關連議案']) ? raw['關連議案'] : [])
    .filter((b) => b['議案編號'])
    .map((b) => ({ billId: b['議案編號'], billName: b['議案名稱'] || null }));

  res.json({
    billId: id,
    hasText: !!(reason || explanation || comparisons.length > 0),
    docType,
    relatedBills,
    reason,
    explanation,
    comparisons,
    pdfUrl,
    lyUrl,
    translation: translation ? { reason: translation.reason, explanation: translation.explanation } : null,
  });
});

/**
 * POST /:id/translate
 * Generate an English translation of the bill's 案由 and 說明 using Claude.
 * Result is cached in BillTextTranslation. Pro subscription required.
 */
router.post('/:id/translate', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = getUser(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const subscribed = await isSubscriber(userId);
  if (!subscribed) return res.status(403).json({ error: 'Pro subscription required' });

  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not configured' });

  const ai = getAnthropic();
  if (!ai) return res.status(503).json({ error: 'Translation not configured on this server' });

  // Return cached translation if available
  const existing = await db.billTextTranslation.findUnique({ where: { billId: id } });
  if (existing) return res.json({ reason: existing.reason, explanation: existing.explanation });

  // Fetch the bill text
  const raw = await fetchBillTextFromLY(id);
  if (!raw) return res.status(404).json({ error: 'Bill text not available from LY API' });

  const reason      = raw['案由']  || '';
  const explanation = raw['說明'] || '';

  if (!reason && !explanation) {
    return res.status(404).json({ error: 'No translatable text found for this bill' });
  }

  try {
    const prompt = `You are a professional translator specializing in Taiwan legislative documents. Translate the following Chinese bill text sections into clear, accurate English suitable for policy analysts.

Return ONLY a JSON object with exactly these two keys (omit a key if the source is empty):
{
  "reason": "<translation of the Purpose/Reason section>",
  "explanation": "<translation of the Explanation section>"
}

Do not add any commentary, markdown, or extra text — only the JSON object.

PURPOSE / REASON (案由):
${reason}

EXPLANATION / DETAILS (說明):
${explanation}`;

    const message = await ai.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '';
    let parsed = {};
    try {
      // Strip any accidental markdown fences
      const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: 'Translation failed — could not parse Claude response' });
    }

    const saved = await db.billTextTranslation.create({
      data: {
        billId: id,
        reason:      parsed.reason      || null,
        explanation: parsed.explanation || null,
      },
    });

    res.json({ reason: saved.reason, explanation: saved.explanation });
  } catch (err) {
    console.error('[bills/translate] error:', err.message);
    res.status(500).json({ error: err.message });
  }
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
