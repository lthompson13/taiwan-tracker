/**
 * Editorial "Why It Matters" summaries.
 *
 * Resolution order:
 *   1. PostgreSQL database (via Prisma) — primary store when DATABASE_URL is set
 *   2. server/data/summaries.json      — fallback for local dev without a DB,
 *                                        and the source of truth for seeding
 *
 * To migrate existing summaries.json data into the database, run:
 *   node server/scripts/seed-summaries.js
 */

const path = require('path');
const fs = require('fs');
const { getDb } = require('./db');

// --- JSON file fallback ---

const SUMMARIES_PATH = path.join(__dirname, '../data/summaries.json');
let jsonSummaries = {};

function loadJson() {
  try {
    const raw = fs.readFileSync(SUMMARIES_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const { _instructions, ...rest } = parsed;
    jsonSummaries = rest;
    const count = Object.keys(jsonSummaries).length;
    if (count > 0) {
      console.log(`[summaries] Loaded ${count} summar${count === 1 ? 'y' : 'ies'} from JSON file (fallback)`);
    }
  } catch (err) {
    console.warn('[summaries] Could not load summaries.json:', err.message);
    jsonSummaries = {};
  }
}

loadJson();

// --- Public API ---

/**
 * Return the summary for a bill, or null if none exists.
 * Queries the database when available; falls back to summaries.json.
 *
 * @param {string} billId
 * @returns {Promise<{ summary: string, updatedAt: string } | null>}
 */
async function getSummary(billId) {
  if (!billId) return null;

  const db = getDb();
  if (db) {
    try {
      const row = await db.billSummary.findUnique({ where: { billId } });
      if (row) {
        return {
          summary:      row.summary,
          searchTermsEn: row.searchTermsEn || [],
          updatedAt:    row.updatedAt.toISOString().slice(0, 10),
        };
      }
      return null;
    } catch (err) {
      console.error('[summaries] DB query failed, falling back to JSON:', err.message);
    }
  }

  // JSON fallback
  return jsonSummaries[billId] || null;
}

/**
 * Create or update a summary in the database.
 * Requires DATABASE_URL to be set.
 *
 * @param {string} billId
 * @param {string} summaryText
 * @returns {Promise<object>} The saved record
 */
async function upsertSummary(billId, summaryText, searchTermsEn = []) {
  const db = getDb();
  if (!db) throw new Error('Database not configured');

  return db.billSummary.upsert({
    where:  { billId },
    update: { summary: summaryText, searchTermsEn },
    create: { billId, summary: summaryText, searchTermsEn },
  });
}

/**
 * Delete a summary from the database.
 * @param {string} billId
 */
async function deleteSummary(billId) {
  const db = getDb();
  if (!db) throw new Error('Database not configured');
  return db.billSummary.delete({ where: { billId } });
}

/**
 * Return all summaries from the database.
 */
async function getAllSummaries() {
  const db = getDb();
  if (!db) throw new Error('Database not configured');
  return db.billSummary.findMany({ orderBy: { updatedAt: 'desc' } });
}

module.exports = { getSummary, upsertSummary, deleteSummary, getAllSummaries };
