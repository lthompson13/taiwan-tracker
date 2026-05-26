# FEATURES TO IMPLEMENT — Taiwan Legislative Tracker

## How to Use This Document

This is a prioritized backlog. Work from top to bottom. Each feature is described in enough detail to hand to Claude Code as a prompt. When you complete a feature, move it to the COMPLETED section at the bottom with a date and a note on what was done. When you think of something new, add it to the appropriate priority tier. Update the Architecture document as each feature changes the project structure.

---

## PRIORITY 1 — Fix What's Broken

These are bugs and gaps in the current build that undermine usability. Fix these before adding new features.

*(All Priority 1 items completed — see COMPLETED section below.)*

---

## PRIORITY 2 — Core Product Features

These features transform the project from a data browser into a product someone would pay for. They should be built in the order listed.

### 2.1 Add term and session selectors to Bills page
**Status:** Complete

### 2.2 Sector tagging system
**Status:** Complete

### 2.3 "Why It Matters" editorial summaries
**Status:** Complete

### 2.4 Weekly digest email
**Status:** Not started
**What:** A curated weekly email summarizing the most significant legislative developments with sector tags and brief business-relevance summaries. Includes links back to the platform for full details.
**Why:** This serves two purposes — it's a lower-friction way for users to consume the intelligence (not everyone wants to check a dashboard daily), and it's the primary marketing and conversion tool. Free subscribers receive the digest; the digest drives them to the full platform.
**Implementation approach:** Build an email template system. Create an admin interface where the founder can select bills for the weekly digest, add/edit summaries, and send. Use a service like SendGrid, Mailgun, or Resend for email delivery. Requires a subscriber list (database needed — see 2.5).

### 2.5 Add a database
**Status:** Not started
**What:** Add persistent storage to the application.
**Why:** Required for: sector tags, editorial summaries, user accounts, watchlists, alert preferences, subscriber lists, and historical archive. The current read-through architecture cannot support any paid product features. (Translation cache is solved via Upstash Redis — see 1.5.)
**Implementation approach:** PostgreSQL is the recommended choice — Railway lets you spin up a PostgreSQL instance with one click in the same project. Use an ORM like Prisma for type-safe database access. Initial schema should include tables for: cached bills (with sector tags and editorial summaries), digest subscribers, translation cache, and eventually user accounts.

### 2.6 Searchable legislative archive
**Status:** Not started
**What:** A full-text search across all historical bills, with filters by sector, date range, committee, proposer, and status.
**Why:** The archive grows in value over time. An analyst doing due diligence on a Taiwanese company wants to search for all legislation related to that sector over the past two years. This is a feature that creates a compounding moat — every week of operation makes the archive more valuable.
**Implementation approach:** Requires the database (2.5). Periodically sync bills from the LY API into local storage. Add a search endpoint that queries the local database rather than the LY API, enabling full-text search with filters that aren't available through the upstream API.

---

## PRIORITY 3 — Monetization Features

These features enable the transition from free tool to paid product.

### 3.1 User authentication and accounts
**Status:** Not started
**What:** User registration, login, and session management.
**Why:** Required for personalized features (watchlists, alerts) and for gating premium content behind a paywall.
**Implementation approach:** Use a service like Clerk, Auth0, or Supabase Auth to avoid building auth from scratch. Start simple — email/password registration with email verification.

### 3.2 Bill watchlist and alerts
**Status:** Not started
**What:** Authenticated users can "watch" specific bills or sector tags and receive email notifications when watched items have status changes (bill advances to committee, gets amended, goes to floor vote, passes).
**Why:** Real-time alerting is one of the highest-value features for professional users. Knowing today that a semiconductor export control bill passed committee is actionable intelligence. Knowing about it three days later is not.
**Implementation approach:** Requires database (2.5) and auth (3.1). Build a background job that periodically checks watched bills against the LY API for status changes and sends notification emails.

### 3.3 Subscription tiers and payment
**Status:** Not started
**What:** Free tier (weekly digest only) and paid tier (full dashboard access, alerts, archive search, editorial summaries).
**Why:** Revenue.
**Implementation approach:** Use Stripe for payment processing. Keep it simple — one paid tier initially, monthly billing. Don't over-engineer pricing before you have customers.

---

## PRIORITY 4 — Enhancement Features

Nice-to-have improvements that increase value but aren't critical for launch.

### 4.1 Legislator relationship mapping
**What:** Visualize connections between legislators — co-sponsorship patterns, committee overlaps, party faction alignment. Show which legislators tend to collaborate and which are adversaries.
**Why:** Helps analysts understand the political dynamics behind legislation, not just the legislation itself.

### 4.2 Committee hearing tracker
**What:** Track upcoming committee meetings and hearings, with calendar integration and preview of agenda items.
**Why:** Forward-looking intelligence — knowing what will be discussed before it happens.

### 4.3 Cross-strait legislation flag
**What:** Automatic flagging of any legislation that touches cross-strait relations, mainland China policy, or has national security implications.
**Why:** This is the highest-sensitivity category for most users. Deserves its own dedicated tracking.

### 4.4 News integration
**What:** Pull in English and Chinese-language news articles related to tracked bills and legislators.
**Why:** Adds context beyond the legislative record itself.

### 4.5 AI-assisted summary generation
**What:** Use an LLM API to generate draft "Why It Matters" summaries for new bills, which the founder reviews and edits before publishing.
**Why:** Scales the editorial process. The founder can review and polish 20 AI-drafted summaries in the time it takes to write 5 from scratch.

### 4.6 Admin dashboard
**What:** A private admin interface for managing editorial content — writing/editing bill summaries, curating the weekly digest, managing subscriber lists, viewing usage analytics.
**Why:** Makes the editorial workflow sustainable as the product scales.

---

## COMPLETED

### 2.2 Sector tagging system
**Completed:** May 2026

### 2.3 "Why It Matters" editorial summaries
**Completed:** May 2026
**What was done:** Summaries stored in server/data/summaries.json (committed to git), keyed by billId. server/lib/summaries.js loads the file at startup and exposes getSummary(billId); both bill list and detail routes attach the result. UI: prominent navy-accented "Why It Matters" panel on BillDetail (above metadata table), small "Analysis" badge on Bills list rows, and a left-bordered excerpt on Dashboard recent bills. All UI is conditional — renders only when a summary exists. To publish a summary: add an entry to summaries.json, commit, push. Migrates cleanly to a database table when 2.5 is built.
**What was done:** Created server/lib/sectorTags.js with keyword + committee-based rules for 13 sectors: Semiconductors, Defense, Energy, Financial Regulation, Healthcare, Trade, Cross-Strait, Foreign Investment, Data & Technology, Labor, Environment, Agriculture, Transportation. Tags are computed server-side from raw Chinese bill fields (before translation) in server/routes/bills.js, included in both list and detail API responses as a `sectors` array. Added `sector` badge type to StatusBadge.jsx using --teal/--teal-light tokens. Sector badges displayed inline under bill name in Bills list, in the header on BillDetail, and alongside category/status on Dashboard recent bills. Sector filter dropdown added to Bills page (client-side, filters current page; server-side filtering requires the database, see 2.5).

### 2.1 Add term and session selectors to Bills page
**Completed:** May 2026
**What was done:** Added Term and Session dropdowns to the Bills page SearchBar. Term defaults to 11 (current term); session defaults to empty (all sessions). Changing term resets session. Both are included as query params in the API call — the backend already accepted them. Options cover terms 8–11 (2012–present) and sessions 1–8. No backend changes needed.

### 1.5 Persistent translation cache
**Completed:** May 2026
**What was done:** Added Upstash Redis as an optional L2 persistent cache layer in server/lib/translate.js. Resolution order is now: static map → L1 in-memory (5,000 entries, FIFO) → L2 Redis (90-day TTL) → Google Translate API. Redis writes are fire-and-forget so they don't block responses; Redis failures fall through to the API silently, preserving full graceful degradation. Added `redisEnabled` field to getStatus() / /api/translation-status. Updated .env.example with UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN. Using Upstash free tier (10k req/day) — zero additional cost. Installed @upstash/redis in server/.

### 1.1 Fix client-side filtering to work across full dataset
**Completed:** May 2026
**What was done:** Moved filtering from client-side to server-side. Created server/lib/filterMaps.js to map English filter values to Chinese equivalents (e.g., KMT → 中國國民黨). Updated backend routes to accept and forward query parameters to the LY API. Updated frontend pages to send filters as URL parameters and refetch on filter change. Bill status options were verified against the live LY API taxonomy via server/scripts/discover-statuses.js.

### 1.2 Add translation failure warning
**Completed:** May 2026
**What was done:** Added health tracking to server/lib/translate.js — exports isEnabled() and getStatus() that report whether the API key is configured and whether recent API calls have succeeded (3 consecutive failures flips status to unhealthy). New /api/translation-status endpoint exposes this to the frontend. All four list routes (bills, legislators, committees, interpellations) now include `translated: <bool>` in their response. New client/src/components/TranslationBanner.jsx polls the status endpoint on mount and every 60s, rendering a "Translation offline" banner when the API key is missing or a "Translation degraded" banner when the API is failing. Banner is rendered in Layout.jsx so it appears site-wide.

### 1.3 Create .env.example file
**Completed:** May 2026
**What was done:** Added .env.example to project root listing required and optional environment variables. Verified .env is in .gitignore.

### 1.4 Fix interpellation detail navigation
**Completed:** May 2026
**What was done:** Activity feed items of type "Interpellation" now navigate to /interpellations#<id> (URL-encoded interpellationId). The Interpellations page reads location.hash on mount; once the data has loaded, it finds the matching row, sets expandedId so the inline detail panel renders, and smooth-scrolls the panel into view via a ref. Chose the deep-link approach over a dedicated InterpellationDetail page because interpellations are short (subject + description + meeting metadata) and the existing inline expansion already shows everything useful — no new server route or page needed.

### 4.7 UI redesign — light theme
**Completed:** May 2026
**What was done:** Replaced the dark military/command-center aesthetic with the clean, professional light theme described in the Vision document. Established a design-token system in client/src/index.css (CSS custom properties for the white/navy #1B2A4A/teal #2A7F8E palette, grays, semantic colors, typography, spacing, radius, shadow) and loaded the Inter font. Rewrote every component CSS file (Layout, Panel, DataTable, SearchBar, Pagination) and every page's inline styles to consume those tokens. Removed all military-themed copy ("TOP SECRET // SI // NOFORN", "// CLASSIFIED", "/// PAGE TITLE" headings, ">_" search prompts, "PERSONNEL FILES" labels) in favor of plain professional language. Replaced the monospace body font, all-caps headings, and green-on-black surfaces.

### Infrastructure: Migrated from AWS Elastic Beanstalk to Railway
**Completed:** May 2026
**What was done:** Migrated hosting from AWS Elastic Beanstalk (suspended, deprecated platform) to Railway Hobby plan. Archived deploy.js, Procfile, and .ebextensions/ to archive/aws/. Renamed the root build:full script to build so Railway's Nixpacks builder runs it automatically. Railway auto-deploys from GitHub on push. Environment variables configured in Railway dashboard. Terminated AWS EB environment.
