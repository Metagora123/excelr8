# Excelr8 Dashboard — 2-Week Progress Report

**Project:** Excelr8 Dashboard (AI Automation Services)  
**Reporting period:** ~2 weeks (Feb 20 – Feb 23, 2026)  
**Prepared for:** Client presentation (Upwork)

---

## Executive Summary

Over the past two weeks, the Excelr8 Dashboard project was **scaffolded, migrated to Next.js, and core features were implemented**. The app is a full-featured internal dashboard for AI automation: lead management, dossiers, Post Radar (LinkedIn analysis), campaign management, KPI tracking, and newsletter generation. The codebase is production-ready with API routes, Supabase integration, and deployment configuration (Vercel).

---

## 1. Project Setup & Foundation

| Deliverable | Status | Notes |
|-------------|--------|--------|
| Next.js 16 app scaffold | ✅ | Created from Create Next App (Feb 20) |
| TypeScript | ✅ | Full TS across app, lib, components |
| Tailwind CSS v4 | ✅ | Theming, animations, responsive layout |
| shadcn/ui components | ✅ | 25+ UI primitives (cards, tables, charts, sidebar, etc.) |
| Theme provider (light/dark) | ✅ | next-themes, system/default/light/dark |
| App shell & sidebar navigation | ✅ | Collapsible sidebar, nav for all 7 main sections |

**Tech stack:** Next.js 16, React 19, Supabase, Recharts, Radix UI, Tailwind CSS, TypeScript.

---

## 2. Pages Delivered

All routes from the original project specification have been implemented in the Next.js app:

| Page | Route | Description |
|------|--------|-------------|
| **Dashboard** | `/dashboard` | Lead stats, pie/bar/line charts, recent leads table, refresh, fallback mock data |
| **File Ingestion** | `/ingestion` | CSV upload to n8n webhook (test/prod endpoints) |
| **Dossiers** | `/dossiers` | List and detail view of leads with dossiers (Supabase) |
| **Post Radar** | `/radar` | LinkedIn post URL → Supabase/Unipile, commentators/reactioners, ICP filter (OpenAI) |
| **Campaign Manager** | `/campaign-manager` | Campaign creation, client select, category, CSV upload to n8n |
| **KPI Dashboard** | `/kpi` | Campaign KPIs: summary cards, progress bars, bar charts (Supabase campaigns) |
| **Newsletter** | `/newsletter` | R2 date folders, file list, generate newsletter via n8n |

Landing redirect: `/` → `/dashboard` (or equivalent entry).

---

## 3. Backend & Data Layer

| Component | Status | Details |
|-----------|--------|---------|
| **API routes** | ✅ | Server-side routes under `app/api/` |
| **Dashboard API** | ✅ | `GET /api/dashboard` — aggregates lead stats, timeline, recent leads |
| **Dossiers API** | ✅ | `GET /api/dossiers` — leads with dossiers, pagination-ready |
| **KPI API** | ✅ | `GET /api/kpi` — campaign KPI totals and list |
| **Campaign clients** | ✅ | `GET /api/campaigns/clients` — client list for Campaign Manager |
| **Radar** | ✅ | `GET /api/radar`, `GET /api/radar/icp` — Post Radar data/ICP |
| **Newsletter** | ✅ | `POST /api/newsletter/generate`, date-folders and files routes |
| **Ingestion** | ✅ | `POST /api/ingestion` — CSV to n8n/Supabase pipeline |
| **Campaign Manager** | ✅ | `POST /api/campaign-manager` — campaign creation webhook |
| **Supabase client** | ✅ | `lib/supabase.ts` — server-side client from env |
| **Lead queries** | ✅ | `lib/leadQueries.ts` — getAll, getWithDossiers, stats |
| **Campaign queries** | ✅ | `lib/campaignQueries.ts` — getAll, getKpiTotals |
| **Env handling** | ✅ | `lib/env.ts`, `lib/env-n8n.ts` — validated env for API keys and URLs |

Dashboard and other pages use **fallback mock data** when the API or Supabase is unavailable, so the UI remains usable during setup or outages.

---

## 4. UI & UX Highlights

- **App shell:** Consistent header, sidebar (with EXCELR8 branding and “AI Automation”), and main content area across all pages.
- **Dashboard:** Stat cards (Total Leads, With Dossiers, Average Score, Data Source), Leads by Status (pie), Leads by Tier (bar), Lead Growth Timeline (line), Recent Leads table with link to Dossiers.
- **Charts:** Recharts integrated via shadcn chart components; theme-aware colors.
- **Loading states:** Skeleton loaders on Dashboard and elsewhere where data is fetched.
- **Error handling:** API errors surface messages with fallback to mock data where applicable.
- **Documentation:** `Project Spec.md`, `Project Plan`, and `docs/SCHEMA-REFERENCE.md` for schema and Supabase/Airtable alignment.

---

## 5. Deployment & DevOps

| Item | Status |
|------|--------|
| **Vercel configuration** | ✅ | `vercel.json` added (Feb 22) for correct routing/deployment |
| **Environment variables** | ✅ | Documented in Project Spec and `.env`; used in API routes and libs |
| **Build** | ✅ | `npm run build` succeeds; app ready for production deploy |

---

## 6. Git History (Last 2 Weeks)

- **Feb 20:** Initial commit from Create Next App  
- **Feb 22:** Initial project commit (Dashboard, pages, API, Supabase, components)  
- **Feb 22:** Post Radar optimized  
- **Feb 22:** Vercel JSON added  

---

## 7. What’s Ready for the Client

1. **Full set of pages** matching the original spec: Dashboard, Ingestion, Dossiers, Post Radar, Campaign Manager, KPI, Newsletter.  
2. **API layer** for all features, with Supabase and n8n integration points.  
3. **Stable, modern stack** (Next.js 16, React 19, TypeScript, Tailwind, shadcn).  
4. **Deployment path** via Vercel and clear env documentation.  
5. **Docs** for spec, plan, and schema so the client or future developers can maintain or extend the app.

---

## 8. Suggested Next Steps (Optional)

- Configure production env vars (Supabase, n8n, Unipile, OpenAI, R2) in Vercel.  
- Add authentication (e.g. NextAuth or custom login) if the client requires protected access.  
- Run end-to-end tests against real Supabase and n8n once credentials are available.  
- Optional: Add Airtable sync/mirror if the client uses Airtable as a source (schema reference already documented).

---

## 9. Continuation — Feb 24 to Mar 3, 2026

This section captures work shipped on top of the v1 above. The build (`npm run build`) is green, all 50 routes compile and TypeScript passes with no errors.

### 9.1 In-app automation: source-of-truth shift away from n8n

We are moving off n8n for invite execution. `in_app_campaign_automations` is now the single source of truth for invite outcomes:

- The KPI dashboard reads invites only from `in_app_campaign_automations.total_invites_sent` (the legacy `campaigns.invites_sent` column is still mirrored for back-compat with n8n nodes / external dashboards but is no longer summed into the KPI tile, eliminating a double-count bug).
- Per-campaign metrics on the KPI page now come from `run_logs` aggregation, not stale counter columns.

### 9.2 Transient errors are no longer counted as "Invite failed"

Previously, every Unipile error rolled into a single `total_to_be_messaged` counter labelled "Invite failed". That bundled four very different categories together and counted things that should have been retried.

A new `isTransient(statusCode)` helper in `lib/campaignAutomationQueries.ts` classifies an error as retryable when:

- HTTP `408`, `425`, `429`
- HTTP `5xx`
- Network exception (no status code)

When transient:

- `step` is logged as `retry_pending` (new) with `transient: true`
- The Airtable row's `status` is left as `fresh` so the next run picks it up automatically
- The lead is **not** counted as a failure in any tile

When non-transient (4xx other than 429, missing `provider_id`, real Unipile rejection): existing behaviour — Airtable status flips to `to_be_messaged` and the row enters the failure buckets below.

### 9.3 KPI dashboard rebuilt around honest buckets

The 6-tile dashboard was replaced with a 4×2 grid pulled from `run_logs[].leads[].step`:

| Tile | Source | What it really means |
|---|---|---|
| **Campaigns** | `campaigns` row count | — |
| **Messages Sent** | `campaigns.messages_sent` | — |
| **Invites Sent** | `in_app_campaign_automations.total_invites_sent` | Genuinely delivered invites |
| **Engagement** | `campaigns.comments_made + likes_reactions` | — |
| **Send failed** | `step = invite_failed` | LinkedIn refused (already invited / connected / quota / sender flagged) |
| **Profile unreachable** | `step ∈ {profile_not_found, unipile_profile_error}` | Private / restricted / 404 |
| **Skipped — bad input** | `step = skip` | No / invalid LinkedIn URL (replaces old "Rejected" tile) |
| **Retry pending** | `step = retry_pending` or `transient = true` | 429 / 5xx / network — will retry next run |

The per-campaign details panel mirrors the same 8 metrics.

### 9.4 New endpoint: per-campaign run logs

`GET /api/kpi/campaign/[id]?project=…` aggregates every `run_logs[].leads[]` entry for a campaign, plus the campaign row and bucket totals. Returns:

```jsonc
{
  "campaign":    { "id", "name", "status", "messages_sent", … },
  "automations": [{ "id", "total_invites_sent", "runs": [ … ] }],
  "buckets":     { "invites_sent", "send_failed", "profile_unreachable", "skipped_bad_input", "retry_pending" },
  "leads":       [/* flattened across all runs, sorted newest-first */]
}
```

### 9.5 KPI dashboard: "View run logs" drawer

A new right-side drawer on the per-campaign panel (`app/kpi/page.tsx`):

- 5 mini-tiles at top: invites_sent / send_failed / profile_unreachable / bad input / retry pending.
- Automation status strip: last run timestamp + status + total runs + cumulative DB columns.
- Search: matches LinkedIn URL, error string, Unipile response snippets, decision, Airtable record ID.
- Filter pills with live counts (All, Invited, Send failed, Profile unreachable, Skipped, Retry pending).
- Per-lead cards with colour-coded step badge, clickable LinkedIn URL, Airtable record ID, profile/invite HTTP status, decision, error block, collapsible profile/invite response snippets, and collapsible generated outreach messages (Message_1/2/3).

This replaces the previous "go run SQL on `run_logs`" workflow with a one-click drill-down.

### 9.6 Airtable & campaign UX improvements

- **Hitlist URL formula** updated to use `webhook` instead of `webhook-test` for production routing.
- **Auto Like URL formula** now includes `campaign_id` as a query parameter so the n8n flow can scope its actions per campaign.
- **Empty-row cleanup**: the default empty row Airtable creates with new tables is now auto-deleted when `appendAutoLikeRecordsFromLeadPosts` writes 0 actual records.
- **Auto Comment generation** now skips a row only when **all four** of `comment_a/b/c/d` are populated (previously it skipped on `comment_a` alone, which produced incomplete sets).
- **Per-account Airtable bases**: campaigns can be created in a base specific to the responsible Unipile account (`AIRTABLE_BASE_URL_YVES`, `AIRTABLE_BASE_URL_ANNA`, `AIRTABLE_BASE_URL_HIBAT`) with automatic 403-fallback to the default `AIRTABLE_BASE_ID`. Helpers added in `lib/env.ts`: `normalizeAccountKey`, `parseAirtableBaseIdFromUrl`, `getAirtableBaseUrlByAccount`, `getAirtableBaseIdForAccount`. Env-check page now pings each configured base and reports `schema.bases:read` permission status per account.

### 9.7 Newsletter

- **File title extraction**: the file picker on the Newsletter page now displays a human-readable title for each R2 object instead of the raw key. Extraction order: HTML `<title>` → HTML `<h1>` → Markdown `# heading` → cleaned filename slug. (`<img alt>` was previously in the chain and has been removed at the user's request.) Helper `getR2ObjectHead(key, maxBytes=16384)` added to `lib/r2.ts` so we only download the first 16KB per file.
- **Prompt presets**: `newsletter_prompts` Supabase table is now powered by a CRUD layer:
  - `lib/newsletterPromptQueries.ts` — `list / create / update / remove`.
  - `app/api/newsletter/prompts/route.ts` — `GET` + `POST`.
  - `app/api/newsletter/prompts/[id]/route.ts` — `PATCH` + `DELETE`.
  - UI: a "Prompt preset" section above the Custom image / Custom HTML textareas. Selecting a preset fills both textareas; saving writes both `html_prompt` and `image_prompt` to a single row; existing presets can be updated or deleted.

### 9.8 UI gating (deprecated paths)

- **n8n workflow checkboxes** on Campaign Manager (Auto Like / Auto Comment n8n workflow, Hitlist n8n workflow) are now greyed-out, disabled, and forced to `false`. Caption: "n8n workflow duplication is currently disabled."
- **Post Radar Logging** page (`/radar-logging`) and its sidebar entry are greyed out. Sidebar logic now respects a `disabled` flag on nav items (`components/nav-main.tsx`); the page itself shows an amber banner and renders all content with `opacity-50 grayscale pointer-events-none`. Modals remain inert because all triggers are disabled.

### 9.9 HubSpot integration

- HubSpot export documented end-to-end (`docs/HUBSPOT-SYNC-DEV.md`, `docs/HUBSPOT-SYNC-BUSINESS.md`, `client-docs/hubspot.md`).
- Sync route (`app/api/hubspot/sync/route.ts`): contacts and deals are upserted by stable identifier (email + LinkedIn URL for contacts, campaign id for deals), so re-running the sync updates existing records rather than creating duplicates.
- Delete route (`app/api/hubspot/delete/route.ts`): one-shot removal of contacts / deals by id list.

### 9.10 Build & deployment readiness (Mar 3, 2026)

```
> next build
✓ Compiled successfully in 5.5s
  Running TypeScript ...  (no errors)
✓ Generating static pages using 23 workers (47/47)
```

50 routes compile, lint-clean, no TypeScript errors. Ready for Vercel deploy.

### 9.11 Open / pending items (intentionally deferred)

- **HTTP 429 retry policy refinement.** Current retry logic leaves the row at `fresh` for transient errors; it does not exponential-back-off. Acceptable for daily cron at low volume.

---

### 10. Mar 11, 2026 — Full in-app lifecycle shipped

The following landed after Section 9 was written; it supersedes the old **9.11** bullet about &quot;no acceptance detection&quot;.

- **Three-pass hitlist automation** (`lib/campaignAutomationQueries.ts`): invite → acceptance (always on) → messaging (when `messaging_runner === 'in_app'` or forced for "Run messaging now" / Airtable in-app button). Permanent invite failures write **`invite_failed`** to Airtable and mirror `lead_campaigns.message_status`. Daily DM cap per automation (default 30) with `messages_sent_today` reset by date.
- **Campaign Automations UI** (`app/campaign-automations/page.tsx`): messaging off/on toggle, quota field, streamed progress for **Run messaging now** (`POST .../campaign-automations/[id]?action=run-messaging`).
- **Airtable in-app button** (`app/api/airtable/trigger/route.ts`): validates `airtable_button_token` vs row `Button_Token`; `createHitlistTableAndAppendLeads` + inline campaign creation stamp the token (`app/api/campaign-manager/inline/route.ts`).
- **Lead Campaign Status** (`/campaign-status`, `app/api/campaign-status/route.ts`): by-lead search and by-campaign table with lifecycle pill train.
- **KPI** (`app/api/kpi/route.ts`, `app/kpi/page.tsx`): current-state counts for **To be messaged** / **Messaged** from `lead_campaigns`; **Invite failed** label; run-log filters for accepted / message sent / messaging failed.
- **Campaign Manager**: in-app enrichment for all CSV sizes (300s route), live `enrichment_progress`, preview duplicate detection by `profile_url`, CSV >100 row warning after preview.

---

*Document generated for client presentation. For full technical detail, see `Project Spec.md`, `docs/SCHEMA-REFERENCE.md`, and the per-feature pages under `client-docs/`.*
