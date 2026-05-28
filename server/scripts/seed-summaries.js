/**
 * One-time migration: import summaries from server/data/summaries.json
 * into the PostgreSQL database.
 *
 * Run once after the database is provisioned:
 *   node server/scripts/seed-summaries.js
 *
 * Safe to re-run — uses upsert so existing records are updated, not duplicated.
 * The JSON file is not deleted after seeding; it continues to serve as a
 * fallback for local dev without a database.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const SUMMARIES_PATH = path.join(__dirname, '../data/summaries.json');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Cannot seed the database.');
    process.exit(1);
  }

  const raw = fs.readFileSync(SUMMARIES_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const { _instructions, ...summaries } = parsed;

  const entries = Object.entries(summaries);
  if (entries.length === 0) {
    console.log('No summaries found in summaries.json. Nothing to seed.');
    return;
  }

  const prisma = new PrismaClient();
  let seeded = 0;

  try {
    for (const [billId, data] of entries) {
      const summaryText = typeof data === 'string' ? data : data.summary;
      if (!summaryText) continue;

      await prisma.billSummary.upsert({
        where: { billId },
        update: { summary: summaryText },
        create: { billId, summary: summaryText },
      });
      console.log(`  ✓ ${billId}`);
      seeded++;
    }
    console.log(`\nSeeded ${seeded} summar${seeded === 1 ? 'y' : 'ies'} into the database.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
