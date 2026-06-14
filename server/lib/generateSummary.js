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

Respond with valid JSON only — no markdown, no extra text. Use this exact structure:
{
  "summary": "2–3 sentence business impact summary here",
  "searchTerms": ["specific term 1", "specific term 2", "specific term 3"]
}

For "summary": 2–3 sentences in English.
- Focus on business and investment implications
- Identify which industries, companies, or cross-border activities are affected
- Explain what would concretely change if the bill passes
- Plain, direct English — no jargon, no hedging
- Do not begin with "This bill"

For "searchTerms": 2–3 short English phrases a journalist would search to find news coverage of THIS specific bill's topic (not the general law being amended). Be specific — e.g. "solar panel recycling Taiwan" not "waste disposal law". These will be used as Google News search queries.`;

  const message = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content?.[0]?.text?.trim();
  if (!raw) throw new Error('Empty response from AI');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Fallback: treat entire response as summary with no search terms
    return { summary: raw, searchTerms: [] };
  }

  return {
    summary:     parsed.summary     || raw,
    searchTerms: Array.isArray(parsed.searchTerms) ? parsed.searchTerms : [],
  };
}

module.exports = { generateSummary };
