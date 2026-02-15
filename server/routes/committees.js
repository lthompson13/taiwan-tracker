const express = require('express');
const router = express.Router();
const { fetchFromLY } = require('../lib/lyApi');
const { translateCommittee } = require('../lib/translateFields');

/**
 * Map a raw committee object from the LY API to English keys.
 */
function mapCommittee(raw) {
  return {
    id: raw['委員會代號'],
    name: raw['委員會名稱'],
    responsibilities: raw['委員會職掌'],
    categoryId: raw['委員會類別'],
    category: raw['委員會類別:str'],
  };
}

/**
 * GET /
 * List committees with pagination.
 */
router.get('/', async (req, res) => {
  const data = await fetchFromLY('committees', req.query);

  if (data.error) {
    return res.status(data.status || 500).json(data);
  }

  const committees = Array.isArray(data.committees)
    ? data.committees.map(mapCommittee)
    : [];

  const translated = await Promise.all(committees.map(translateCommittee));

  res.json({
    total: data.total || 0,
    totalPages: data.total_page || 0,
    page: data.page || 1,
    limit: data.limit || 20,
    committees: translated,
  });
});

module.exports = router;
