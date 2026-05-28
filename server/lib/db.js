/**
 * Prisma client singleton.
 *
 * Returns null if DATABASE_URL is not set so the app degrades gracefully in
 * local development without a database. All callers should check for null
 * before using the client and return an appropriate fallback or 503 response.
 */

const { PrismaClient } = require('@prisma/client');

let prisma = null;

function getDb() {
  if (!process.env.DATABASE_URL) return null;
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return prisma;
}

/**
 * Connect to the database and run any pending migrations.
 * Called once at server startup. Safe to call even if DATABASE_URL is absent.
 */
async function initDb() {
  if (!process.env.DATABASE_URL) {
    console.log('[db] DATABASE_URL not set — database features disabled');
    return;
  }

  // Run pending migrations before accepting traffic
  try {
    const { execSync } = require('child_process');
    execSync('npx prisma migrate deploy', {
      cwd: __dirname + '/..',   // server/ directory (where prisma/ lives)
      stdio: 'inherit',
    });
  } catch (err) {
    console.error('[db] Migration failed:', err.message);
    // Don't crash — non-DB routes still work
  }

  // Verify connectivity
  try {
    const db = getDb();
    await db.$connect();
    console.log('[db] Connected to PostgreSQL');
  } catch (err) {
    console.error('[db] Connection error:', err.message);
  }
}

module.exports = { getDb, initDb };
