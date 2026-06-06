/**
 * Clerk authentication middleware for Express.
 *
 * requireAuth — protects a route; returns 401 if the request has no valid
 * Clerk session token. Use on any route that needs an authenticated user.
 *
 * getUser — helper to extract the Clerk userId from an authenticated request.
 *
 * Usage:
 *   const { requireAuth, getUser } = require('./lib/auth');
 *   router.get('/watchlist', requireAuth, (req, res) => {
 *     const userId = getUser(req);
 *     ...
 *   });
 */

const { requireAuth: clerkRequireAuth } = require('@clerk/express');

/**
 * Express middleware that rejects unauthenticated requests with 401.
 */
const requireAuth = clerkRequireAuth();

/**
 * Extract the Clerk userId from a request processed by clerkMiddleware.
 * Returns null if the request is not authenticated.
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function getUser(req) {
  return req.auth?.userId || null;
}

module.exports = { requireAuth, getUser };
