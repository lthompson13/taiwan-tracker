# FEATURES TO IMPLEMENT — Taiwan Legislative Tracker

## How to Use This Document

This is a prioritized backlog. Work from top to bottom. Each feature is described in enough detail to hand to Claude Code as a prompt. When you complete a feature, mark it done with a date. When you think of something new, add it to the appropriate priority tier. Update the Architecture document as each feature changes the project structure.

---

## PRIORITY 1 — Fix What's Broken

These are bugs and gaps in the current build that undermine usability. Fix these before adding new features.

### 1.2 Add translation failure warning
**Status:** Completed May 2026
**What was done:** Added health tracking to `server/lib/translate.js` — exports `isEnabled()` and `getStatus()` that report whether the API key is configured and whether recent API calls have succeeded (3 consecutive failures flips status to unhealthy). New `/api/translation-status` endpoint exposes this to the frontend. All four list routes (bills, legislators, committees, interpellations) now include `translated: <bool>` in their response. New `client/src/components/TranslationBanner.jsx` polls the status endpoint on mount and every 60s, rendering a red "TRANSLATION OFFLINE" banner when the API key is missing or a yellow "TRANSLATION DEGRADED" banner when the API is failing. Banner is rendered in `Layout.jsx` so it appears site-wide.

### 1.4 Fix interpellation detail navigation
**Status:** Not started
**Problem:** Interpellations in the Activity feed are not clickable — navigateTo is set to null.
**Solution:** Either create an InterpellationDetail page (similar to BillDetail) or link interpellations to an expanded view within the existing Interpellations page.

### 1.5 Persistent translation cache
**Status:** Not started
**Priority elevated:** Translation cache currently resets on every server restart, causing all previously translated content to be re-translated via the Google Cloud API. This directly increases operating costs (Google Translate budget capped at $40/month) and slows page loads. Every Railway redeploy (which happens on every git push) clears the cache.
**What:** Move the translation cache from in-memory (volatile) to persistent storage.
**Implementation approach:** Options include (a) writing cache to a JSON file on disk that loads on server start — simplest but limited by Railway's ephemeral filesystem, (b) adding a Redis instance on Railway — fast and purpose-built for caching, or (c) using the PostgreSQL database once it's added (Priority 2.4) with a translations table. Recommended: implement option (a) as a quick fix, then migrate to (b) or (c) when the database is added. Alternatively, skip straight to (c) if the database is being added soon.

---

## PRIORITY 2 — Core Product Features

These features transform the project from a data browser into a product someone would pay for. They should be built in the order listed.

### 2.1 Add term and session selectors to Bills page
**Status:** Not started
**What:** Add dropdown selectors for legislative term (屆) and session period (會期) to the Bills page. The current term is the 11th (第11屆). Each term has multiple sessions numbered 1-8.
**Why:** The default API query returns a narrow slice of bills (mostly "scheduled for plenary" status). Adding term and session selectors lets users access a much broader range of bill statuses and historical legislation. This is essential for the product to be useful as a research tool.
**Implementation approach:** Add term and session dropdowns to the Bills page UI. When a user selects a term and session, include those as query parameters in the API call. Default to the current term but don't default to a specific session so users see all bills in the current term.

### 2.2 Sector tagging system
**Status:** Not started
**What:** Each bill gets tagged by business sector — semiconductors, defense, energy, financial regulation, healthcare, trade, cross-strait relations, foreign investment, data privacy/technology, labor, environment, agriculture, transportation.
**Why:** This is the feature that makes the platform useful for specific audiences. An analyst who only cares about semiconductor policy can filter to see only what's relevant to them.
**Implementation approach:** Create a tagging function that analyzes bill titles, categories, and proposer committee assignments to assign sector tags. Start with keyword-based rules (e.g., bills from the Economics Committee mentioning 半導體, 晶片, or 積體電路 get tagged "semiconductors"). This can be enhanced with AI classification later. Store tags alongside bill data. Add sector filter to the Bills page and Dashboard.

### 2.3 "Why It Matters" editorial summaries
**Status:** Not started
**What:** For bills tagged with business-relevant sectors, add a brief (2-3 sentence) plain-English summary explaining the business implications. Example: "This bill would impose new export licensing requirements on advanced semiconductor packaging equipment. If passed, it could affect foreign chip manufacturers sourcing packaging services from Taiwan and may require compliance reviews for existing supply contracts."
**Why:** This is the core value proposition — translating legislative activity into business relevance. Raw translation tells you what a bill says; the editorial summary tells you why you should care.
**Implementation approach:** Initially, these summaries will be written manually by the founder (this is the human editorial moat). Build the UI to display them. Later, explore using an LLM API to generate draft summaries that are then reviewed and edited. Requires a database to store the summaries (see 2.5).

### 2.4 Weekly digest email
**Status:** Not started
**What:** A curated weekly email summarizing the most significant legislative developments with sector tags and brief business-relevance summaries. Includes links back to the platform for full details.
**Why:** This serves two purposes — it's a lower-friction way for users to consume the intelligence (not everyone wants to check a dashboard daily), and it's the primary marketing and conversion tool. Free subscribers receive the digest; the digest drives them to the full platform.
**Implementation approach:** Build an email template system. Create an admin interface where the founder can select bills for the weekly digest, add/edit summaries, and send. Use a service like SendGrid, Mailgun, or Resend for email delivery. Requires a subscriber list (database needed — see 2.5).

### 2.5 Add a database
**Status:** Not started
**What:** Add persistent storage to the application.
**Why:** Required for: sector tags, editorial summaries, user accounts, watchlists, alert preferences, subscriber lists, persistent translation cache (long-term solution), and historical archive. The current read-through architecture cannot support any paid product features.
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

### 4.7 UI redesign — light theme
**What:** Replace the dark military/command-center aesthetic with a clean, professional light theme per the Vision document's design philosophy (white background, navy/teal accents, sans-serif typography).
**Why:** Better aligns with the target audience of business professionals. Current aesthetic may signal "hobby project" rather than "professional intelligence tool."

---

## COMPLETED

### 1.1 Fix client-side filtering to work across full dataset
**Completed:** May 2026
**What was done:** Moved filtering from client-side to server-side. Created server/lib/filterMaps.js to map English filter values to Chinese equivalents (e.g., KMT → 中國國民黨). Updated backend routes to accept and forward query parameters to the LY API. Updated frontend pages to send filters as URL parameters and refetch on filter change.

### 1.3 Create .env.example file
**Completed:** May 2026
**What was done:** Added .env.example to project root listing required and optional environment variables. Verified .env is in .gitignore.

### Infrastructure: Migrated from AWS Elastic Beanstalk to Railway
**Completed:** May 2026
**What was done:** Migrated hosting from AWS Elastic Beanstalk (suspended, deprecated platform) to Railway Hobby plan. Removed deploy.js and Procfile. Railway auto-deploys from GitHub on push. Environment variables configured in Railway dashboard. Terminated AWS EB environment.
