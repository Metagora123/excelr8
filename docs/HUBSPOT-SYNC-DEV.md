# Supabase → HubSpot Sync — Developer Reference

Quick reference for how Excelr8 dashboard maps Supabase data to HubSpot. Use this when changing the sync logic or onboarding new devs.

---

## Overview

- **Direction:** One-way. Supabase is the source of truth; HubSpot is a read-only view.
- **Trigger:** On-demand only (button on **HubSpot Export** page or `POST /api/hubspot/sync`).
- **Auth:** One Private App token in `.env` (`HUBSPOT_ACCESS_TOKEN`). One portal per sync (per-client portals can be added later).

---

## What Gets Synced (High Level)

| Supabase | HubSpot | Notes |
|----------|---------|--------|
| `leads` | **Contacts** | Create/update by email when present; otherwise by profile URL |
| `campaigns` | **Deals** | Create/update by deal name |
| `lead_campaigns` | **Contact–Deal associations** | Links contact to deal |
| Lead `dossier_url` | **Note** on contact | One note per lead with dossier |
| `lead_posts` (grouped by lead) | **Note** on contact | One note: "LinkedIn: N posts. Latest: url" |

---

## 1. Leads → Contacts

**Supabase table:** `leads`  
**HubSpot object:** Contact (CRM)

| Supabase field | HubSpot property | Notes |
|----------------|------------------|--------|
| `full_name` (or `name`) | `firstname` / `lastname` | Split on first space |
| `email` | `email` | Optional; only sent when non-empty |
| `company_name` | `company` | |
| `title` | `jobtitle` | |
| `phone` | `phone` | |
| `location` | `address` | |
| `status` | `hs_lead_status` | e.g. new, qualified, messaged |
| `profile_url` | `excelr8_profile_url` (custom) | LinkedIn URL, used for fallback search and dedupe |
| `about_summary` | `linkedinbio` | Truncated to 65k chars |

**Current required gate (sync route):** A lead is skipped unless both `name` and `profile_url` are non-empty.

**Logic:** Search contact by email first (when email exists). If not found (or no email), search by `excelr8_profile_url` when available. If found → PATCH. If not → POST. No placeholder email is generated.

**Code:** `lib/hubspot.ts` → `upsertContact`, `findContactByEmail`. Sync route maps via `leadToHubSpot()` in `app/api/hubspot/sync/route.ts`.

---

## 2. Campaigns → Deals

**Supabase table:** `campaigns`  
**HubSpot object:** Deal

| Supabase field | HubSpot property | Notes |
|----------------|------------------|--------|
| `name` | `dealname` | Used to find existing deal |
| `description` | `description` | Truncated |
| `created_at` | (optional) | Can map to `started_at` / custom |
| `status` | (optional) | Not sent as deal stage (stage = pipeline-specific ID) |

**Logic:** Search deal by `dealname`. If found → PATCH. If not → POST. Optional: set deal stage via env `HUBSPOT_DEAL_STAGE_ID` (HubSpot pipeline stage ID).

**Code:** `lib/hubspot.ts` → `upsertDeal`, `findDealByName`. Sync route maps via `campaignToHubSpot()`.

---

## 3. Lead–Campaign Links → Contact–Deal Associations

**Supabase table:** `lead_campaigns` (columns: `lead_id`, `campaign_id`, `client_id`, `status`, `joined_at`)  
**HubSpot:** Association between Contact and Deal

**Logic:** After all contacts and deals are synced, for each `lead_campaigns` row we call HubSpot’s association API: link the contact (from `lead_id`) to the deal (from `campaign_id`). Association type: Contact to Deal (primary), type ID 3.

**Code:** `lib/hubspot.ts` → `associateContactToDeal`. Sync route loops over `leadCampaigns` and looks up HubSpot IDs from in-memory maps.

---

## 4. Dossiers → Notes on Contact

**Supabase:** Lead’s `dossier_url` (from `leads` table).  
**HubSpot:** Note attached to the contact.

**Logic:** For each lead with a non-empty `dossier_url`, create one note with body `Dossier: {url}` and associate it to that contact (association type 202).

**Code:** `lib/hubspot.ts` → `createNoteOnContact`. Sync route runs after contacts exist; uses `contactIdByLeadId` to get HubSpot contact id.

---

## 5. Lead Posts → Notes on Contact

**Supabase table:** `lead_posts` (columns: `lead_id`, `post_url`, `content`, etc.)  
**HubSpot:** Note attached to the contact.

**Logic:** Data is grouped by `lead_id` in `lib/hubspotSyncData.ts` → `getLeadPostsByLead()`. For each lead that has at least one post, create one note:  
`LinkedIn: {count} post(s). Latest: {firstPostUrl}` (or without URL if none). Associate note to contact.

**Code:** Sync route uses `postsByLead` map; calls `createNoteOnContact` once per lead with posts.

---

## Sync Order (API Route)

1. Fetch from Supabase: leads, campaigns, lead_campaigns, lead_posts (grouped by lead).
2. Upsert all leads → contacts (build `contactIdByLeadId`).
3. Upsert all campaigns → deals (build `dealIdByCampaignId`).
4. For each `lead_campaigns` row: associate contact to deal.
5. For each lead: if `dossier_url` → create note; if has posts → create note.

---

## Env & API

| Env var | Purpose |
|--------|--------|
| `HUBSPOT_ACCESS_TOKEN` | Private App access token (contacts, deals, notes, associations). |
| `HUBSPOT_DEAL_STAGE_ID` | (Optional) HubSpot pipeline stage ID for new/updated deals. |

**Endpoint:** `POST /api/hubspot/sync?project=sales2k25|prod2k26`  
**Response:** `{ ok: true, contacts, deals, associations }` or `{ error: "..." }`.

**Files:**

- `lib/env.ts` — `getHubSpotAccessToken()`
- `lib/hubspot.ts` — HubSpot API helpers
- `lib/hubspotSyncData.ts` — `getLeadPostsByLead(project)`
- `lib/campaignQueries.ts` — `getAllCampaigns`, `getLeadCampaigns`
- `lib/leadQueries.ts` — `getAllLeads`
- `app/api/hubspot/sync/route.ts` — Sync orchestration
- `app/hubspot/page.tsx` — UI: "Sync to HubSpot" button

---

## Testing HubSpot auth (token vs legacy app)

**Option A — You have an access token (Private App or from HubSpot):**  
Put it in `.env` as `HUBSPOT_ACCESS_TOKEN`, then run:

```bash
npm run hubspot:test
```

If the token is valid you’ll see: `✅ HubSpot token works. Contacts API OK.`

**Option B — Legacy app (Client ID + Client secret):**  
App ID / Client ID / Client secret **do not** replace the token. They are used to **obtain** a token via OAuth:

1. In `.env` set:
   - `HUBSPOT_CLIENT_ID=` (from Auth → App credentials)
   - `HUBSPOT_CLIENT_SECRET=` (from Auth → App credentials)
2. In HubSpot app **Auth** tab → **Redirect URLs**, add: `http://localhost:3456/callback`
3. From project root run: `npm run hubspot:oauth`
4. A browser opens → log in to HubSpot and approve the app
5. The script prints an **access token**. Copy it into `.env` as `HUBSPOT_ACCESS_TOKEN=...`
6. Run `npm run hubspot:test` to confirm, then use the dashboard sync or `POST /api/hubspot/sync` as usual.

Script: `scripts/hubspot-test-auth.js`

---

## Changing the Mapping

- **Add/remove contact fields:** Edit `LeadForHubSpot` and `upsertContact()` in `lib/hubspot.ts`, and `leadToHubSpot()` in the sync route.
- **Add/remove deal fields:** Edit `CampaignForHubSpot` and `upsertDeal()` in `lib/hubspot.ts`, and `campaignToHubSpot()` in the sync route. Ensure `getAllCampaigns` selects the new columns if they come from Supabase.
- **Dossier / posts:** Change note body in `app/api/hubspot/sync/route.ts` (the strings passed to `createNoteOnContact`).
- **New Supabase table → HubSpot:** Add a fetch step, then either a new HubSpot object type or more notes/associations; keep the same “fetch → map → upsert” pattern.
