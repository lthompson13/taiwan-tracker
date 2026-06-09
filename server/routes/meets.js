/**
 * Committee meeting routes.
 *
 * GET /api/meets — list committee meetings from the LY API.
 *   Query params: term, session, committee (committee ID number), page, limit
 */

const express = require('express');
const router = express.Router();
const { fetchFromLY } = require('../lib/lyApi');
const { translateMeet } = require('../lib/translateFields');
const { getStatus: getTranslationStatus } = require('../lib/translate');

/**
 * Map a raw meet object from the LY API to clean English-keyed fields.
 */
function mapMeet(raw) {
  const details    = Array.isArray(raw['會議資料'])  ? raw['會議資料']  : [];
  const sittings   = Array.isArray(raw['議事網資料']) ? raw['議事網資料'] : [];

  // Use first session slot as the primary for display
  const primary = details[0] || {};

  // Collect all attachments across session slots; deduplicate by URL
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

  // First video link across all session slots
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
 * GET /
 * List committee meetings with optional term/session/committee filters.
 */
router.get('/', async (req, res) => {
  const params = {};
  if (req.query.term)      params['屆']         = req.query.term;
  if (req.query.session)   params['會期']        = req.query.session;
  if (req.query.committee) params['委員會代號']   = req.query.committee;
  if (req.query.page)      params.page           = req.query.page;
  if (req.query.limit)     params.limit          = req.query.limit;

  const data = await fetchFromLY('meets', params);

  if (data.error) {
    return res.status(data.status || 500).json(data);
  }

  const meets = Array.isArray(data.meets) ? data.meets.map(mapMeet) : [];
  const translated = await Promise.all(meets.map(translateMeet));

  res.json({
    total:      data.total       || 0,
    totalPages: data.total_page  || 0,
    page:       data.page        || 1,
    limit:      data.limit       || 20,
    translated: getTranslationStatus().healthy,
    meets:      translated,
  });
});

module.exports = router;
