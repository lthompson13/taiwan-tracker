const express = require('express');
const router = express.Router();
const { fetchFromLY } = require('../lib/lyApi');
const { translateInterpellation } = require('../lib/translateFields');

/**
 * Map a raw interpellation object from the LY API to English keys.
 */
function mapInterpellation(raw) {
  return {
    term: raw['屆'],
    legislators: raw['質詢委員'],
    meetingDescription: raw['會議代碼:str'],
    interpellationId: raw['質詢編號'],
    publishDate: raw['刊登日期'],
    subject: raw['事由'],
    description: raw['說明'],
    session: raw['會期'],
    meetingNumber: raw['會次'],
  };
}

/**
 * GET /
 * List interpellations with pagination.
 */
router.get('/', async (req, res) => {
  const data = await fetchFromLY('interpellations', req.query);

  if (data.error) {
    return res.status(data.status || 500).json(data);
  }

  const interpellations = Array.isArray(data.interpellations)
    ? data.interpellations.map(mapInterpellation)
    : [];

  const translated = await Promise.all(interpellations.map(translateInterpellation));

  res.json({
    total: data.total || 0,
    totalPages: data.total_page || 0,
    page: data.page || 1,
    limit: data.limit || 20,
    interpellations: translated,
  });
});

module.exports = router;
