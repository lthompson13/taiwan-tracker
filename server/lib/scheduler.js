/**
 * Scheduled bill sync.
 *
 * Runs automatically once per day at 2 AM Taiwan time (18:00 UTC) to keep
 * the local bill database fresh. Syncs term 11 with a 200-page cap, which
 * covers ~4,000 of the most recently updated bills. The skip logic in
 * billSync.js means bills whose status hasn't changed are skipped after a
 * fast DB lookup — translation API is only called for genuinely new or
 * updated bills.
 *
 * The schedule and sync parameters can be overridden via environment variables:
 *   SYNC_CRON     cron expression (default: "0 18 * * *" = 2 AM Taiwan time)
 *   SYNC_TERM     legislative term to sync (default: 11)
 *   SYNC_MAX_PAGES  max pages per run (default: 200)
 *
 * Disabled silently when DATABASE_URL is not set.
 */

const cron = require('node-cron');
const { syncBills } = require('./billSync');

let lastRunAt = null;
let lastRunResult = null;
let isRunning = false;

function getStatus() {
  return {
    scheduled: true,
    cronExpression: process.env.SYNC_CRON || '0 18 * * *',
    isRunning,
    lastRunAt,
    lastRunResult,
  };
}

function startScheduler() {
  if (!process.env.DATABASE_URL) {
    console.log('[scheduler] DATABASE_URL not set — scheduled sync disabled');
    return;
  }

  const cronExpression = process.env.SYNC_CRON || '0 18 * * *'; // 2 AM Taiwan (UTC+8) = 18:00 UTC
  const term = parseInt(process.env.SYNC_TERM, 10) || 11;
  const maxPages = parseInt(process.env.SYNC_MAX_PAGES, 10) || 200;

  const valid = cron.validate(cronExpression);
  if (!valid) {
    console.error(`[scheduler] Invalid SYNC_CRON expression: "${cronExpression}" — scheduled sync disabled`);
    return;
  }

  cron.schedule(cronExpression, async () => {
    if (isRunning) {
      console.log('[scheduler] Previous sync still running — skipping this run');
      return;
    }

    isRunning = true;
    lastRunAt = new Date().toISOString();
    console.log(`[scheduler] Daily sync starting — term ${term}, up to ${maxPages} pages`);

    try {
      const result = await syncBills([term], maxPages, null);
      lastRunResult = { success: true, ...result };
      console.log(`[scheduler] Daily sync complete — synced: ${result.synced}, skipped: ${result.skipped}, errors: ${result.errors}`);
    } catch (err) {
      lastRunResult = { success: false, error: err.message };
      console.error('[scheduler] Daily sync failed:', err.message);
    } finally {
      isRunning = false;
    }
  }, { timezone: 'UTC' });

  console.log(`[scheduler] Daily sync scheduled — "${cronExpression}" UTC (2 AM Taiwan time), term ${term}`);
}

module.exports = { startScheduler, getStatus };
