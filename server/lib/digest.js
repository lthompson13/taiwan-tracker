/**
 * Weekly digest email builder and sender.
 *
 * Required env vars:
 *   RESEND_API_KEY     — Resend API key (get one at resend.com)
 *   RESEND_FROM_EMAIL  — Verified sender, e.g. "BillScope Taiwan <digest@billscopetw.com>"
 *                        Defaults to Resend's shared test sender for development.
 *   CLIENT_URL         — Base URL for deep links, e.g. "https://billscopetw.com"
 */

const { Resend } = require('resend');

const SECTOR_COLORS = {
  Semiconductors:       '#0284c7',
  Defense:             '#b91c1c',
  Energy:              '#d97706',
  'Financial Regulation': '#1d4ed8',
  Healthcare:          '#7c3aed',
  Trade:               '#0369a1',
  'Cross-Strait':      '#dc2626',
  'Foreign Investment':'#059669',
  'Data & Technology': '#7c3aed',
  Labor:               '#0891b2',
  Environment:         '#16a34a',
  Agriculture:         '#92400e',
  Transportation:      '#6366f1',
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sectorChips(sectors) {
  if (!Array.isArray(sectors) || sectors.length === 0) return '';
  return sectors
    .map((s) => {
      const color = SECTOR_COLORS[s] || '#6b7280';
      return `<span style="display:inline-block;padding:2px 9px;background:${color}1a;color:${color};border-radius:999px;font-size:11px;font-weight:700;font-family:Arial,sans-serif;margin-right:5px;margin-bottom:4px;border:1px solid ${color}33;">${escapeHtml(s)}</span>`;
    })
    .join('');
}

/**
 * Build the HTML email string for the digest.
 *
 * @param {Array<{billId, billName?, status?, sectors?, summary, updatedAt?}>} bills
 * @param {{ introText?: string, weekEnding?: string, platformUrl?: string }} opts
 * @returns {string} Full HTML email
 */
function buildDigestHtml(bills, opts = {}) {
  const {
    introText = '',
    weekEnding = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    platformUrl = process.env.CLIENT_URL || 'https://billscopetw.com',
  } = opts;

  const billRows = bills
    .map((bill) => {
      const billUrl = `${platformUrl}/bills/${encodeURIComponent(bill.billId)}`;
      const statusLine = [bill.status, bill.updatedAt]
        .filter(Boolean)
        .map(escapeHtml)
        .join(' &middot; ');

      return `
      <tr>
        <td style="padding:28px 36px;border-bottom:1px solid #f0f1f3;">
          <div style="margin-bottom:10px;">${sectorChips(bill.sectors)}</div>
          <h2 style="margin:0 0 6px;font-size:17px;font-weight:700;color:#1B2A4A;font-family:Arial,sans-serif;line-height:1.4;">
            ${escapeHtml(bill.billName || bill.billId)}
          </h2>
          ${statusLine ? `<p style="margin:0 0 12px;color:#6b7280;font-size:12px;font-family:Arial,sans-serif;">${statusLine}</p>` : ''}
          <p style="margin:0 0 18px;color:#374151;font-size:14px;line-height:1.75;font-family:Arial,sans-serif;">
            ${escapeHtml(bill.summary)}
          </p>
          <a href="${billUrl}" style="display:inline-block;padding:9px 20px;background:#2A7F8E;color:white;text-decoration:none;border-radius:5px;font-size:13px;font-weight:700;font-family:Arial,sans-serif;">
            Read full analysis &rarr;
          </a>
        </td>
      </tr>`;
    })
    .join('');

  const introRow = introText
    ? `<tr><td style="padding:28px 36px 8px;"><p style="margin:0;color:#374151;font-size:15px;line-height:1.75;font-family:Arial,sans-serif;">${escapeHtml(introText)}</p></td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>BillScope Taiwan — Legislative Digest</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">

<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:#f3f4f6;padding:32px 16px;">
  <tr><td align="center">

    <table width="600" cellpadding="0" cellspacing="0" border="0"
           style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

      <!-- Header -->
      <tr>
        <td style="background:#1B2A4A;padding:32px 36px;">
          <p style="margin:0 0 5px;color:#2A7F8E;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">BillScope Taiwan</p>
          <p style="margin:0 0 7px;color:#ffffff;font-family:Arial,sans-serif;font-size:22px;font-weight:700;line-height:1.3;">Weekly Legislative Digest</p>
          <p style="margin:0;color:rgba(255,255,255,0.5);font-family:Arial,sans-serif;font-size:13px;">Week ending ${escapeHtml(weekEnding)}</p>
        </td>
      </tr>

      <!-- Intro -->
      ${introRow}

      <!-- Bill items -->
      ${billRows}

      <!-- CTA -->
      <tr>
        <td style="padding:28px 36px;background:#f8f9fc;border-top:1px solid #e5e7eb;">
          <p style="margin:0 0 12px;color:#374151;font-family:Arial,sans-serif;font-size:14px;font-weight:600;">
            Track legislation that matters to your business.
          </p>
          <a href="${platformUrl}" style="display:inline-block;padding:10px 22px;background:#1B2A4A;color:white;text-decoration:none;border-radius:5px;font-size:13px;font-weight:700;font-family:Arial,sans-serif;">
            Open BillScope Taiwan &rarr;
          </a>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding:20px 36px;background:#f3f4f6;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-family:Arial,sans-serif;font-size:11px;line-height:1.6;">
            You're receiving this because you subscribed to BillScope Taiwan legislative intelligence.<br>
            &copy; ${new Date().getFullYear()} BillScope Taiwan
          </p>
        </td>
      </tr>

    </table>

  </td></tr>
</table>

</body>
</html>`;
}

/**
 * Send the digest to a list of subscribers via Resend.
 *
 * @param {Array} bills — enriched bill objects (same shape as buildDigestHtml input)
 * @param {Array<{email: string}>} subscribers
 * @param {{ introText?: string, weekEnding?: string, platformUrl?: string }} opts
 * @returns {Promise<{ sent: number, failed: number }>}
 */
async function sendDigest(bills, subscribers, opts = {}) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const weekEnding =
    opts.weekEnding ||
    new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const html = buildDigestHtml(bills, {
    introText: opts.introText,
    weekEnding,
    platformUrl: opts.platformUrl || process.env.CLIENT_URL,
  });

  const subject = `BillScope Taiwan — Legislative Digest (${weekEnding})`;
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  const emails = subscribers.map((sub) => ({
    from,
    to: [sub.email],
    subject,
    html,
  }));

  if (emails.length === 0) return { sent: 0, failed: 0 };

  const BATCH = 100;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < emails.length; i += BATCH) {
    const batch = emails.slice(i, i + BATCH);
    try {
      const { error } = await resend.batch.send(batch);
      if (error) {
        console.error('[digest] Resend batch error:', error);
        failed += batch.length;
      } else {
        sent += batch.length;
      }
    } catch (err) {
      console.error('[digest] Resend batch exception:', err.message);
      failed += batch.length;
    }
  }

  return { sent, failed };
}

module.exports = { buildDigestHtml, sendDigest };
