## excelr8 Dashboard

Internal dashboard for Excelr8 – campaign manager, in‑app automations, KPI, newsletters, radar, and HubSpot sync – built on Next.js (App Router), Supabase, Airtable, n8n, Unipile, and SendGrid.

Repo: [`https://github.com/MyExcelr8/excelr8`](https://github.com/MyExcelr8/excelr8)

---

## Business context

At a high level, excelr8 is the **ops and analytics layer around outbound campaigns**, sitting on top of:

- **LinkedIn** – source of leads, messages, invites, posts, and engagement.
- **Supabase** – system of record for leads, campaigns, posts, automations, and KPIs.
- **Airtable** – operator‑friendly views (hitlists and auto‑like/comment tables).
- **n8n** – execution layer for invites/messages and post engagement.
- **Unipile** – LinkedIn API wrapper (profiles, posts, people search, invites).
- **HubSpot** – downstream CRM that receives cleaned leads + campaign metrics.

Core jobs:

- Turn a **CSV of leads** into a consistent Supabase data model (`leads`, `campaigns`, `lead_campaigns`, `lead_posts`).
- Give operators **control panels** for:
  - Creating and previewing campaigns.
  - Running automations safely (rate limiting, logs, “to be messaged” queues).
  - Tracking performance (messages, invites, replies, engagement).
- Keep external tools (HubSpot, Airtable, Unipile, n8n) in **sync with Supabase**.

---

## Getting started (local)

### 1. Install dependencies

```bash
npm install
```

### 2. Environment

Copy `.env.example` to `.env` and fill in values as needed:

```bash
cp .env.example .env
```

For Campaign Manager and in‑app automations you will typically need at least:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`
- `N8N_WEBHOOK_URL`, `N8N_CAMPAIGN_TEST_ENDPOINT`, `N8N_CAMPAIGN_PROD_ENDPOINT`
- `N8N_API_URL`, `N8N_API_KEY`, `N8N_AUTO_LIKE_WORKFLOW_ID`, `N8N_HITLIST_WORKFLOW_ID`

Optional integrations:

- Unipile (`UNIPILE_API_KEY`, `UNIPILE_ACCOUNT_ID`, `UNIPILE_API_BASE`)
- HubSpot (`HUBSPOT_ACCESS_TOKEN` or `HUBSPOT_PERSONAL_ACCESS_KEY`)
- SendGrid (`SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL_2`, `SENDGRID_FROM_NAME`)

For **scheduled** campaign automations on Vercel, set `CRON_SECRET` (see [Scheduled automations](#scheduled-automations)).

You can sanity‑check the Campaign Manager env with:

```bash
npm run check:campaign-env        # static checks
npm run check:campaign-env:live   # also ping Supabase, Airtable, n8n
```

### 3. Run the dev server

```bash
npm run dev
```

Then open `http://localhost:3000`.

The main areas:

- `/campaign-manager` – CSV → Supabase leads, campaign rows, Airtable hitlist/auto‑like tables, n8n workflows, in‑app enrichment.
- `/campaign-automations` – in‑app hitlist automations (per‑campaign), “Run now”, run logs. Schedules (Daily, Every 6h, etc.) are run by **Vercel Cron**; see [Scheduled automations](#scheduled-automations) below.
- `/kpi` – top‑level KPIs from `campaigns` + `in_app_campaign_automations`.
- `/newsletter` – weekly newsletter generator (content + images + HTML).
- `/radar` – LinkedIn post radar using `lead_posts` + Unipile.

---

## High‑level architecture

### Frontend (Next.js App Router)

- **Tech**: Next.js 16 (app router), React 19, Tailwind 4, shadcn/ui, TanStack Table.
- **Key pages**:
  - `app/campaign-manager/page.tsx` – campaign creation UI (n8n + in‑app flow), CSV preview, Airtable schema preview, button‑URL formulas.
  - `app/campaign-automations/page.tsx` – automation list, schedule picker, “Run now” + run logs.
  - `app/kpi/page.tsx` – KPI dashboard aggregating metrics from `campaigns` and `in_app_campaign_automations`.
  - `app/newsletter/page.tsx` – weekly newsletter tool (curation + AI content + images + HTML export).
  - `app/radar/page.tsx` – LinkedIn post radar (top posts, commentators, reactioners from `lead_posts`).
  - `app/dossiers/page.tsx` – dossiers / lead research view.

APIs are implemented as **route handlers** under `app/api/**` and stream NDJSON for long‑running tasks (e.g. campaign inline flow, newsletter generation).

### Backend data model (Supabase)

Main tables (see `docs/SUPABASE-SCHEMA.md` and `docs/supabase-schema-only.sql`):

- **`leads`** – normalized lead records (name, title, company, LinkedIn URL, enrichment fields, `is_campaigned` flag).
- **`campaigns`** – source of truth for campaigns (name, status, `total_leads`, KPI counters like `messages_sent`, `invites_sent`, `replies_received`, `comments_made`, `likes_reactions`, and links to Airtable tables).
- **`lead_campaigns`** – join table: which lead is in which campaign (and for which client).
- **`lead_posts`** – LinkedIn posts per lead (content, counts, and embedded `commentators` / `reactioners` JSON).
- **`in_app_campaign_automations`** – configuration + metrics + `run_logs` for hitlist automations.
- **`unipile_accounts`** – Unipile sender accounts (for invites).

Two Supabase projects are supported:

- `"sales2k25"` – default / sandbox datasource.
- `"prod2k26"` – production datasource.

The active project flows from the UI into all relevant API routes via a `project` query param or form field; Supabase client helpers accept a `SupabaseProject` type.

### Integrations

- **Airtable**
  - Campaign Manager creates:
    - **Hitlist table** (`HITLIST-…`) for invite/message workflow.
    - **Auto Like / Auto Comment table** (`AUTO-LIKE-COMMENT-…`) for post engagement.
  - Schemas are cloned via Airtable Metadata API or a static fallback, and summarized visually for operators.
  - Button URL formulas are copied manually from `/campaign-manager` (Auto Like / Comment and Hitlist formulas).

- **n8n**
  - Classic flow: Campaign CSV → n8n webhooks (now mainly superseded by in‑app flow).
  - In‑app flow: after creating Airtable tables, n8n workflows are **duplicated** from templates via `N8N_API_URL` and wired to the right tables.
  - Hitlist automations page calls n8n only indirectly; the main logic for invites lives in `lib/campaignAutomationQueries.ts` using Unipile.

- **Unipile**
  - In‑app enrichment (`lib/enrichment-engine.ts`):
    - Resolve LinkedIn slug → Unipile `provider_id` (direct + people search fallback).
    - Fetch profile and update lead fields (headline, company, followers, connections, contact info, avatar, status).
    - Fetch top posts and, per post, fetch comments + reactions → stored into `lead_posts.commentators` / `reactioners`.
  - Hitlist automations use Unipile again to actually send invites.

- **HubSpot**
  - `lib/hubspot.ts` + `app/api/hubspot/sync/route.ts`:
    - Map Supabase leads/campaigns into HubSpot contacts + deals.
    - Sync basic KPIs and optionally add notes summarizing LinkedIn activity (via `lead_posts`).

- **SendGrid**
  - Used for transactional or test emails (`scripts/test-sendgrid.js`), and can be wired into newsletter flows if needed.

---

## Scheduled automations

The schedules you set in Campaign Automations (e.g. **Daily (6:00)**, **Every 6 hours**) are enforced by **Vercel Cron**, not by the app alone.

1. **`vercel.json`** defines a cron that hits `/api/campaign-automations/run-scheduled` every **hour** (`0 * * * *`).
2. That route loads active automations for both Supabase projects, checks each `schedule_cron` and `last_run_at`, and runs any that are **due** (same logic as “Run now” – updates both `in_app_campaign_automations` and `campaigns.invites_sent`).
3. The route is protected by **`CRON_SECRET`**: Vercel sends it as `Authorization: Bearer <CRON_SECRET>` when invoking the cron. You must set `CRON_SECRET` in your Vercel project (Settings → Environment Variables). Generate a value with e.g. `openssl rand -hex 32`.

**Setup on Vercel**

- Add env var: `CRON_SECRET` = a long random string (Production, and optionally Preview).
- Deploy. Cron runs only on **Production** deployments.
- Schedules use **UTC** (e.g. “Daily (6:00)” = 6:00 UTC).

---

## Deployment checks

Before pushing to `dev` or deploying via Vercel, run:

```bash
npm run check:deploy
```

This will run:

- `npm run lint` – ESLint (including TypeScript rules)
- `npm run typecheck` – `tsc --noEmit`
- `npm run build` – Next.js production build

All three must pass for a clean deployment.

---

## Useful scripts

From `package.json`:

- `npm run dev` – Next.js dev server.
- `npm run build` / `npm start` – production build + start.
- `npm run lint` – ESLint.
- `npm run typecheck` – TypeScript type‑check only.
- `npm run check:deploy` – lint + typecheck + build.
- `npm run check:campaign-env` / `check:campaign-env:live` – validate env + external services for Campaign Manager.
- `npm run test:airtable-campaign-tables` – dry‑run creation of hitlist + auto‑like Airtable tables.
- `npm run hubspot:test` – test HubSpot API key.

Some of these hit real external services (Airtable, HubSpot, SendGrid), so prefer running them against non‑production credentials first.
