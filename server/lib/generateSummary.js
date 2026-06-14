const Anthropic = require('@anthropic-ai/sdk');

let client = null;

function getClient() {
  if (!client && process.env.ANTHROPIC_API_KEY) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/**
 * Generate a draft "Why It Matters" summary for a bill using Claude.
 *
 * @param {object} bill — translated bill object (English fields + billNameZh)
 * @returns {Promise<string>} Draft summary text (2–3 sentences)
 */
async function generateSummary(bill) {
  const ai = getClient();
  if (!ai) throw new Error('ANTHROPIC_API_KEY is not configured');

  const sectors = Array.isArray(bill.sectors) && bill.sectors.length > 0
    ? bill.sectors.join(', ')
    : 'General legislation';

  const lawNames = Array.isArray(bill.lawNames) && bill.lawNames.length > 0
    ? bill.lawNames.slice(0, 4).join('; ')
    : null;

  const lines = [
    `Bill title (English): ${bill.billName || 'Unknown'}`,
    bill.billNameZh ? `Bill title (Chinese): ${bill.billNameZh}` : null,
    `Proposer: ${bill.proposer || 'Unknown'}`,
    `Committee: ${bill.category || 'Unknown'}`,
    `Current status: ${bill.status || 'Unknown'}`,
    `Relevant sectors: ${sectors}`,
    lawNames ? `Related laws being amended: ${lawNames}` : null,
  ].filter(Boolean).join('\n');

  const prompt = `You are a business intelligence analyst writing concise summaries of Taiwan's Legislative Yuan bills for English-speaking investors, executives, and legal professionals.

${lines}

Write a "Why It Matters" summary of exactly 2–3 sentences. Requirements:
- Focus on business and investment implications, not political commentary
- Identify which industries, companies, or cross-border activities are affected
- Explain what would change if the bill passes and why a foreign businessperson should care
- Write in plain, direct English — no jargon, no hedging
- Do not begin with "This bill" — vary the opening`;

  const message = await ai.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content?.[0]?.text?.trim();
  if (!text) throw new Error('Empty response from AI');
  return text;
}

module.exports = { generateSummary };
