/**
 * Filter value mappings: English / short codes -> canonical Chinese strings
 * used by the Legislative Yuan API.
 *
 * Why this file exists:
 * The LY API accepts query-param filters keyed by Chinese field names
 * (e.g. ?黨籍=中國國民黨). Our frontend sends English-friendly values
 * like ?party=KMT or ?party=Kuomintang%20(KMT). This module translates
 * those incoming values into the canonical Chinese strings the LY API
 * stores, so the filter actually matches upstream.
 *
 * Note on accuracy:
 * The Chinese canonical strings below are best-effort based on commonly
 * observed values in the LY dataset. The LY API does not publish a
 * controlled vocabulary, so if a filter stops matching, verify the
 * exact string the API returns for that field and update the map.
 */

const PARTY_MAP = {
  // Short codes
  'DPP': '民主進步黨',
  'KMT': '中國國民黨',
  'TPP': '台灣民眾黨',
  'NPP': '時代力量',
  'IND': '無黨籍',

  // Long English names (match the dropdown options in Legislators.jsx)
  'Democratic Progressive Party': '民主進步黨',
  'Kuomintang (KMT)': '中國國民黨',
  'Kuomintang': '中國國民黨',
  "Taiwan People's Party": '台灣民眾黨',
  'New Power Party': '時代力量',
  'Independent': '無黨籍',
};

const BILL_CATEGORY_MAP = {
  'Legislation': '法律案',
  'Budget': '預算案',
  'Resolution': '決議案',
  'Other': '其他',
};

// Status values verified against ~1700 bills sampled from terms 9–11 of the
// LY API (see server/scripts/discover-statuses.js). The LY API uses these
// exact strings as the value of 議案狀態 — partial matches don't work, so
// each dropdown option must map to one canonical Chinese string.
const BILL_STATUS_MAP = {
  'Scheduled for Plenary': '排入院會',
  'Scheduled for Plenary (Discussion)': '排入院會(討論事項)',
  'Review Complete': '審查完畢',
  'Review Complete (Overdue)': '審查完畢(逾審查期限)',
  'Referred for Review': '交付審查',
  'Direct to Second Reading': '逕付二讀(交付協商)',
  'Third Reading (Passed)': '三讀',
  'Reply for Reference': '復請查照',
};

/**
 * Map a value through a lookup table.
 * - Returns undefined for empty/null input (caller can skip the param).
 * - If the value already contains CJK characters, pass it through as-is —
 *   that lets advanced callers send Chinese directly.
 * - Otherwise look it up; if no entry, return the original (best-effort).
 */
function mapValue(value, table) {
  if (value === undefined || value === null || value === '') return undefined;
  // CJK ideograph block — if already Chinese, don't touch it.
  if (/[一-鿿]/.test(value)) return value;
  return table[value] || value;
}

module.exports = {
  PARTY_MAP,
  BILL_CATEGORY_MAP,
  BILL_STATUS_MAP,
  mapValue,
};
