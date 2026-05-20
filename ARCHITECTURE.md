# ARCHITECTURE — Taiwan Legislative Tracker

## Overview

A monorepo Node.js application with an Express backend and React frontend. The backend serves as a proxy/translation layer between the Taiwan Legislative Yuan API and the React client. Currently read-through only (no database); future versions will add persistent storage.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 6, React Router DOM v7 |
| Backend | Node.js, Express.js |
| HTTP Client | node-fetch v2.7.0 |
| Translation | Google Cloud Translation API (@google-cloud/translate v9.3.0) |
| Deployment | Railway (Hobby plan, auto-deploys from GitHub) |
| Dev Tooling | concurrently (parallel dev servers) |

## External Data Source

**Legislative Yuan API v2:** https://v2.ly.govapi.tw

This is a free, open, public API maintained by a Taiwanese civic tech organization (OpenFun Ltd). It provides structured JSON data on:
- Legislators (profiles, party, district, committees, education, experience)
- Bills (title, proposer, category, status, attachments, full text in HTML)
- Committees (standing committees, meeting records)
- Interpellations (parliamentary inquiries)

No API key is required. No authentication. Rate limits are undocumented but appear generous for reasonable usage.

Swagger documentation: https://v2.ly.govapi.tw/swagger
Usage guide: https://hackmd.io/@openfunltd/S1iLBqP21l

## Project Structure

```
taiwan_project/
├── package.json              # Root workspace — scripts for dev, build, start
├── .env.example              # Template listing required/optional env vars
├── VISION.md                 # Product vision and strategy
├── ARCHITECTURE.md           # This file — technical structure reference
├── FEATURES.md               # Prioritized feature backlog
│
├── archive/
│   └── aws/                  # Retired AWS Elastic Beanstalk config (deploy.js,
│                             #   Procfile, .ebextensions) — kept for reference
│
├── server/
│   ├── index.js              # Express entry point (port from env or 3001)
│   ├── routes/
│   │   ├── legislators.js    # /api/legislators, /api/legislators/:id (server-side filtering)
│   │   ├── bills.js          # /api/bills, /api/bills/:id (server-side filtering)
│   │   ├── committees.js     # /api/committees
│   │   └── interpellations.js # /api/interpellations
│   ├── lib/
│   │   ├── lyApi.js          # LY API wrapper — all upstream HTTP calls go through here
│   │   ├── translate.js      # Google Translate wrapper; in-memory cache (5000, FIFO)
│   │   │                     #   + health tracking (isEnabled / getStatus)
│   │   ├── translateFields.js # Field-level translation helper
│   │   └── filterMaps.js     # English-to-Chinese filter value mapping (party, status, category)
│   └── scripts/
│       └── discover-statuses.js # One-off: samples the LY API to list real 議案狀態 values
│
└── client/
    ├── vite.config.js        # Dev server proxies /api → localhost:3001
    └── src/
        ├── index.css         # Global design tokens (CSS variables) + base styles
        ├── App.jsx           # Router setup
        ├── pages/
        │   ├── Dashboard.jsx          # Stats overview + recent bills
        │   ├── Legislators.jsx        # Paginated list with server-side party filtering
        │   ├── LegislatorDetail.jsx   # Full profile page
        │   ├── Bills.jsx              # Paginated list with server-side category/status filtering
        │   ├── BillDetail.jsx         # Full bill page with attachments
        │   ├── Committees.jsx         # Committee list with expandable detail
        │   ├── Interpellations.jsx    # Inquiry log, paginated, expandable, hash-deep-linkable
        │   └── Activity.jsx           # Merged chronological feed
        └── components/
            ├── Layout.jsx           # App shell, navigation
            ├── Panel.jsx            # Styled container
            ├── DataTable.jsx        # Sortable table component
            ├── SearchBar.jsx        # Search input + filter dropdowns
            ├── StatusBadge.jsx      # Status indicator pill
            ├── Loader.jsx           # Loading spinner
            ├── Pagination.jsx       # Page navigation
            └── TranslationBanner.jsx # Site-wide warning when translation is offline/degraded
```

## Backend API Endpoints

| Method | Endpoint | Query Params | Description |
|--------|----------|-------------|-------------|
| GET | /api/health | | Liveness check |
| GET | /api/translation-status | | Translation health: { enabled, healthy, errorCount, lastError, lastSuccessAt } |
| GET | /api/legislators | page, party, term, district, caucus | List legislators (server-side filtered) |
| GET | /api/legislators/:id | | Single legislator profile |
| GET | /api/bills | page, term, session, category, status, proposer | List bills (server-side filtered) |
| GET | /api/bills/:id | | Single bill detail |
| GET | /api/committees | | List all standing committees |
| GET | /api/interpellations | page | List interpellations (paginated) |

Filter values are mapped from English to Chinese in server/lib/filterMaps.js before being forwarded to the LY API. For example, party=KMT is translated to 黨籍=中國國民黨.

All list endpoints call the LY API, translate relevant fields from Chinese to English via Google Translate, and return the translated JSON to the client. List responses also include a `translated: <bool>` field reflecting current translation health.

## Data Flow

```
User browser
    ↓ (HTTP request)
React frontend (client/)
    ↓ (/api/* request, proxied in dev via Vite, served directly in prod)
Express backend (server/)
    ↓ (map English filter values → Chinese via filterMaps.js)
    ↓ (HTTP fetch via lyApi.js)
Legislative Yuan API (v2.ly.govapi.tw)
    ↓ (JSON response in Chinese)
Express backend
    ↓ (translate via Google Cloud Translation, cache results in-memory)
React frontend
    ↓ (render translated data)
User browser
```

## Translation Layer

- All translation happens server-side in server/lib/translate.js
- In-memory cache stores up to 5,000 translated strings (FIFO eviction)
- Cache resets on server restart (no persistent cache — this is a priority fix, see FEATURES 1.5)
- Health tracking: translate.js records consecutive API errors. getStatus() reports `enabled` (API key configured) and `healthy` (key configured AND fewer than 3 consecutive failures)
- If GOOGLE_TRANSLATE_API_KEY is missing or invalid, translation is skipped and content passes through in Chinese — but this no longer happens silently: the /api/translation-status endpoint and the TranslationBanner component surface a site-wide warning
- Google Cloud Translation budget is capped at $40/month
- Translation is the primary ongoing operational cost; a persistent cache will significantly reduce this

## Frontend Styling

- A light, professional theme (white background, deep-navy #1B2A4A and muted-teal #2A7F8E accents, Inter typography) per the Vision document's design philosophy
- All colors, typography, spacing, radius, and shadow values are defined as CSS custom properties (design tokens) in client/src/index.css under the :root selector
- Component CSS files and page-level inline styles reference these tokens via var(--token-name) so the palette can be adjusted in one place

## Deployment

- Platform: Railway (Hobby plan)
- Auto-deploys from GitHub on every push
- Railway's Nixpacks builder runs `npm run build` (installs server + client deps, builds the client) then `npm start`
- Railway assigns PORT via environment variable; server reads process.env.PORT
- In production, Express serves the built React app from client/dist/ as static files
- Environment variables configured in Railway dashboard

## Environment Variables

| Variable | Required | Where Set | Purpose |
|----------|----------|-----------|---------|
| GOOGLE_TRANSLATE_API_KEY | Yes (for translation) | Railway dashboard | Google Cloud Translation API key |
| PORT | No (auto-assigned) | Railway (automatic) | Server port |

See .env.example in the project root for the canonical list.

## Current Limitations

1. **No database** — no persistent storage, no user data, no historical tracking
2. **No authentication** — completely public, no user accounts
3. **In-memory translation cache is volatile** — resets on every server restart, causing redundant API calls and costs (Priority 1.5)
4. **No term/session selectors on Bills page** — the backend accepts term/session query params, but the UI does not yet expose them, so the default query returns a narrow slice of legislative data (Priority 2.1)
