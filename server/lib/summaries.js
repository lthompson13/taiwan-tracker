/**
 * Editorial "Why It Matters" summaries.
 *
 * Summaries are stored in server/data/summaries.json, keyed by billId
 * (the 議案編號 field). The file is committed to git; to publish or update a
 * summary, edit the JSON file and push — Railway redeploys automatically.
 *
 * When a PostgreSQL database is added (feature 2.5), this module should be
 * replaced with a database-backed lookup and summaries migrated from the JSON
 * file into the database table.
 */

const path = require('path');
const fs = require('fs');

const SUMMARIES_PATH = path.join(__dirname, '../data/summaries.json');

let summaries = {};

function load() {
  try {
    const raw = fs.readFileSync(SUMMARIES_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    // Strip the instructions placeholder key if present
    const { _instructions, ...rest } = parsed;
    summaries = rest;
    const count = Object.keys(summaries).length;
    if (count > 0) {
      console.log(`[summaries] Loaded ${count} editorial summar${count === 1 ? 'y' : 'ies'}`);
    }
  } catch (err) {
    console.warn('[summaries] Could not load summaries.json:', err.message);
    summaries = {};
  }
}

/**
 * Return the summary object for a bill, or null if none exists.
 * @param {string} billId
 * @returns {{ summary: string, updatedAt: string } | null}
 */
function getSummary(billId) {
  if (!billId) return null;
  return summaries[billId] || null;
}

// Load once at startup
load();

module.exports = { getSummary };
