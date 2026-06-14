/**
 * News route — proxies Google News RSS for Taiwan legislative news.
 *
 * GET /api/news
 *   q     — search query (default: 'Taiwan legislature Legislative Yuan')
 *   lang  — 'en' (default) or 'zh' for Traditional Chinese results
 *   limit — max articles to return (default 8, max 20)
 *
 * Results are cached in memory for 30 minutes per (query, lang) pair.
 */

const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_SIZE = 200;
const DEFAULT_QUERY = 'Taiwan legislature Legislative Yuan';

const cache = new Map();

function getCached(key) {
  const entry = cache.get(key);
  if (!entry || Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key, data) {
  if (cache.size >= MAX_CACHE_SIZE) {
    // Evict oldest entry
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(key, { data, ts: Date.now() });
}

function extractText(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`));
  return m ? m[1].trim() : '';
}

function parseRss(xml, limit) {
  const items = [];
  const chunks = xml.split('<item>').slice(1);
  for (const chunk of chunks) {
    if (items.length >= limit) break;
    const block = chunk.split('</item>')[0];

    const titleRaw   = extractText(block, 'title');
    const url        = extractText(block, 'link');
    const pubDate    = extractText(block, 'pubDate');
    const sourceNode = block.match(/<source[^>]*>([^<]*)<\/source>/);
    const source     = sourceNode ? sourceNode[1].trim() : '';
    const sourceUrl  = block.match(/<source url="([^"]*)">/)?.[1] || '';

    // Google appends " - Source Name" to the title; strip it
    const title = source && titleRaw.endsWith(' - ' + source)
      ? titleRaw.slice(0, -(source.length + 3)).trim()
      : titleRaw;

    if (title && url) {
      items.push({ title, url, source, sourceUrl, publishedAt: pubDate });
    }
  }
  return items;
}

const FEED_URLS = {
  en: (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`,
  zh: (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`,
};

const DEFAULT_QUERY_ZH = '立法院';

router.get('/', async (req, res) => {
  const lang  = req.query.lang === 'zh' ? 'zh' : 'en';
  const defaultQ = lang === 'zh' ? DEFAULT_QUERY_ZH : DEFAULT_QUERY;
  const rawQuery = (req.query.q || defaultQ).trim();
  const query = rawQuery.slice(0, 150);
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 8));
  const cacheKey = `${lang}::${query}::${limit}`;

  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const feedUrl = FEED_URLS[lang](query);
    const r = await fetch(feedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BillScopeTW/1.0)' },
      timeout: 10000,
    });

    if (!r.ok) {
      return res.status(502).json({ error: 'News feed unavailable', articles: [] });
    }

    const xml = await r.text();
    const articles = parseRss(xml, limit);
    const result = { articles, query, cachedAt: new Date().toISOString() };

    setCached(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error('[news] fetch error:', err.message);
    res.status(502).json({ error: 'Failed to fetch news', articles: [] });
  }
});

module.exports = router;
