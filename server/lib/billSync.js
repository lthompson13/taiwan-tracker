/**
 * Bill sync — fetches bills from the Legislative Yuan API and upserts them
 * into the local PostgreSQL database, enabling full-text archive search.
 *
 * Usage (via admin endpoint):
 *   POST /api/admin/sync   { "terms": [11] }
 *
 * Sync logic per term:
 *   1. Fetch page 1 to get total bill count
 *   2. Fetch remaining pages in sequence (small delay between pages)
 *   3. For each bill: tag sectors, translate fields, upsert into DB
 *
 * Bills already in the DB are updated only when latestProgressDate has
 * changed — this skips re-translating stable bills on repeat syncs.
 */

const { fetchFromLY } = require('./lyApi');
const { translateBatch } = require('./translate');
const { tagBill } = require('./sectorTags');
const { getDb } = require('./db');

const PAGE_SIZE = 20;
const PAGE_DELAY_MS = 150; // polite pause between LY API pages

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Map a raw LY API bill to a plain object with English keys (values still Chinese).
 * Mirrors mapBill() in server/routes/bills.js but kept local to avoid coupling.
 */
function mapRawBill(raw) {
  return {
    billId: raw['議案編號'],
    billNameZh: raw['議案名稱'],
    term: raw['屆'] ? parseInt(raw['屆'], 10) : null,
    session: raw['會期'] ? parseInt(raw['會期'], 10) : null,
    categoryZh: raw['議案類別'],
    statusZh: raw['議案狀態'],
    proposerZh: raw['提案單位/提案委員'],
    sourceZh: raw['提案來源'],
    latestProgressDate: raw['最新進度日期'] || null,
    referenceNumber: raw['字號'] || null,
    url: raw['url'] || null,
  };
}

/**
 * Translate the Chinese fields we store in the archive.
 * Returns { billName, category, status, proposer, source }.
 */
async function translateArchiveFields(bill) {
  const texts = [bill.billNameZh, bill.categoryZh, bill.statusZh, bill.proposerZh, bill.sourceZh];
  const translated = await translateBatch(texts);
  return {
    billName: translated[0] || bill.billNameZh,
    category: translated[1] || bill.categoryZh,
    status: translated[2] || bill.statusZh,
    proposer: translated[3] || bill.proposerZh,
    source: translated[4] || bill.sourceZh,
  };
}

/**
 * Sync all bills for the given terms.
 * Returns { synced, skipped, errors } counts.
 *
 * @param {number[]} terms  e.g. [11] or [8, 9, 10, 11]
 * @param {function} [onProgress]  optional callback(message)
 */
async function syncBills(terms = [11], onProgress = null) {
  const db = getDb();
  if (!db) throw new Error('Database not configured');

  const log = (msg) => {
    console.log(`[billSync] ${msg}`);
    if (onProgress) onProgress(msg);
  };

  let totalSynced = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const term of terms) {
    log(`Starting sync for term ${term}…`);

    // Fetch page 1 to get total count
    const firstPage = await fetchFromLY('bills', { '屆': String(term), page: 1, limit: PAGE_SIZE });
    if (firstPage.error) {
      log(`Term ${term}: API error — ${firstPage.message || 'unknown'}`);
      totalErrors++;
      continue;
    }

    const total = firstPage.total || 0;
    const totalPages = Math.ceil(total / PAGE_SIZE);
    log(`Term ${term}: ${total} bills across ${totalPages} pages`);

    // Process first page
    const allRawBills = Array.isArray(firstPage.bills) ? firstPage.bills : [];

    // Fetch remaining pages
    for (let page = 2; page <= totalPages; page++) {
      await sleep(PAGE_DELAY_MS);
      const pageData = await fetchFromLY('bills', { '屆': String(term), page, limit: PAGE_SIZE });
      if (pageData.error) {
        log(`Term ${term} page ${page}: API error — ${pageData.message || 'unknown'}`);
        continue;
      }
      if (Array.isArray(pageData.bills)) {
        allRawBills.push(...pageData.bills);
      }
    }

    log(`Term ${term}: fetched ${allRawBills.length} bills, translating and upserting…`);

    // Process bills in batches of 20 to avoid overwhelming the translate API
    const BATCH = 20;
    for (let i = 0; i < allRawBills.length; i += BATCH) {
      const chunk = allRawBills.slice(i, i + BATCH);

      await Promise.all(chunk.map(async (raw) => {
        try {
          const mapped = mapRawBill(raw);
          if (!mapped.billId) return;

          // Check if already synced with same progress date (skip re-translation)
          const existing = await db.bill.findUnique({
            where: { billId: mapped.billId },
            select: { latestProgressDate: true },
          });

          if (existing && existing.latestProgressDate === mapped.latestProgressDate) {
            totalSkipped++;
            return;
          }

          // Compute sector tags against Chinese text
          const sectors = tagBill({ billName: mapped.billNameZh, proposer: mapped.proposerZh });

          // Translate archive fields
          const translated = await translateArchiveFields(mapped);

          await db.bill.upsert({
            where: { billId: mapped.billId },
            update: {
              billName: translated.billName,
              billNameZh: mapped.billNameZh,
              term: mapped.term,
              session: mapped.session,
              category: translated.category,
              status: translated.status,
              proposer: translated.proposer,
              source: translated.source,
              latestProgressDate: mapped.latestProgressDate,
              referenceNumber: mapped.referenceNumber,
              sectors,
              url: mapped.url,
              syncedAt: new Date(),
            },
            create: {
              billId: mapped.billId,
              billName: translated.billName,
              billNameZh: mapped.billNameZh,
              term: mapped.term,
              session: mapped.session,
              category: translated.category,
              status: translated.status,
              proposer: translated.proposer,
              source: translated.source,
              latestProgressDate: mapped.latestProgressDate,
              referenceNumber: mapped.referenceNumber,
              sectors,
              url: mapped.url,
            },
          });

          totalSynced++;
        } catch (err) {
          console.error(`[billSync] Error on bill ${raw['議案編號']}: ${err.message}`);
          totalErrors++;
        }
      }));
    }

    log(`Term ${term}: done — ${totalSynced} synced, ${totalSkipped} skipped, ${totalErrors} errors`);
  }

  return { synced: totalSynced, skipped: totalSkipped, errors: totalErrors };
}

module.exports = { syncBills };
