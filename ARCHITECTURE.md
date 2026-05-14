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
├── VISION.md                 # Product vision and strategy
├── ARCHITECTURE.md           # This file — technical structure reference
├── FEATURES.md               # Prioritized feature backlog
│
├── server/
│   ├── index.js              # Express entry point (port from env or 3001)
│   ├── routes/
│   │   ├── legislators.js    # /api/legislators, /api/legislators/:id (server-side filtering)
│   │   ├── bills.js          # /api/bills, /api/bills/:id (server-side filtering)
│   │   ├── committees.js     # /api/committees
│   │   └── interpellations.js # /api/interpellations
│   └── lib/
│       ├── lyApi.js          # LY API wrapper — all upstream HTTP calls go through here
│       ├── translate.js      # Google Translate wrapper with in-memory cache (5000 entries, FIFO)
│       ├── translateFields.js # Field-level translation helper
│       └── filterMaps.js     # English-to-Chinese filter value mapping (party, status, category)
│
└── client/
    ├── vite.config.js        # Dev server proxies /api → localhost:3001
    └── src/
        ├── App.jsx           # Router setup
        ├── pages/
        │   ├── Dashboard.jsx          # Stats overview + recent bills
        │   ├── Legislators.jsx        # Paginated list with server-side party filtering
        │   ├── LegislatorDetail.jsx   # Full profile page
        │   ├── Bills.jsx              # Paginated list with server-side category/status filtering
        │   ├── BillDetail.jsx         # Full bill page with attachments
        │   ├── Committees.jsx         # Committee list with expandable detail
        │   ├── Interpellations.jsx    # Inquiry log, paginated, expandable
        │   └── Activity.jsx           # Merged chronological feed
        └── components/
            ├── Layout.jsx      # App shell, navigation
            ├── Panel.jsx       # Styled container
            ├── DataTable.jsx   # Sortable table component
            ├── SearchBar.jsx   # Search input
            ├── StatusBadge.jsx # Status indicator
            ├── Loader.jsx      # Loading spinner
            └── Pagination.jsx  # Page navigation
```

## Backend API Endpoints

| Method | Endpoint | Query Params | Description |
|--------|----------|-------------|-------------|
| GET | /api/legislators | page, party, term, district, caucus | List legislators (server-side filtered) |
| GET | /api/legislators/:id | | Single legislator profile |
| GET | /api/bills | page, term, session, category, status, proposer | List bills (server-side filtered) |
| GET | /api/bills/:id | | Single bill detail |
| GET | /api/committees | | List all standing committees |
| GET | /api/interpellations | page | List interpellations (paginated) |

Filter values are mapped from English to Chinese in server/lib/filterMaps.js before being forwarded to the LY API. For example, party=KMT is translated to 黨籍=中國國民黨.

All backend endpoints call the LY API, translate relevant fields from Chinese to English via Google Translate, and return the translated JSON to the client.

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
- Cache resets on server restart (no persistent cache — this is a priority fix)
- If GOOGLE_TRANSLATE_API_KEY is missing or invalid, translation is silently skipped — content passes through in Chinese
- Google Cloud Translation budget is capped at $40/month
- Translation is the primary ongoing operational cost; persistent cache will significantly reduce this

## Deployment

- Platform: Railway (Hobby plan)
- Auto-deploys from GitHub on every push
- Railway assigns PORT via environment variable; server reads process.env.PORT
- Environment variables configured in Railway dashboard

## Environment Variables

| Variable | Required | Where Set | Purpose |
|----------|----------|-----------|---------|
| GOOGLE_TRANSLATE_API_KEY | Yes (for translation) | Railway dashboard | Google Cloud Translation API key |
| PORT | No (auto-assigned) | Railway (automatic) | Server port |

## Current Limitations

1. **No database** — no persistent storage, no user data, no historical tracking
2. **No authentication** — completely public, no user accounts
3. **Translation degrades silently** — no user-facing warning when translation fails (Priority 1.2)
4. **No interpellation detail page** — interpellations are not clickable from the Activity feed (Priority 1.4)
5. **In-memory translation cache is volatile** — resets on every server restart, causing redundant API calls and costs (Priority 1.5)
6. **No term/session selectors on Bills page** — default query returns a narrow slice of legislative data (Priority 2 enhancement)
