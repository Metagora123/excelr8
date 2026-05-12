# Mar 11, 2026 — Implementation plan (in-app messaging + enrichment + Airtable dual-button)

> **Repo status (May 11, 2026):** Blocks 1–5 are implemented in this codebase (enrichment + preview dupes, three-pass automation + messaging toggle + streamed "Run messaging now", `/api/airtable/trigger` + `Button_Token`, `/campaign-status` + API, KPI tiles + run-log badges). Supabase migration SQL must be applied on both projects (`docs/may-11-supabase-migration.sql`). Remaining work is manual smoke tests and deploy.

**Target deploy:** Tue Mar 11, 2026
**Branch:** `feature/mar-11-in-app-messaging`
**Scope owner:** Musab + Claude pair-coding
**Code-change budget:** keep changes minimal; reuse existing patterns (streamed inline routes, `run_logs[].leads[]`, `isTransient`).

---

## 1. Status table (single source of truth)

These are the Airtable Hitlist `status` field values after this PR ships. Same names will appear in `lead_campaigns.message_status` (mirror) and in the KPI dashboard.

| Status | Meaning | Set by | Allowed next states |
|---|---|---|---|
| `fresh` | New lead. Awaiting invite. Also the home for leads waiting on a transient-error retry. | Initial table append; transient retry leaves the row here. | `invited`, `invite_failed`, `fresh` (no change on transient) |
| `invited` | Unipile invite accepted by LinkedIn. Awaiting acceptance from the lead. | Invite pass success. | `to_be_messaged`, `invited` (still pending) |
| `to_be_messaged` | Lead has accepted the connection request. Ready for Message_1. | Acceptance-detection pass: Unipile reports `degree === "1"`. | `message_1_sent`, `messaging_failed` |
| `message_1_sent` | Message_1 delivered. Waiting on `Tempo_2` (default 3 days) before sending Message_2. | Messaging pass success on M1. | `message_2_sent`, `messaging_failed` |
| `message_2_sent` | Message_2 delivered. Waiting on `Tempo_3` (default 3 days) before sending Message_3. | Messaging pass success on M2. | `messaged`, `messaging_failed` |
| `messaged` | Message_3 delivered. Sequence complete. **Terminal.** | Messaging pass success on M3. | (terminal) |
| `invite_failed` | Unipile permanently refused the invite (already invited, already connected, daily quota, missing provider_id, etc.). **Terminal.** | Invite pass permanent failure. | (terminal) |
| `messaging_failed` | A message send permanently failed (rare — usually means lead un-accepted or blocked). **Terminal.** | Messaging pass permanent failure. | (terminal) |

**Transient errors** (HTTP 408, 425, 429, 5xx, network exception) never change `status`. They log `step = "retry_pending"` in `run_logs` and the row is retried on the next cron run, same rule we already use for invites.

### Lifecycle diagram

```
                                  +───────── transient retry ────────+
                                  ▼                                  │
                            ┌──────────┐                             │
                            │  fresh   │─────────────────────────────┘
                            └────┬─────┘
                                 │ invite OK
                                 ▼
                            ┌──────────┐    permanent fail   ┌──────────────┐
                            │ invited  │────────────────────▶│ invite_failed│
                            └────┬─────┘                     └──────────────┘
                                 │ acceptance detected (degree=1)
                                 ▼
                            ┌─────────────────┐
                            │ to_be_messaged  │──────────────┐
                            └────┬────────────┘              │
                                 │ Tempo_1 elapsed           │
                                 ▼                            │ (any send
                            ┌─────────────────┐               │ permanently
                            │ message_1_sent  │──────────────▶│ fails)
                            └────┬────────────┘               │
                                 │ Tempo_2 elapsed            │
                                 ▼                            ▼
                            ┌─────────────────┐    ┌──────────────────┐
                            │ message_2_sent  │───▶│ messaging_failed │
                            └────┬────────────┘    └──────────────────┘
                                 │ Tempo_3 elapsed
                                 ▼
                            ┌─────────────────┐
                            │     messaged    │  (terminal)
                            └─────────────────┘
```

---

## 2. Summary of changes (high level)

1. **Enrichment moves fully in-app** for all CSV sizes. `maxDuration` bumped to 300s, progress streamed live to the UI (`47 / 100 leads enriched`). Failed leads dropped silently and surfaced in a small summary. Drops the "≥25 leads → n8n" branch.
2. **CSV preview gets cross-campaign duplicate detection.** Rows whose `profile_url` already lives in another campaign are highlighted yellow with a small "Also in: campaign-A, campaign-B" badge.
3. **New cron passes** for in-app campaign lifecycle:
   - **Acceptance pass** (always-on): walks `invited` rows, re-fetches Unipile profile, flips to `to_be_messaged` when `degree === "1"`.
   - **Messaging pass** (per-campaign toggle): walks `to_be_messaged` / `message_1_sent` / `message_2_sent` rows whose tempo is due and sends the next message via Unipile DM endpoint. Hard cap of **30 DMs / Unipile account / day**.
4. **Per-campaign toggle** on `/campaign-automations`: `In-app messaging: off / on` (default off). When on, cron runs the messaging pass. Also exposes a **Run messaging now** button that streams progress in the same UX as campaign creation.
5. **Second Airtable button** per Hitlist row. The existing n8n button is left untouched. A new "in-app" button is added that calls our dashboard, validates the campaign's UUID token, and triggers the messaging pass for that single row. Returns a small HTML confirmation page.
6. **New dashboard page** `/campaign-status` — Lead Campaign Status Dashboard. Two views: **By lead** (search a lead, see all campaigns + each campaign's trajectory) and **By campaign** (pick a campaign, see all leads with a horizontal status timeline). Pulled from `lead_campaigns.message_status` + `run_logs`.
7. **Schema integrity fixes (Block 4):**
   - Add `to_be_messaged`, `message_1_sent`, `message_2_sent`, `messaged`, `invite_failed`, `messaging_failed` as singleSelect choices on the Hitlist `status` field.
   - Add `Button_Token` (hidden text) and `In_App_Button` (button field) columns.
   - Add `typecast: true` to `updateAirtableRecord` so future enum mismatches don't get silently swallowed.
   - One-shot **safe** migration of legacy `to_be_messaged` rows → `invite_failed` only when matching `run_logs` confirms failure origin.
8. **KPI dashboard** gets two new tiles: **To be messaged** (count of accepted-awaiting-message) and **Messaged** (terminal). "Send failed" tile renamed to **Invite failed**. Run-logs drawer adds badges for `accepted`, `message_1_sent`, `message_2_sent`, `messaged`, `messaging_failed`.

---

## 3. Detailed changes — by block

### Block 1 — Enrichment fully in-app + duplicate detection

#### Files touched
- `app/api/campaign-manager/inline/route.ts` — change `maxDuration` from 120 → 300; remove the `> 25` → n8n branch.
- `lib/campaign-manager-inline.ts` — inside the enrichment loop, emit a `{ type: "enrichment_progress", done, total, currentLeadName }` event after each lead.
- `app/campaign-manager/page.tsx` — replace the static "Lead enrichment" checkpoint with a progress block (linear bar + `47 / 100` + current lead name + soft ETA).
- `app/api/campaign-manager/preview/route.ts` — after parsing, run one Supabase query: `SELECT campaign_id, campaigns.name FROM lead_campaigns JOIN campaigns ON … WHERE profile_url IN (…parsed_urls)`. Group by `profile_url`. Attach `existing_campaigns: [{id, name}]` to each preview row.
- `app/campaign-manager/page.tsx` (preview UI) — yellow row background + badge column when `existing_campaigns.length > 0`. Hover shows campaign ids.

#### Behaviour
- Failed enrichment for a single lead → log to `run_logs` with `step: "enrichment_failed"`, continue with the next lead. Final summary shows `n_succeeded / n_total` with a click-to-expand list of failed lead names.
- Vercel Pro 300s budget supports ~100 leads at ~3s per lead. Beyond that we hit the wall — explicit warning in the UI when CSV exceeds 100 rows: *"Large CSVs may be cut off after 5 minutes. Consider splitting."* (Background-queue solution noted for a future iteration.)

#### Acceptance criteria
- Create a 60-lead campaign → all enriched in-app, progress bar advances live, no n8n trigger fires.
- Re-upload the same CSV in a different campaign → preview shows yellow rows + badge for every row.

---

### Block 2 — In-app message scheduler (campaign-level)

#### Database schema changes (Supabase)

```sql
-- lead_campaigns: track per-lead messaging progress (internal only, no Airtable mirror)
alter table lead_campaigns
  add column message_status text default 'fresh' check (message_status in (
    'fresh','invited','to_be_messaged',
    'message_1_sent','message_2_sent','messaged',
    'invite_failed','messaging_failed'
  )),
  add column message_1_sent_at timestamptz,
  add column message_2_sent_at timestamptz,
  add column message_3_sent_at timestamptz,
  add column acceptance_detected_at timestamptz;

-- in_app_campaign_automations: messaging toggle + Airtable button token
alter table in_app_campaign_automations
  add column messaging_runner text not null default 'off'
    check (messaging_runner in ('off','in_app')),
  add column messaging_quota_daily int not null default 30,
  add column messages_sent_today int not null default 0,
  add column messages_sent_today_date date,
  add column airtable_button_token text not null default gen_random_uuid();
```

#### Files touched
- `lib/campaignAutomationQueries.ts` — split the runner into three callable passes:
  - `runInvitePass(automationId)` (existing logic, refactored to a named function)
  - `runAcceptancePass(automationId)` — **new**
  - `runMessagingPass(automationId)` — **new**
  - Top-level `runCampaignAutomation` orchestrates all three: invite → accept → (if `messaging_runner === 'in_app'`) message.
- `app/api/campaign-automations/run-scheduled/route.ts` — already calls `runCampaignAutomation`; no change needed since it now does all three passes.
- `app/api/campaign-automations/[id]/route.ts` — add a `POST ?action=run-messaging` variant that streams progress. Existing `run` action still works for invite-only behaviour.
- `app/campaign-automations/page.tsx` — toggle + **Run messaging now** button per row.
- `lib/env.ts` — no change.

#### Acceptance detection pass (`runAcceptancePass`)

```text
for each Airtable row where status = 'invited':
  identifier = resolveIdentifierFromProfileUrl(row.linkedin_url)
  res = unipile.fetchProfileWithDetails(identifier)

  if isTransient(res.statusCode): leave row, log retry_pending, continue
  if res.profile == null: log unipile_profile_error, leave row, continue

  degree = String(res.profile.degree ?? res.profile.connection_degree ?? "")
  if degree === "1" or degree === "1st":
    airtable.patch(row.id, { status: 'to_be_messaged' })
    lead_campaigns.update where lead+campaign matches:
      message_status = 'to_be_messaged'
      acceptance_detected_at = now()
    log lead with step: 'accepted'
```

#### Messaging pass (`runMessagingPass`)

```text
if automation.messaging_runner === 'off': return

# reset daily counter if date changed
if automation.messages_sent_today_date != today:
  messages_sent_today = 0
  messages_sent_today_date = today

for each Airtable row where status ∈ {to_be_messaged, message_1_sent, message_2_sent}:
  if messages_sent_today >= messaging_quota_daily: break

  # decide which message
  if status == 'to_be_messaged':
    next = 1
    tempo_field = row.Tempo_1 (default 0)
    baseline = acceptance_detected_at
  elif status == 'message_1_sent':
    next = 2
    tempo_field = row.Tempo_2 (default 3)
    baseline = message_1_sent_at
  elif status == 'message_2_sent':
    next = 3
    tempo_field = row.Tempo_3 (default 3)
    baseline = message_2_sent_at

  tempo_days = parseTempoOrDefault(tempo_field, defaults[next])
  if today < baseline + tempo_days: continue   # not due yet

  # If Tempo_X is blank/invalid, write the default we used back to Airtable so user sees it
  if rowTempoIsBlank: airtable.patch(row.id, { ['Tempo_' + next]: defaults[next] })

  # send
  res = unipile.sendMessage(provider_id, row['Message_' + next])
  if isTransient(res.statusCode): leave row, log retry_pending, continue
  if !res.ok:
    airtable.patch(row.id, { status: 'messaging_failed' })
    lead_campaigns.update message_status = 'messaging_failed'
    log step: 'messaging_failed'
    continue

  new_status = (next === 3) ? 'messaged' : 'message_' + next + '_sent'
  airtable.patch(row.id, { status: new_status })
  lead_campaigns.update:
    message_status = new_status
    'message_' + next + '_sent_at' = now()
  messages_sent_today += 1
  log step: 'message_' + next + '_sent'

automation.messages_sent_today := updated counter
```

#### Default tempos

| Step | Field | Default if blank/invalid (auto-written to Airtable) |
|---|---|---|
| Before Message_1 | `Tempo_1` | **0 days** (send immediately on accept) |
| Before Message_2 | `Tempo_2` | **3 days** after `message_1_sent_at` |
| Before Message_3 | `Tempo_3` | **3 days** after `message_2_sent_at` |

`parseTempoOrDefault(value, fallback)`: trims, parses as base-10 integer, returns the integer if it's `>= 0` and `<= 90`, otherwise the fallback. Defensive against negative numbers, decimals, words, etc.

#### Daily message quota

- Hard cap: 30 messages per Unipile account per day, configurable per automation via `messaging_quota_daily`.
- Counter `messages_sent_today` resets at UTC midnight (cheap: `messages_sent_today_date` comparison on read).
- When cap hits during a run, remaining leads are simply skipped and picked up tomorrow.

#### UI on `/campaign-automations`

```
─── Campaign A ──────────────────────────────────────────────
   schedule: Daily 6 UTC          [ Run invite now ]
   ───────────────────────────────────────────────────────────
   In-app messaging:  [ off | on ]    Daily quota: [30] DMs
   Today: 4 / 30 sent
                                       [ Run messaging now ]
   ───────────────────────────────────────────────────────────
   Last 3 runs: …
```

The **Run messaging now** button opens a streamed progress overlay (`3 / 12 messages sent…`) identical in pattern to the campaign-creation flow.

#### Acceptance criteria
- Toggle off → daily cron runs invite + acceptance passes only.
- Toggle on → daily cron runs all three; messaging respects tempos and daily quota.
- "Run messaging now" with `messaging_runner = off` still works (manual override).
- 429 from Unipile during messaging → row stays in current status, run logs show `retry_pending`, no Airtable change.

---

### Block 3 — Second Airtable button (n8n stays, in-app added)

#### Files touched
- `lib/campaign-manager-inline.ts`:
  - `HITLIST_TABLE_FIELDS`: add `Button_Token` (hidden text) and `In_App_Button` (singleLineText with a button formula — Airtable doesn't have a true "button" field type in the metadata API, so we use a `formula` field that returns a URL the user can click. Existing n8n button uses the same trick.)
  - New helper `getInAppHitlistButtonFormula(dashboardBaseUrl)` that returns the formula string.
  - `getHitlistButtonFormula()` (n8n) — **unchanged**, both buttons coexist.
- `app/api/airtable/trigger/route.ts` — **new**. Handles `GET` with `campaign_id`, `record_id`, `action`, `token` query params.

#### `In_App_Button` formula (copy-paste)

```
"https://YOUR-DASHBOARD-DOMAIN/api/airtable/trigger"
& "?action=message"
& "&campaign_id=" & ENCODE_URL_COMPONENT({campaign_id})
& "&record_id=" & RECORD_ID()
& "&token=" & ENCODE_URL_COMPONENT({Button_Token})
```

`YOUR-DASHBOARD-DOMAIN` is replaced at table-creation time with the value from env (`NEXT_PUBLIC_DASHBOARD_URL`).

#### Existing n8n `Hitlist_Button` formula (unchanged, for reference)

```
"https://YOUR-N8N-HOST/webhook/HITLIST-WEBHOOK-PATH"
& "?record_id=" & RECORD_ID()
& "&campaign_id=" & ENCODE_URL_COMPONENT({campaign_id})
& "&message_1=" & ENCODE_URL_COMPONENT({Message_1})
& "&message_2=" & ENCODE_URL_COMPONENT({Message_2})
& "&message_3=" & ENCODE_URL_COMPONENT({Message_3})
& "&tempo_1=" & ENCODE_URL_COMPONENT({Tempo_1})
& "&tempo_2=" & ENCODE_URL_COMPONENT({Tempo_2})
& "&tempo_3=" & ENCODE_URL_COMPONENT({Tempo_3})
```

(Exact prefix substring comes from the current `getHitlistButtonFormula` — that file is the canonical version.)

#### `GET /api/airtable/trigger` behaviour

```text
1. validate token === in_app_campaign_automations.airtable_button_token for the campaign
   → if mismatch: return 401 HTML page

2. fetch airtable row by record_id from the campaign's base+table

3. switch on row.status:
   - 'fresh'            → run single-row invite (one call to existing runner)
   - 'invited'          → run single-row acceptance check
   - 'to_be_messaged'   → run single-row messaging step (M1)
   - 'message_1_sent'   → if Tempo_2 elapsed → send M2, else show "not due until X"
   - 'message_2_sent'   → same for M3
   - 'messaged'         → return "Sequence already complete"
   - 'invite_failed'    → return "Invite previously failed — reset to 'fresh' in Airtable to retry"
   - 'messaging_failed' → return "Messaging previously failed — investigate Airtable row"

4. return small styled HTML page with the result + a link back to the dashboard's
   /campaign-status?lead=<id> view for follow-up
```

The handler is essentially "run one iteration of the right pass for one row", reusing the same `runInvitePass`, `runAcceptancePass`, `runMessagingPass` functions from Block 2 with a `recordIds` filter.

#### Acceptance criteria
- Click in-app button on a `to_be_messaged` row → Message_1 sends within ~3s, status flips to `message_1_sent`, confirmation HTML shows in new tab.
- Click in-app button on a `messaged` row → HTML says "already complete", no side effects.
- Tampered token → 401, no side effects.
- n8n button still works exactly as before (it's untouched).

---

### Block 4 — Cross-cutting

#### Files touched
- `lib/campaign-manager-inline.ts`:
  - `HITLIST_TABLE_FIELDS.status.options.choices` extended:
    ```ts
    [
      { name: "fresh" },
      { name: "invited" },
      { name: "to_be_messaged" },
      { name: "message_1_sent" },
      { name: "message_2_sent" },
      { name: "messaged" },
      { name: "invite_failed" },
      { name: "messaging_failed" },
    ]
    ```
  - `updateAirtableRecord` body: `{ fields, typecast: true }`. Future enum mismatches will auto-add choices instead of silently failing.
  - New `Button_Token` and `In_App_Button` columns in `HITLIST_TABLE_FIELDS` (see Block 3).
- `lib/campaignAutomationQueries.ts`:
  - On first invocation per automation, run `migrateLegacyToBeMessaged(automationId)` once (idempotent — checks a flag `legacy_migrated` on the automation row).
  - Migration rule: a row currently `status='to_be_messaged'` flips to `status='invite_failed'` ONLY IF the automation's `run_logs` contains a `leads[]` entry for that `airtable_record_id` with `step ∈ {invite_failed, profile_not_found, unipile_profile_error}`. Otherwise the row is left untouched.
  - Migration steps + skipped rows are logged in `run_logs` under `step: "legacy_migration"`.
- `app/api/kpi/route.ts` + `app/kpi/page.tsx`:
  - Two new tiles: **To be messaged**, **Messaged**.
  - **Send failed** → **Invite failed** (label change).
  - Run-logs drawer adds badges + filters for: `accepted`, `message_1_sent`, `message_2_sent`, `messaged`, `messaging_failed`, `enrichment_failed`, `legacy_migration`.
- `lib/campaignQueries.ts` — no breaking changes (KpiTotals already trimmed in last PR).

#### Migration SQL (one-time, run by hand on each Supabase project)

```sql
alter table in_app_campaign_automations
  add column if not exists messaging_runner text not null default 'off'
    check (messaging_runner in ('off','in_app')),
  add column if not exists messaging_quota_daily int not null default 30,
  add column if not exists messages_sent_today int not null default 0,
  add column if not exists messages_sent_today_date date,
  add column if not exists airtable_button_token text not null default gen_random_uuid(),
  add column if not exists legacy_migrated boolean not null default false;

alter table lead_campaigns
  add column if not exists message_status text default 'fresh' check (message_status in (
    'fresh','invited','to_be_messaged',
    'message_1_sent','message_2_sent','messaged',
    'invite_failed','messaging_failed'
  )),
  add column if not exists message_1_sent_at timestamptz,
  add column if not exists message_2_sent_at timestamptz,
  add column if not exists message_3_sent_at timestamptz,
  add column if not exists acceptance_detected_at timestamptz;
```

I'll deliver this as a numbered SQL file under `docs/` so it's easy to copy into Supabase.

---

### Block 5 — Lead Campaign Status Dashboard (new page)

#### Files touched
- `app/campaign-status/page.tsx` — **new**.
- `app/api/campaign-status/route.ts` — **new**. Returns either single-lead trajectory or full campaign roster.
- `components/app-sidebar.tsx` — add nav item between **Campaign Automations** and **KPI Dashboard**.

#### Views

**Tab 1 — By lead**
- Search input: type lead name / linkedin url / email.
- Result: a single lead's card with a timeline showing every campaign they're in, current status per campaign, and timestamps for each lifecycle event (`invited at`, `accepted at`, `message_1_sent_at`, …, `messaged at`).

**Tab 2 — By campaign**
- Campaign picker (reuses the dropdown from KPI Dashboard).
- Result: one row per lead. Each row is a horizontal pill train (`fresh ━ invited ━ to_be_messaged ━ M1 ━ M2 ━ messaged`) with the current step highlighted in colour and timestamps on hover.
- Filter pills at top: `Show only: [ all | invited | to_be_messaged | messaged | failures ]`.
- Search inside the campaign by lead name.

#### Data source

```sql
SELECT
  l.id, l.full_name, l.profile_url,
  c.id as campaign_id, c.name as campaign_name,
  lc.message_status,
  lc.acceptance_detected_at,
  lc.message_1_sent_at, lc.message_2_sent_at, lc.message_3_sent_at,
  lc.joined_at, lc.status as legacy_status
FROM lead_campaigns lc
JOIN leads l ON l.id = lc.lead_id
JOIN campaigns c ON c.id = lc.campaign_id
WHERE lc.campaign_id = $1 -- or l.id = $1, depending on view
ORDER BY l.full_name
```

#### Acceptance criteria
- Type a lead's full name → see their journey across every campaign they touch.
- Pick a campaign → see all leads as a status train; filter to "failures" to drill into stuck leads.
- One click on a lead row → opens the matching run-logs drawer from KPI dashboard (reuses the existing component).

---

## 4. Day-by-day timeline (Mar 3 → Mar 11)

| Day | Date | Work |
|---|---|---|
| 1 | Tue Mar 3 | Plan approved (today). Block 4 SQL migration written; sent to user for manual run on both Supabase projects. |
| 2 | Wed Mar 4 | Block 4 code: schema additions to `HITLIST_TABLE_FIELDS`, `typecast: true`, legacy-migration helper. Block 1 code: drop `>25` branch, bump `maxDuration`, stream `enrichment_progress` events. |
| 3 | Thu Mar 5 | Block 1 UI: live progress bar + per-lead label. Block 1 preview: cross-campaign duplicate detection. |
| 4 | Fri Mar 6 | Block 2 backend: refactor `runCampaignAutomation` into three named passes; implement `runAcceptancePass`. |
| 5 | Mon Mar 9 | Block 2 backend: implement `runMessagingPass` (tempo math, daily quota, Tempo-back-write). Unit tests on tempo parser. |
| 6 | Tue Mar 10 (AM) | Block 2 UI: toggle + Run messaging now button + streamed progress overlay. Block 3 backend: `/api/airtable/trigger` route. |
| 6 | Tue Mar 10 (PM) | Block 3 schema: `Button_Token` and `In_App_Button` columns added to new table creation; backfill helper for existing tables via metadata API. |
| 7 | Wed Mar 11 (AM) | Block 5: `/campaign-status` page + API. KPI tile renames and additions. Run-logs drawer badge updates. |
| 7 | Wed Mar 11 (PM) | Smoke test against `sales2k25`, run build, deploy. Update `client-docs/campaign-manager-automations.md`, `client-docs/flows.md`, and `docs/2-WEEK-PROGRESS.md` Section 10 (continuation). |

Buffer: Sat Mar 7 + Sun Mar 8 are slack days if any block runs long.

---

## 5. Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Vercel Pro 300s budget insufficient for 200+ lead enrichment | Medium | Hard warning in UI at 100 leads; document the limit. Background-queue migration is in scope for a future iteration but not Mar 11. |
| Unipile DM endpoint returns 403 on non-accepted leads we *think* are accepted | Low | Acceptance pass re-fetches every cron; messaging pass also checks `degree` is still 1 right before sending. Belt + braces. |
| LinkedIn rate-limits a sender mid-run | Medium | 30/day hard cap per Unipile account; transient retry pattern handles 429 without losing leads. |
| Legacy `to_be_messaged` rows where the run_logs cross-reference can't confirm "invite failure origin" | Medium | Migration leaves those rows untouched. They show as `to_be_messaged` in the dashboard until human action — added a banner on `/campaign-status` flagging un-migratable rows for review. |
| Airtable button-field formula limit (~16K chars in a singleSelect) | Low | The new formula is ~250 chars; well under the limit. |
| Two buttons per row clutter the Airtable UI | Low | They live in separate columns; users can hide either column. Default Airtable view will hide `Button_Token`. |
| User has CSV that pre-dates the new schema and contains overlapping leads | Low | Cross-campaign duplicate detection surfaces this before the campaign is created. |

---

## 6. Out of scope (explicit list)

- Real background job queue (Inngest, Vercel Queue, Trigger.dev). Streamed inline route is sufficient for current load.
- HMAC-signed Airtable button URLs. Per-campaign UUID is fine until a leak occurs.
- HubSpot sync of new statuses. Existing mapping covers `invited` and `messaged`; the new intermediate statuses can stay dashboard-only for now.
- Auto-reset of `messaging_failed` rows. Manual reset to `fresh` in Airtable is the workflow until told otherwise.
- Cancelling an in-flight n8n workflow when toggle flips to `in_app`. Out of scope; user disables the n8n workflow manually if they want to fully cut over.
- Per-lead override of `messaging_quota_daily`. Campaign-level only for now.

---

## 7. Definition of done

- [ ] All migration SQL applied to both Supabase projects.
- [ ] `npm run build` is green; TypeScript 0 errors; no new lint issues.
- [ ] Manual smoke test on `sales2k25`:
  - Create a 60-lead campaign → enriched fully in-app, progress bar visible, no n8n trigger.
  - Toggle messaging on for the test campaign → wait for cron → at least one lead transitions `to_be_messaged → message_1_sent`.
  - Click in-app Airtable button on a `to_be_messaged` row → status flips in <5s, confirmation page loads.
  - `/campaign-status` shows the lead in the right column with the right timestamps.
- [ ] `client-docs/campaign-manager-automations.md`, `client-docs/flows.md`, and `docs/2-WEEK-PROGRESS.md` updated.
- [ ] Deploy to Vercel; verify daily 6:00 UTC cron picks up the new passes.

---

## 8. Open questions (none after approval)

If you read this and disagree with anything above, push back here. Otherwise this is the contract.

- Default Tempo_1 = 0 (immediate) — confirmed
- Default Tempo_2 = 3 days — confirmed
- Default Tempo_3 = 3 days — confirmed
- Daily message quota = 30 / Unipile account — confirmed
- `messaged` = M3 sent (no separate `message_3_sent` status) — pending user confirmation
- Migration policy: only flip `to_be_messaged → invite_failed` when `run_logs` confirms failure — confirmed

---

*Generated Mar 3, 2026. Update this file as decisions change.*
