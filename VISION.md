# VISION — Taiwan Legislative Intelligence Platform

## What This Is

A web-based intelligence platform that monitors Taiwan's Legislative Yuan and translates legislative activity into actionable, English-language business intelligence. The platform bridges the gap between raw Mandarin-language legislative data and the English-speaking analysts, investors, lawyers, and government affairs professionals who need to understand what Taiwan's parliament is doing and why it matters.

## The Problem

Taiwan's Legislative Yuan actively legislates on issues that affect billions of dollars in global business activity — semiconductor export policy, defense procurement, energy regulation, foreign investment rules, financial regulation, data privacy, trade policy, and cross-strait relations. Almost none of this is systematically tracked or translated into English in real time. The few firms that cover Taiwan (Eurasia Group, Gavekal, boutique Asia consultancies) focus on high-level geopolitical narratives, not granular legislative activity. The result is a significant information gap: companies, investors, and advisors with Taiwan exposure are either blind to legislative developments or learn about them days or weeks late through mainstream English-language media.

## Who It's For

**Primary audience (first customers):**
- Boutique Asia-focused investment funds tracking Taiwan equity or supply chain exposure
- Small-to-mid-size law firms with Taiwan or cross-border transaction practices
- Trade consultancies and government affairs firms advising clients on US-Taiwan commercial relations
- Individual analysts at larger organizations (hedge funds, defense contractors, semiconductor companies) who are personally responsible for monitoring Taiwan policy

**Secondary audience (future growth):**
- Firms registered under FARA representing Taiwanese interests in Washington (Gephardt Group, Nickles Group, etc.)
- Defense and aerospace contractors tracking Taiwan procurement and defense legislation
- Industry associations (US-Taiwan Business Council, Semiconductor Industry Association)
- Academic researchers and journalists covering Taiwan

## The Value Proposition

"You can hire a full-time Mandarin-speaking analyst for $80-120k/year, you can ignore Taiwan legislative risk entirely, or you can subscribe to this platform for a fraction of the cost and have comprehensive, real-time coverage."

For an individual analyst: "This makes you the person on your team who always knows what's happening in Taiwan before anyone else."

## Pricing Strategy

**Free tier:** Weekly digest email only — a curated summary of the most significant Legislative Yuan developments with sector tags and brief business-relevance context. This is the marketing funnel. It demonstrates value, builds an audience, and converts readers into paid subscribers.

**Paid tier ($99-149/month, or $999-1,499/year with annual discount):** Full dashboard access, sector-filtered legislative feeds, editorial "Why It Matters" summaries, bill status alerts, watchlists, and searchable legislative archive. This price point is calibrated for the target market: trivial for a professional firm expensing it, comparable to premium niche intelligence products (Sinocism, Stratfor) for individual analysts. Do not undercharge — a $29/month product signals "hobby project" to this audience, not "professional intelligence."

**Revenue math:** 50 subscribers at $99/month = ~$5,000/month. 100 subscribers at $149/month = ~$15,000/month. Operating costs are $25-80/month, so margins are extremely high once the subscriber base reaches even modest scale.

## Go-to-Market Strategy

**Phase 0 (pre-product):** Launch the free weekly digest on Substack or LinkedIn before the paid product is ready. This costs nothing and builds an audience of exactly the right people. If no one reads the free version, no one will pay for premium.

**Direct outreach via LinkedIn:** Target professionals with titles like "Asia analyst," "Taiwan," "cross-strait," "Indo-Pacific policy," "China risk" at investment firms, law firms, and consultancies. Share the digest, start conversations — not hard pitches.

**Network leverage:** Use the Marcellus SCP network, DC think tank events (CSIS, Brookings, Atlantic Council cross-strait events), the US-Taiwan Business Council, and AmCham Taipei for access to concentrations of the target audience.

**Referral-driven growth:** Once 5-10 paying subscribers exist, ask each for introductions. Professional services firms talk to each other. One satisfied analyst mentioning the product to a colleague is worth 100 cold messages.

## What It Is NOT

- It is not a general Taiwan news aggregator
- It is not a machine translation dump of legislative text
- It is not a competitor to Eurasia Group's macro geopolitical analysis — it is a complement to it, covering the operational-level legislative detail they don't touch
- It is not a lobbying or advocacy tool

## The Long-Term Vision

Phase 1 (current): A legislative monitoring dashboard with English-language summaries and sector tagging. Establish credibility through a free weekly digest that demonstrates the value.

Phase 2: Add alert/notification system, user accounts with personalized watchlists, and a searchable legislative archive. Begin charging subscriptions.

Phase 3: Expand into a full Taiwan political risk intelligence platform — integrating news, social media monitoring, executive branch actions, and cross-strait developments alongside the legislative core. Layer on advisory services for premium clients.

The platform is both a product and a career vehicle. It demonstrates a unique combination of Taiwan expertise, Mandarin fluency, policy analysis skill, and technical capability that positions the founder as a credible authority in Taiwan political risk — opening doors to consulting engagements, advisory roles, and institutional partnerships.

## Design Philosophy

The interface should feel like a professional intelligence platform — clean, fast, data-dense. Bright and modern, not dark and tactical. Design references: Quorum.us for general sensibility (not copied).

Color palette: White background. Black/dark gray text (#333333). Deep navy primary accent (#1B2A4A) for navigation, buttons, headers, and links. Muted teal secondary accent (#2A7F8E) for tags, status indicators, and highlights. Clean sans-serif typography (Inter or system font stack) — no monospace except for data/code contexts.

The overall feel should signal credibility and professionalism to business users — think Bloomberg Terminal's information density meets a modern SaaS dashboard's clarity, with a light background.

## Operating Cost Estimates (Priority 1 + 2 features)

Railway hosting (Hobby plan): $5-15/month
Google Cloud Translation API: $10-40/month (budget cap set at $40/month; will decrease significantly once persistent translation cache is implemented)
PostgreSQL database (Railway add-on or free-tier Supabase/Neon): $0-15/month
Email service (SendGrid/Resend free tier): $0/month initially
Domain/DNS: ~$1/month

**Total estimated: $15-70/month.** Marginal cost per additional subscriber is effectively zero. A handful of paying subscribers at $99-149/month covers all operating costs.
