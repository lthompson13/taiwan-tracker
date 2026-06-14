const Anthropic = require('@anthropic-ai/sdk');
const fetch = require('node-fetch');

const LY_BASE = 'https://v2.ly.govapi.tw';

let client = null;
function getClient() {
  if (!client && process.env.ANTHROPIC_API_KEY) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/**
 * Fetch the rich bill detail from the LY API v2 singular endpoint.
 * /bills/{id} returns rationale (案由), explanation (說明), and amendment
 * comparison table (對照表) — fields not available on the list endpoint.
 */
async function fetchBillDetail(billId) {
  const url = `${LY_BASE}/bills/${encodeURIComponent(billId)}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'BillScopeTW/1.0' },
    timeout: 10000,
  });
  if (!r.ok) throw new Error(`LY API returned ${r.status} for bill ${billId}`);
  const json = await r.json();
  if (json.error) throw new Error(`LY API error for bill ${billId}`);
  return json.data || json;
}

/**
 * Build a concise text block from the amendment comparison table (對照表).
 * We only include the per-article explanation notes — not the full legal text,
 * which would bloat the prompt without adding much analytical value.
 */
function summariseAmendments(comparisons) {
  if (!Array.isArray(comparisons) || comparisons.length === 0) return null;

  const lines = [];
  for (const entry of comparisons) {
    const lawName = entry['law_name'] || entry['law_id'] || '';
    const rows = Array.isArray(entry['rows']) ? entry['rows'] : [];
    for (const row of rows) {
      const note = row['說明'] || row['說明'] || '';
      if (note) lines.push(lawName ? `[${lawName}] ${note}` : note);
    }
  }
  return lines.length > 0 ? lines.join('\n') : null;
}

/**
 * Generate a draft "Why It Matters" summary for a bill.
 * Fetches the rich Chinese-language bill detail from the LY API and sends
 * it to Claude for analysis — no Google Translate intermediary.
 *
 * @param {string} billId
 * @param {object} [metaOverride] — optional translated metadata from the
 *   frontend (sectors, proposer, category, status) to supplement the raw data
 * @returns {Promise<string>} Draft summary (2–3 sentences, English)
 */
async function generateSummary(billId, metaOverride = {}) {
  const ai = getClient();
  if (!ai) throw new Error('ANTHROPIC_API_KEY is not configured');

  const raw = await fetchBillDetail(billId);

  const title    = raw['議案名稱'] || raw['議案名稱'] || '';
  const rationale = raw['案由']   || raw['案由'] || '';
  const explanation = raw['說明'] || raw['說明'] || '';
  const comparisons = raw['對照表'] || raw['對照表'] || [];
  const lawNamesZh = raw['法律編號:str'] || [];

  const amendmentNotes = summariseAmendments(comparisons);

  // Supplementary metadata from the frontend (already translated to English)
  const sectors  = Array.isArray(metaOverride.sectors) && metaOverride.sectors.length > 0
    ? metaOverride.sectors.join(', ')
    : null;
  const category = metaOverride.category || null;
  const status   = metaOverride.status   || null;

  const contextLines = [
    `議案名稱：${title}`,
    lawNamesZh.length > 0 ? `修正法律：${lawNamesZh.join('、')}` : null,
    category  ? `委員會：${category}` : null,
    status    ? `進度：${status}`    : null,
    sectors   ? `產業分類（英文）：${sectors}` : null,
    rationale   ? `\n案由：\n${rationale.slice(0, 800)}`   : null,
    explanation ? `\n說明：\n${explanation.slice(0, 800)}` : null,
    amendmentNotes ? `\n修正重點：\n${amendmentNotes.slice(0, 600)}` : null,
  ].filter(Boolean).join('\n');

  const prompt = `You are a business intelligence analyst writing concise summaries of Taiwan's Legislative Yuan bills for English-speaking investors, executives, and legal professionals.

The following is the raw Chinese legislative record for one bill. Read it directly — do not translate it word-for-word, but use it to understand what the bill does and why it matters to business.

${contextLines}

Write a "Why It Matters" summary of exactly 2–3 sentences in English. Requirements:
- Focus on business and investment implications
- Identify which industries, companies, or cross-border activities are affected
- Explain what would concretely change if the bill passes
- Write in plain, direct English — no jargon, no hedging
- Do not begin with "This bill" — vary the opening`;

  const message = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content?.[0]?.text?.trim();
  if (!text) throw new Error('Empty response from AI');
  return text;
}

module.exports = { generateSummary };
