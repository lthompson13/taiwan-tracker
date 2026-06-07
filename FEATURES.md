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

### 2.4 Searchable legislative archive
**Status:** Complete — integrated into Bills page (no separate Archive route)

---

## PRIORITY 3 — Monetization Features

These features enable the transition from free tool to paid product.
### 3.1 Scheduled database sync
**Status:** Complete
**What:** Automate the LY API sync so the bill database stays fresh without manual curl commands. The sync should run on a daily schedule, fetching new and updated bills for the current term and session.
**Why:** The Bills page now queries the local database. If the database isn't refreshed regularly, users see stale data. A daily sync keeps the platform current without any manual intervention.
**Implementation approach:** Railway supports cron jobs via its built-in scheduler (add a service with a cron schedule that calls POST /api/admin/sync). Alternatively, use an external scheduler like EasyCron or GitHub Actions on a schedule to hit the sync endpoint. The sync endpoint already exists and handles incremental updates (skips bills whose latestProgressDate hasn't changed).

### 3.2 User authentication and accounts
**Status:** Complete
**What:** User registration, login, and session management.
**Why:** Required for personalized features (watchlists, alerts) and for gating premium content behind a paywall.
**Implementation approach:** Use a service like Clerk, Auth0, or Supabase Auth to avoid building auth from scratch. Start simple — email/password registration with email verification.

### 3.3 Bill watchlist and alerts
**Status:** Complete
**What:** Authenticated users can "watch" specific bills or sector tags and receive email notifications when watched items have status changes (bill advances to committee, gets amended, goes to floor vote, passes).
**Why:** Real-time alerting is one of the highest-value features for professional users. Knowing today that a semiconductor export control bill passed committee is actionable intelligence. Knowing about it three days later is not.
**Implementation approach:** Requires database (2.5) and auth (3.2). Build a background job that periodically checks watched bills against the LY API for status changes and sends notification emails.

### 3.4 Subscription tiers and payment
**Status:** Complete

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

### 4.7 Weekly digest email
**What:** A curated weekly email summarizing the most significant legislative developments with sector tags and brief business-relevance summaries. Includes links back to the platform for full details.
**Why:** Lower-friction consumption for subscribers and a marketing/conversion tool for the paid tier. Moved here from Priority 2 — build the product first, then use the digest to market it.
**Implementation approach:** HTML email template, subscriber management via the database (Subscriber table already exists from 2.5), send endpoint, and a simple admin interface to compose and trigger sends. Use Resend for email delivery.

### 4.8 Sync earlier legislative terms
**What:** Run the bill sync for terms 8, 9, and 10 to build out the full historical archive going back to 2012.
**Why:** The archive compounds in value over time. Analysts doing due diligence want multi-year legislative history, not just the current term.
**Implementation approach:** Run the existing sync command once per term/session combination (same as term 11). No code changes needed — the sync infrastructure already supports any term. Do this when Google Translate budget allows, as earlier terms represent significant new translation volume.

---

## COMPLETED

### 2.2 Sector tagging system
**Completed:** May 2026

### 3.4 Subscription tiers and payment
**Completed:** June 2026
**What was done:** Stripe integration for a single Pro tier at $99/month. server/routes/stripe.js handles Checkout session creation, webhook events (checkout.session.completed, customer.subscription.updated/deleted, invoice.payment_failed), Customer Portal sessions, and a /api/stripe/status endpoint. Webhook writes subscriptionStatus / stripeCustomerId / stripeSubscriptionId to Clerk publicMetadata so subscription state is available server-side and client-side without a separate DB table. client/src/hooks/useSubscription.js reads Clerk publicMetadata for reactive subscription state. Upgrade page at /upgrade with free vs. Pro feature comparison and Stripe Checkout trigger; UpgradeSuccess page polls Clerk metadata until status flips to active. "Upgrade to Pro" CTA added to sidebar for non-subscribers. Pro-gated content: "Why It Matters" summaries (BillDetail + Dashboard), bill annotation panel (BillDetail), Watchlist page. Server-side enforcement: bills routes strip summary field for non-subscribers; user annotation routes return 403 for non-subscribers. To grant free access to any user (beta testers, your own account), set publicMetadata.subscriptionStatus = "active" directly in the Clerk dashboard.

### 3.3 Bill watchlist and alerts
**Completed:** May 2026
**What was done:** Added UserBill table (migration 20260530000000_add_user_bills) storing per-user bill annotations keyed by Clerk userId + billId. Fields: watching (bool), stance (support/oppose/monitor), priority (high/medium/low), note (text). server/routes/user.js provides authenticated CRUD at /api/user/bills — all routes require Clerk auth via requireAuth middleware. BillDetail page gained a tracking panel with 👍/👎/👁 stance toggles, High/Med/Low priority buttons, and a note textarea — stance and priority update instantly on click; note saves on button click. Unauthenticated users see a Sign In prompt. New Watchlist page at /watchlist lists all annotated bills with stance/priority filters; added to sidebar nav. Email alerts deferred until email infrastructure is in place (4.7).

### 3.2 User authentication and accounts
**Completed:** May 2026
**What was done:** Integrated Clerk for authentication. ClerkProvider wraps the React app in main.jsx. Sign-in and sign-up pages at /sign-in and /sign-up use Clerk's embedded components (outside the main Layout). Layout.jsx topbar shows a Sign In button for unauthenticated users and a UserButton avatar for authenticated users. Server-side: @clerk/express clerkMiddleware() added globally; server/lib/auth.js exports requireAuth middleware and getUser(req) helper for protecting future API routes. All existing bill browsing remains public — auth is the foundation for watchlists (3.3) and subscription gating (3.4).

### 3.1 Scheduled database sync
**Completed:** May 2026
**What was done:** Added server/lib/scheduler.js using node-cron. Runs syncBills([11], 200, null) daily at 2 AM Taiwan time (18:00 UTC). Skips bills whose latestProgressDate is unchanged so only genuinely new or updated bills hit the translation API. Scheduler starts automatically after initDb() in server/index.js. Status (isRunning, lastRunAt, lastRunResult) exposed on GET /api/health. Schedule and sync parameters overridable via SYNC_CRON, SYNC_TERM, SYNC_MAX_PAGES env vars.

### 2.4 Searchable legislative archive
**Completed:** May 2026
**What was done:** Added Bill table to Prisma schema (migration 20260529000000_add_bills) with indices on term/session, status, and date. server/lib/billSync.js fetches all pages for given terms from the LY API, tags sectors, translates fields, and upserts into the database — skipping bills whose latestProgressDate is unchanged to avoid redundant translation. server/routes/archive.js provides GET /api/archive with free-text search (ILIKE on English + Chinese bill name and proposer) plus sector/term/status filters. POST /api/admin/sync triggers a sync for specified terms (fire-and-forget); GET /api/admin/sync/status returns archive count and last sync time. Archive search was integrated directly into the Bills page rather than built as a separate route; the LY API serves as the live query layer with the local DB backing full-text search in the background.

### 2.5 Add a database
**Completed:** May 2026
**What was done:** Added PostgreSQL via Prisma ORM (v6). Schema: BillSummary (keyed by billId, replaces summaries.json as primary store) and Subscriber (for digest email list). server/lib/db.js exports a Prisma singleton and initDb() which runs prisma migrate deploy at startup, gracefully skipped when DATABASE_URL is absent. server/lib/summaries.js updated to query DB first and fall back to summaries.json. server/routes/admin.js provides CRUD for summaries and subscribers behind ADMIN_SECRET bearer auth, mounted at /api/admin. server/scripts/seed-summaries.js migrates summaries.json into the database. postinstall in server/package.json runs prisma generate automatically on Railway builds. New env vars: DATABASE_URL (Railway reference variable to Postgres service), ADMIN_SECRET.

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
