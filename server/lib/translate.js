const { Translate } = require('@google-cloud/translate').v2;
const { Redis } = require('@upstash/redis');

// Static mapping for known enumerated values — never hits the API
const staticMap = new Map([
  // Parties
  ['民主進步黨', 'Democratic Progressive Party'],
  ['中國國民黨', 'Kuomintang (KMT)'],
  ['台灣民眾黨', 'Taiwan People\'s Party'],
  ['時代力量', 'New Power Party'],
  ['無黨籍', 'Independent'],

  // Bill statuses
  ['排入院會', 'Scheduled for Plenary'],
  ['審查完畢', 'Review Complete'],
  ['三讀', 'Third Reading (Passed)'],
  ['交付審查', 'Referred for Review'],
  ['不予審議', 'Not Reviewed'],
  ['退回程序', 'Returned'],
  ['撤回', 'Withdrawn'],

  // Bill categories
  ['法律案', 'Legislation'],
  ['預算案', 'Budget'],
  ['決議案', 'Resolution'],
  ['其他', 'Other'],

  // Bill sources
  ['政府提案', 'Government Proposal'],
  ['委員提案', 'Legislator Proposal'],

  // Gender
  ['男', 'Male'],
  ['女', 'Female'],

  // Committee categories
  ['國會改革前舊委員會名稱', 'Pre-Reform Committee'],
  ['常設委員會', 'Standing Committee'],
  ['特種委員會', 'Special Committee'],

  // Resigned
  ['是', 'Yes'],
  ['否', 'No'],
]);

// L1: in-memory cache (fast, volatile — resets on restart)
const memCache = new Map();
const MAX_MEM_CACHE_SIZE = 5000;

// L2: Redis persistent cache (survives redeploys)
// Populated lazily; null if env vars are absent.
let redisClient = null;
const REDIS_KEY_PREFIX = 'trans:v1:';
const REDIS_TTL_SECONDS = 7776000; // 90 days

function getRedisClient() {
  if (redisClient) return redisClient;
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redisClient;
}

function setMemCache(key, value) {
  if (memCache.size >= MAX_MEM_CACHE_SIZE) {
    memCache.delete(memCache.keys().next().value);
  }
  memCache.set(key, value);
}

// Google Translate client
let translateClient = null;

// Translation health tracking
const ERROR_THRESHOLD = 3;
let apiErrorCount = 0;
let lastError = null;
let lastSuccessAt = null;

function isEnabled() {
  return Boolean(
    process.env.GOOGLE_TRANSLATE_API_KEY &&
    process.env.GOOGLE_TRANSLATE_API_KEY !== 'your-key-here'
  );
}

function getStatus() {
  return {
    enabled: isEnabled(),
    healthy: isEnabled() && apiErrorCount < ERROR_THRESHOLD,
    errorCount: apiErrorCount,
    lastError,
    lastSuccessAt,
    redisEnabled: Boolean(getRedisClient()),
  };
}

function recordSuccess() {
  apiErrorCount = 0;
  lastError = null;
  lastSuccessAt = new Date().toISOString();
}

function recordError(err) {
  apiErrorCount += 1;
  lastError = err && err.message ? err.message : String(err);
}

function getTranslateClient() {
  if (!translateClient && isEnabled()) {
    translateClient = new Translate({ key: process.env.GOOGLE_TRANSLATE_API_KEY });
  }
  return translateClient;
}

/**
 * Translate a single string from Chinese to English.
 * Resolution order: static map → L1 memory → L2 Redis → Google API
 */
async function translateText(text) {
  if (!text || typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (!trimmed) return text;

  if (staticMap.has(trimmed)) return staticMap.get(trimmed);
  if (memCache.has(trimmed)) return memCache.get(trimmed);
  if (/^[\x00-\x7F]*$/.test(trimmed)) return text;

  const redis = getRedisClient();
  if (redis) {
    try {
      const cached = await redis.get(REDIS_KEY_PREFIX + trimmed);
      if (cached) {
        setMemCache(trimmed, cached);
        return cached;
      }
    } catch (err) {
      console.error('[translate] Redis get error:', err.message);
    }
  }

  const client = getTranslateClient();
  if (!client) return text;

  try {
    const [translation] = await client.translate(trimmed, { from: 'zh-TW', to: 'en' });
    recordSuccess();
    setMemCache(trimmed, translation);
    if (redis) {
      redis.set(REDIS_KEY_PREFIX + trimmed, translation, { ex: REDIS_TTL_SECONDS })
        .catch(err => console.error('[translate] Redis set error:', err.message));
    }
    return translation;
  } catch (err) {
    recordError(err);
    console.error('[translate] API error:', err.message);
    return text;
  }
}

/**
 * Translate multiple strings in batch.
 * Resolution order: static map / L1 → L2 Redis (mget) → Google API (batch)
 */
async function translateBatch(texts) {
  if (!Array.isArray(texts) || texts.length === 0) return texts;

  const results = new Array(texts.length);
  const needsRedis = []; // { index, trimmed }

  // Pass 1: resolve from static map and L1 memory cache
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    if (!text || typeof text !== 'string' || !text.trim()) {
      results[i] = text;
      continue;
    }
    const trimmed = text.trim();
    if (staticMap.has(trimmed)) {
      results[i] = staticMap.get(trimmed);
    } else if (memCache.has(trimmed)) {
      results[i] = memCache.get(trimmed);
    } else if (/^[\x00-\x7F]*$/.test(trimmed)) {
      results[i] = text;
    } else {
      needsRedis.push({ index: i, trimmed });
    }
  }

  if (needsRedis.length === 0) return results;

  // Pass 2: check Redis for remaining items
  const redis = getRedisClient();
  const needsApi = [];

  if (redis) {
    try {
      const keys = needsRedis.map(({ trimmed }) => REDIS_KEY_PREFIX + trimmed);
      const redisResults = await redis.mget(...keys);
      for (let j = 0; j < needsRedis.length; j++) {
        const { index, trimmed } = needsRedis[j];
        const cached = redisResults[j];
        if (cached) {
          results[index] = cached;
          setMemCache(trimmed, cached);
        } else {
          needsApi.push(needsRedis[j]);
        }
      }
    } catch (err) {
      console.error('[translateBatch] Redis mget error:', err.message);
      needsApi.push(...needsRedis);
    }
  } else {
    needsApi.push(...needsRedis);
  }

  if (needsApi.length === 0) return results;

  // Pass 3: Google Translate API for remaining items
  const client = getTranslateClient();
  if (!client) {
    for (const { index } of needsApi) results[index] = texts[index];
    return results;
  }

  try {
    const apiTexts = needsApi.map(({ trimmed }) => trimmed);
    const [translations] = await client.translate(apiTexts, { from: 'zh-TW', to: 'en' });
    recordSuccess();
    const translatedArray = Array.isArray(translations) ? translations : [translations];

    const redisPairs = [];
    for (let j = 0; j < needsApi.length; j++) {
      const { index, trimmed } = needsApi[j];
      const translated = translatedArray[j] || texts[index];
      results[index] = translated;
      setMemCache(trimmed, translated);
      redisPairs.push([REDIS_KEY_PREFIX + trimmed, translated]);
    }

    // Fire-and-forget Redis writes so they don't block the response
    if (redis && redisPairs.length > 0) {
      Promise.all(
        redisPairs.map(([key, value]) =>
          redis.set(key, value, { ex: REDIS_TTL_SECONDS })
        )
      ).catch(err => console.error('[translateBatch] Redis set error:', err.message));
    }
  } catch (err) {
    recordError(err);
    console.error('[translateBatch] API error:', err.message);
    for (const { index } of needsApi) results[index] = texts[index];
  }

  return results;
}

module.exports = {
  translateText,
  translateBatch,
  staticMap,
  isEnabled,
  getStatus,
};
