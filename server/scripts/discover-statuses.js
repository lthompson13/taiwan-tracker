/**
 * One-off discovery script: fetch many bills from the LY API and print every
 * distinct 議案狀態 value, sorted by frequency.
 *
 * Run from project root: node server/scripts/discover-statuses.js
 *
 * Use the output to update BILL_STATUS_MAP in server/lib/filterMaps.js.
 */

const fetch = require('node-fetch');

const BASE_URL = 'https://v2.ly.govapi.tw';
const LIMIT_PER_PAGE = 20;

// Sample from a mix of recent and older terms. Older terms have bills that
// have already reached terminal statuses like "Withdrawn" or "Returned",
// which are too rare in recent data to surface on a recency-sorted feed.
const SAMPLES = [
  { term: undefined, pages: 10, label: 'recent (no term filter)' },
  { term: 11, pages: 25, label: 'term 11' },
  { term: 10, pages: 25, label: 'term 10' },
  { term: 9,  pages: 25, label: 'term 9'  },
];

async function fetchPage(term, page) {
  const params = new URLSearchParams({ page: String(page), limit: String(LIMIT_PER_PAGE) });
  if (term !== undefined) params.set('屆', String(term));
  const res = await fetch(`${BASE_URL}/bills?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const counts = new Map();
  let totalSampled = 0;

  for (const sample of SAMPLES) {
    console.log(`\nSampling ${sample.label} (${sample.pages} pages)...`);
    for (let page = 1; page <= sample.pages; page++) {
      process.stdout.write(`  page ${page}/${sample.pages}\r`);
      try {
        const data = await fetchPage(sample.term, page);
        const bills = Array.isArray(data.bills) ? data.bills : [];
        if (bills.length === 0) break; // ran out of pages for this term
        for (const b of bills) {
          const status = b['議案狀態'] || '(empty)';
          counts.set(status, (counts.get(status) || 0) + 1);
        }
        totalSampled += bills.length;
      } catch (err) {
        console.error(`\n  page ${page} failed: ${err.message}`);
      }
    }
  }

  console.log(`\n\nUnique 議案狀態 values across ${totalSampled} bills (sorted by frequency):\n`);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [status, count] of sorted) {
    console.log(`  ${count.toString().padStart(5)}   ${status}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
