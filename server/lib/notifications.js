/**
 * Watchlist notification jobs.
 *
 * Two jobs run on separate schedules:
 *
 *  checkHearingNotifications()
 *    — Queries the LY API for upcoming meetings (within 7 days) for each
 *      watched + notify-enabled bill. Sends one email per user per meeting.
 *      Deduplicated by NotificationLog so the same meeting is never emailed twice.
 *
 *  checkStatusNotifications()
 *    — Compares each watched + notify-enabled bill's current status (from the
 *      local Bill table, kept fresh by the daily sync) against the stored
 *      lastKnownStatus on UserBill. Sends email on change and updates the
 *      reference value. First run for a bill initialises lastKnownStatus
 *      without sending an email.
 */

const { Resend } = require('resend');
const { clerkClient } = require('@clerk/express');
const { fetchFromLY } = require('./lyApi');
const { getDb } = require('./db');

const CLIENT_URL = process.env.CLIENT_URL || 'https://billscopetaiwan.com';
const HEARING_LOOKAHEAD_DAYS = 7;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addDays(isoDate, n) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function getUserEmail(userId) {
  try {
    const user = await clerkClient.users.getUser(userId);
    return user.emailAddresses?.[0]?.emailAddress || null;
  } catch {
    return null;
  }
}

async function fetchBillMeetsRaw(billId) {
  try {
    const data = await fetchFromLY('meets', {
      '議事網資料.關係文書.議案.議案編號': billId,
      limit: 20,
    });
    if (data.error || !Array.isArray(data.meets)) return [];
    return data.meets.map((raw) => ({
      meetingCode: raw['會議代碼'] || '',
      dates: Array.isArray(raw['日期']) ? raw['日期'] : [],
      title: raw['會議標題'] || null,
    }));
  } catch {
    return [];
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Email builders
// ---------------------------------------------------------------------------

function buildHearingEmail({ billName, billId, meetingTitle, dates, clientUrl }) {
  const dateStr = dates.join(', ');
  const billUrl = `${clientUrl}/bills/${encodeURIComponent(billId)}`;
  const subject = `Upcoming hearing: ${billName}`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
    <div style="background:#1a3a5c;padding:20px 28px;">
      <span style="color:white;font-size:1rem;font-weight:700;letter-spacing:.02em;">BillScope Taiwan</span>
    </div>
    <div style="padding:28px;">
      <div style="font-size:.7rem;font-weight:700;color:#2A7F8E;letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px;">
        Upcoming Hearing
      </div>
      <h2 style="margin:0 0 8px 0;font-size:1.05rem;font-weight:700;color:#0f1f2e;line-height:1.35;">
        ${billName}
      </h2>
      <p style="margin:0 0 16px 0;color:#4a5568;font-size:.875rem;line-height:1.6;">
        This bill is scheduled for a committee hearing on <strong>${dateStr}</strong>.
        ${meetingTitle ? `<br><span style="color:#718096">${meetingTitle}</span>` : ''}
      </p>
      <a href="${billUrl}" style="display:inline-block;padding:10px 20px;background:#1a3a5c;color:white;text-decoration:none;border-radius:5px;font-size:.825rem;font-weight:600;">
        View bill →
      </a>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #edf2f7;font-size:.75rem;color:#a0aec0;">
      You're receiving this because you enabled notifications for this bill in BillScope Taiwan.
      <a href="${clientUrl}/watchlist" style="color:#2A7F8E;text-decoration:none;">Manage notifications</a>
    </div>
  </div>
</body>
</html>`;
  return { subject, html };
}

function buildStatusChangeEmail({ billName, billId, oldStatus, newStatus, clientUrl }) {
  const billUrl = `${clientUrl}/bills/${encodeURIComponent(billId)}`;
  const subject = `Status update: ${billName}`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
    <div style="background:#1a3a5c;padding:20px 28px;">
      <span style="color:white;font-size:1rem;font-weight:700;letter-spacing:.02em;">BillScope Taiwan</span>
    </div>
    <div style="padding:28px;">
      <div style="font-size:.7rem;font-weight:700;color:#2A7F8E;letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px;">
        Bill Status Update
      </div>
      <h2 style="margin:0 0 16px 0;font-size:1.05rem;font-weight:700;color:#0f1f2e;line-height:1.35;">
        ${billName}
      </h2>
      <table style="border-collapse:collapse;width:100%;margin-bottom:20px;">
        <tr>
          <td style="padding:10px 14px;background:#f7fafc;border-radius:5px 5px 0 0;border:1px solid #e2e8f0;font-size:.8rem;color:#718096;font-weight:600;">
            Previous status
          </td>
          <td style="padding:10px 14px;background:#f7fafc;border-radius:5px 5px 0 0;border:1px solid #e2e8f0;font-size:.875rem;color:#4a5568;">
            ${oldStatus || '—'}
          </td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#ebf8ff;border:1px solid #bee3f8;border-top:none;font-size:.8rem;color:#2b6cb0;font-weight:700;">
            New status
          </td>
          <td style="padding:10px 14px;background:#ebf8ff;border:1px solid #bee3f8;border-top:none;font-size:.875rem;color:#2b6cb0;font-weight:700;">
            ${newStatus || '—'}
          </td>
        </tr>
      </table>
      <a href="${billUrl}" style="display:inline-block;padding:10px 20px;background:#1a3a5c;color:white;text-decoration:none;border-radius:5px;font-size:.825rem;font-weight:600;">
        View bill →
      </a>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #edf2f7;font-size:.75rem;color:#a0aec0;">
      You're receiving this because you enabled notifications for this bill in BillScope Taiwan.
      <a href="${clientUrl}/watchlist" style="color:#2A7F8E;text-decoration:none;">Manage notifications</a>
    </div>
  </div>
</body>
</html>`;
  return { subject, html };
}

// ---------------------------------------------------------------------------
// Hearing notifications
// ---------------------------------------------------------------------------

async function checkHearingNotifications() {
  const db = getDb();
  if (!db) return { skipped: true, reason: 'no db' };
  if (!process.env.RESEND_API_KEY) return { skipped: true, reason: 'no RESEND_API_KEY' };

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  const today = new Date().toISOString().slice(0, 10);
  const cutoff = addDays(today, HEARING_LOOKAHEAD_DAYS);

  // All (userId, billId) pairs that want hearing notifications
  const watching = await db.userBill.findMany({
    where: { notifyEnabled: true, watching: true },
  });
  if (watching.length === 0) return { checked: 0, notified: 0 };

  // Unique bill IDs to minimise API calls
  const billIds = [...new Set(watching.map((w) => w.billId))];

  // Local bill names
  const bills = await db.bill.findMany({
    where: { billId: { in: billIds } },
    select: { billId: true, billName: true },
  });
  const billName = Object.fromEntries(bills.map((b) => [b.billId, b.billName || b.billId]));

  // Index watchers by billId
  const byBill = {};
  for (const w of watching) {
    (byBill[w.billId] = byBill[w.billId] || []).push(w.userId);
  }

  let notified = 0;

  for (const billId of billIds) {
    await sleep(350); // be polite to the LY API
    const meets = await fetchBillMeetsRaw(billId);
    const upcoming = meets.filter((m) =>
      m.dates.some((d) => d >= today && d <= cutoff)
    );
    if (upcoming.length === 0) continue;

    for (const meet of upcoming) {
      const ref = meet.meetingCode;
      if (!ref) continue;
      const users = byBill[billId];

      for (const userId of users) {
        // Deduplication check
        const already = await db.notificationLog.findUnique({
          where: { userId_billId_type_ref: { userId, billId, type: 'hearing', ref } },
        });
        if (already) continue;

        const email = await getUserEmail(userId);
        if (!email) continue;

        const { subject, html } = buildHearingEmail({
          billName: billName[billId],
          billId,
          meetingTitle: meet.title,
          dates: meet.dates,
          clientUrl: CLIENT_URL,
        });

        try {
          const { error } = await resend.emails.send({ from, to: email, subject, html });
          if (error) {
            console.error('[notifications/hearing] Resend error:', error);
            continue;
          }
          await db.notificationLog.create({ data: { userId, billId, type: 'hearing', ref } });
          notified++;
        } catch (err) {
          console.error('[notifications/hearing] send failed:', err.message);
        }
      }
    }
  }

  console.log(`[notifications/hearing] checked ${billIds.length} bills, sent ${notified} emails`);
  return { checked: billIds.length, notified };
}

// ---------------------------------------------------------------------------
// Status change notifications
// ---------------------------------------------------------------------------

async function checkStatusNotifications() {
  const db = getDb();
  if (!db) return { skipped: true, reason: 'no db' };
  if (!process.env.RESEND_API_KEY) return { skipped: true, reason: 'no RESEND_API_KEY' };

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  const watching = await db.userBill.findMany({
    where: { notifyEnabled: true, watching: true },
  });
  if (watching.length === 0) return { checked: 0, notified: 0 };

  const billIds = [...new Set(watching.map((w) => w.billId))];
  const bills = await db.bill.findMany({
    where: { billId: { in: billIds } },
    select: { billId: true, billName: true, status: true },
  });
  const billInfo = Object.fromEntries(bills.map((b) => [b.billId, b]));

  let notified = 0;
  const toInitialise = [];

  for (const userBill of watching) {
    const info = billInfo[userBill.billId];
    if (!info) continue;

    const currentStatus = info.status || null;
    const lastStatus = userBill.lastKnownStatus;

    // First time — just initialise without emailing
    if (lastStatus === null || lastStatus === undefined) {
      toInitialise.push({ id: userBill.id, status: currentStatus });
      continue;
    }

    if (currentStatus === lastStatus) continue;

    const email = await getUserEmail(userBill.userId);
    if (!email) {
      // Still update the reference so we don't get stuck
      await db.userBill.update({ where: { id: userBill.id }, data: { lastKnownStatus: currentStatus } });
      continue;
    }

    const { subject, html } = buildStatusChangeEmail({
      billName: info.billName || userBill.billId,
      billId: userBill.billId,
      oldStatus: lastStatus,
      newStatus: currentStatus,
      clientUrl: CLIENT_URL,
    });

    try {
      const { error } = await resend.emails.send({ from, to: email, subject, html });
      if (error) {
        console.error('[notifications/status] Resend error:', error);
      } else {
        notified++;
      }
    } catch (err) {
      console.error('[notifications/status] send failed:', err.message);
    }

    // Always advance the reference, even if the send failed, so we don't retry forever
    await db.userBill.update({ where: { id: userBill.id }, data: { lastKnownStatus: currentStatus } });
  }

  // Bulk-initialise first-timers
  if (toInitialise.length > 0) {
    await Promise.all(
      toInitialise.map(({ id, status }) =>
        db.userBill.update({ where: { id }, data: { lastKnownStatus: status } })
      )
    );
    console.log(`[notifications/status] initialised lastKnownStatus for ${toInitialise.length} rows`);
  }

  console.log(`[notifications/status] checked ${watching.length} subscriptions, sent ${notified} emails`);
  return { checked: watching.length, notified };
}

module.exports = { checkHearingNotifications, checkStatusNotifications };
