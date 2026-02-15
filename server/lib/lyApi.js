const fetch = require('node-fetch');

const BASE_URL = 'https://v2.ly.govapi.tw';

/**
 * Fetch data from the Legislative Yuan API v2.
 *
 * @param {string} endpoint - API endpoint path (e.g. "legislators", "bills")
 * @param {Record<string, string>} [queryParams={}] - Query parameters to forward
 * @returns {Promise<object>} Parsed JSON response or error object
 */
async function fetchFromLY(endpoint, queryParams = {}) {
  try {
    const url = new URL(`${BASE_URL}/${endpoint}`);

    // Append each query param that has a defined, non-empty value
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, value);
      }
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      return {
        error: true,
        status: response.status,
        message: `LY API responded with status ${response.status}`,
      };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    return {
      error: true,
      status: 500,
      message: err.message || 'Failed to fetch from LY API',
    };
  }
}

module.exports = { fetchFromLY };
