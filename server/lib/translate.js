const { Translate } = require('@google-cloud/translate').v2;

// Static mapping for known enumerated values
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

// In-memory translation cache
const cache = new Map();
const MAX_CACHE_SIZE = 5000;

let translate = null;

function getClient() {
  if (!translate && process.env.GOOGLE_TRANSLATE_API_KEY && process.env.GOOGLE_TRANSLATE_API_KEY !== 'your-key-here') {
    translate = new Translate({ key: process.env.GOOGLE_TRANSLATE_API_KEY });
  }
  return translate;
}

/**
 * Translate a single text string from Chinese to English.
 * Checks static map first, then cache, then calls Google Translate API.
 */
async function translateText(text) {
  if (!text || typeof text !== 'string') return text;

  const trimmed = text.trim();
  if (!trimmed) return text;

  // Check static map
  if (staticMap.has(trimmed)) return staticMap.get(trimmed);

  // Check cache
  if (cache.has(trimmed)) return cache.get(trimmed);

  // Check if text contains only ASCII (already English)
  if (/^[\x00-\x7F]*$/.test(trimmed)) return text;

  const client = getClient();
  if (!client) return text; // No API key configured, return as-is

  try {
    const [translation] = await client.translate(trimmed, { from: 'zh-TW', to: 'en' });
    // Evict oldest entries if cache is too large
    if (cache.size >= MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    cache.set(trimmed, translation);
    return translation;
  } catch (err) {
    console.error('[translate] API error:', err.message);
    return text; // Return original on failure
  }
}

/**
 * Translate multiple strings in a single batch API call.
 * Returns an array of translated strings in the same order.
 */
async function translateBatch(texts) {
  if (!Array.isArray(texts) || texts.length === 0) return texts;

  // Separate texts into those we can resolve locally and those needing API
  const results = new Array(texts.length);
  const apiTexts = []; // { index, text } for texts needing API call
  const apiIndices = [];

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    if (!text || typeof text !== 'string' || !text.trim()) {
      results[i] = text;
      continue;
    }

    const trimmed = text.trim();

    if (staticMap.has(trimmed)) {
      results[i] = staticMap.get(trimmed);
    } else if (cache.has(trimmed)) {
      results[i] = cache.get(trimmed);
    } else if (/^[\x00-\x7F]*$/.test(trimmed)) {
      results[i] = text;
    } else {
      apiTexts.push(trimmed);
      apiIndices.push(i);
    }
  }

  // If nothing needs API translation, return immediately
  if (apiTexts.length === 0) return results;

  const client = getClient();
  if (!client) {
    // No API key, fill remaining with originals
    for (const idx of apiIndices) {
      results[idx] = texts[idx];
    }
    return results;
  }

  try {
    const [translations] = await client.translate(apiTexts, { from: 'zh-TW', to: 'en' });
    const translatedArray = Array.isArray(translations) ? translations : [translations];

    for (let j = 0; j < apiIndices.length; j++) {
      const translated = translatedArray[j] || texts[apiIndices[j]];
      results[apiIndices[j]] = translated;

      // Cache the result
      if (cache.size >= MAX_CACHE_SIZE) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      cache.set(apiTexts[j], translated);
    }
  } catch (err) {
    console.error('[translateBatch] API error:', err.message);
    // Fill remaining with originals on failure
    for (const idx of apiIndices) {
      results[idx] = texts[idx];
    }
  }

  return results;
}

module.exports = { translateText, translateBatch, staticMap };
