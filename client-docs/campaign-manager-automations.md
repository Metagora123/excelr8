# Campaign Manager & Campaign Automations – Client documentation

## Overview

**Campaign Manager** is where you turn a **CSV of leads** into a full campaign: the system creates the campaign and lead records in Supabase, optionally enriches leads (LinkedIn profile + posts), creates Airtable tables (Hitlist and Auto Like/Comment), duplicates n8n workflows, and can create an in-app automation record. **Campaign Automations** then run on a schedule or on demand: they send connection invites from the Hitlist (via Unipile), generate personalized outreach messages (Message_1/2/3) when missing, and update Airtable and Supabase so the dashboard and CRM stay in sync.

**Who uses it:** Ops and campaign owners who run LinkedIn outbound and want one flow from CSV to live campaigns, invites, and metrics.

**When to use it:** When you have a new list of leads (CSV), a client and campaign naming (category, managed by), and want to run invites and message generation in a controlled way with full logs and counters.

---

## Business value

- **Single flow:** From CSV to campaign, leads, Airtable tables, and n8n workflows in one “Create In-App” run.
- **Controlled invites:** One automation per campaign; invites go through Unipile with rate limiting and clear status (invited / to_be_messaged / rejected).
- **Personalized messages:** AI-generated Message_1, Message_2, Message_3 using Supabase lead data and lead_posts, so Airtable has ready-to-use copy.
- **Visibility:** Run logs per automation (who was invited, who failed, generated messages), and updated counters on both the automation and the campaign in Supabase.
- **Same project everywhere:** The whole run uses one Supabase project (e.g. sales2k25); the campaign’s `invites_sent` is updated in that same project.

---

## How it works (user perspective)

### Campaign Manager

1. Upload a **CSV** (with at least full name or profile URL per row). Optionally use **Preview** to see parsed rows and **remove** rows you don’t want (excluded rows are not used when you click Create).
2. Choose **client**, **category**, **managed by**, **Supabase project**, and options: enable Airtable (Hitlist, Auto Like), n8n workflow duplication, enrichment, and in-app automation.
3. Click **Create Campaign In-App**. The app creates the campaign and leads, runs enrichment (Unipile profile + posts → `lead_posts`), creates Airtable tables (Hitlist with leads, Auto Like with rows from `lead_posts`), duplicates n8n workflows, and optionally creates an automation row. You see checkpoints and any errors in the UI.
4. You get **links** to the Airtable tables and n8n workflows and (if enabled) an automation you can run or schedule.

### Campaign Automations

1. Open **Campaign Automations** and pick the **Supabase project**. You see the list of automations (one per campaign that has a Hitlist and was set up for automation).
2. For each automation you can set **schedule** (e.g. Daily 6:00, Every 6h) and click **Run now** to run once.
3. When a run executes (manually or via cron), the system fetches Airtable rows with status **fresh**, generates Message_1/2/3 if they’re empty (using Supabase leads + `lead_posts`), sends connection invites via Unipile, then updates Airtable status and Supabase (**in_app_campaign_automations** and **campaigns.invites_sent**). Run logs show per-lead outcome and the generated messages.
4. **Auto Like / Auto Comment** uses the Auto Like Airtable table (filled from `lead_posts`) and n8n workflows; the dashboard creates the table and workflow; execution (like/comment) runs in n8n.

---

## How it works (system / data)

- **Create In-App:** Parses CSV (with optional exclude rows), creates campaign row and upserts leads and **lead_campaigns** in Supabase. **Enrichment:** if leads ≤ 25 and Unipile key is set, runs in-app enrichment (Unipile per lead, writes **lead_posts**). If leads &gt; 25, skips in-app enrichment and triggers the **on-demand enrichment n8n flow** (webhook) with campaign and lead data; n8n enriches leads asynchronously. Then creates Airtable Hitlist table and appends one record per lead; creates Auto Like table and appends one record per **lead_posts** row (for that campaign’s leads; when enrichment was on-demand, **lead_posts** may be filled later by n8n). Then duplicates n8n Hitlist and Auto Like workflows and optionally creates **in_app_campaign_automations** row.
- **Hitlist automation run:** Loads automation (base + table, Unipile account). Lists Airtable rows with `status = 'fresh'`. For each row: if Message_1 is empty, fetches lead and lead_posts from Supabase, calls OpenAI to generate Message_1/2/3, writes them to Airtable. Then resolves LinkedIn profile via Unipile and sends invite. Outcome handling:
  - **Success** → Airtable `status = invited`. The runner increments `in_app_campaign_automations.total_invites_sent` (the KPI source of truth) and also mirrors the count to `campaigns.invites_sent` for back-compat with legacy n8n nodes / external dashboards.
  - **Permanent failure** (4xx other than 429, missing `provider_id`, LinkedIn refusal) → Airtable `status = to_be_messaged`, `total_to_be_messaged++`, the lead is logged with the specific `step` (`invite_failed`, `profile_not_found`, or `unipile_profile_error`) so the KPI dashboard can sort it into the right bucket.
  - **Transient failure** (HTTP 408 / 425 / 429 / 5xx, or network exception with no status code) → Airtable status is **left unchanged at `fresh`**. The lead is logged with `step = retry_pending` and `transient = true`. No counter is bumped. The next cron run will retry the same row automatically.
  - **Bad input** (no LinkedIn URL or malformed URL) → no Unipile call, `step = skip`, `total_rejected++`.
  
  All Supabase reads/writes use the **same project** (e.g. sales2k25).
- **Auto Like:** Table is populated once at campaign creation from **lead_posts**. n8n (or another runner) reads that table and performs likes/comments; the dashboard does not run the like/comment actions itself.
- **Auto Comment automation:** A separate automation per campaign (when the campaign has an Auto Like Airtable table). **Run now** reads the Auto Like table, and for each row that has **post_content** and no **comment_a** yet, calls OpenAI to generate 4 comments (styles A–D) in the same language as the post, then writes **comment_a**, **comment_b**, **comment_c**, **comment_d** back to Airtable. Prompt and styles are in `lib/auto-comment-prompts.ts` (Style A Defend POV, B Gratitude, C Personalized Impact, D Hook with Surprise; max 65 words each; same language as post).

---

## Lead status (Hitlist / in-app automation)

As of **Mar 11, 2026** the Hitlist `status` field uses an 8-state lifecycle. The old 4-state model (where `to_be_messaged` confusingly meant "invite failed") is replaced by an explicit failure status (`invite_failed`) and a new "accepted, awaiting Message_1" status that re-uses the `to_be_messaged` label with its plain-English meaning.

| Status | Meaning | Set by |
|---|---|---|
| **fresh** | New lead, awaiting invite. Also the home for leads waiting on a transient-error retry. | Initial table append; transient retry stays here. |
| **invited** | Unipile accepted the invite. Awaiting LinkedIn acceptance from the lead. | Invite pass success. |
| **to_be_messaged** | Lead has accepted the connection request. Ready for Message_1. | Acceptance pass (Unipile reports `degree=1`). |
| **message_1_sent** | Message_1 delivered. Waiting on `Tempo_2` (default 3 days) before Message_2. | Messaging pass. |
| **message_2_sent** | Message_2 delivered. Waiting on `Tempo_3` (default 3 days) before Message_3. | Messaging pass. |
| **messaged** | Message_3 delivered. Sequence complete. **Terminal.** | Messaging pass. |
| **invite_failed** | Unipile permanently refused the invite (already invited, connected, quota, missing provider_id, profile unreachable). **Terminal.** | Invite pass permanent failure. |
| **messaging_failed** | A message send permanently failed (rare — usually lead un-accepted or blocked us). **Terminal.** | Messaging pass permanent failure. |

**Legacy migration:** Rows that pre-date Mar 11 may still be sitting on the old `to_be_messaged` meaning ("invite failed"). On the first run after deployment, `migrateLegacyToBeMessaged(automationId)` walks those rows and flips them to `invite_failed` **only if** the campaign's `run_logs` confirm the row failed at the invite step. Rows we cannot confirm are left untouched and surfaced as a "needs human review" badge on `/campaign-status`. The migration is idempotent (gated by `in_app_campaign_automations.legacy_migrated`).

### Transient vs permanent failures

Errors are classified at run time. The runner uses an `isTransient(statusCode)` helper that flags an error as retryable when the Unipile response is HTTP `408`, `425`, `429`, any `5xx`, or there is no status code at all (network exception):

- **Transient → retry pending:** the run logs an entry with `step = retry_pending` and `transient = true`. The Airtable status is unchanged. The lead is not counted in any failure tile. The next cron run will attempt it again. This applies to invite AND messaging passes.
- **Permanent (invite) → invite_failed:** the runner sets the Airtable row to `invite_failed` and the lead is counted in the **Invite failed** tile (or **Profile unreachable** when the Unipile profile lookup is what failed).
- **Permanent (messaging) → messaging_failed:** the runner sets the Airtable row to `messaging_failed`. Usually means the lead un-accepted the connection between passes.

### Transient vs permanent failures

Errors are now classified at run time. The runner uses a `isTransient(statusCode)` helper that flags an error as retryable when the Unipile response is HTTP `408`, `425`, `429`, any `5xx`, or there is no status code at all (network exception):

- **Transient → retry pending:** the run logs an entry with `step = retry_pending` and `transient = true`. The Airtable status stays at `fresh`. The lead is not counted in any failure tile. The next cron run will attempt it again.
- **Permanent → to_be_messaged:** the runner sets the Airtable row to `to_be_messaged` and the lead is counted in either **Send failed** (LinkedIn refused) or **Profile unreachable** (private / restricted / 404), depending on `step`.

### Automation counters (per automation, in Supabase)

The columns on `in_app_campaign_automations` continue to track:

- **total_invites_sent** — successful invites (single source of truth for the KPI dashboard).
- **invites_sent_today** — same as above but reset per day, used for daily quota visibility.
- **total_to_be_messaged** — cumulative invite-acceptance events (i.e. how many leads have transitioned `invited → to_be_messaged`).
- **total_rejected** — cumulative rows skipped because the LinkedIn URL was missing/invalid, OR permanent invite failures (`invite_failed`).
- **messaging_runner** — `off` (default) or `in_app`. When on, the daily cron also runs the messaging pass.
- **messaging_quota_daily** — hard cap on DMs sent per day for this automation. Default 30.
- **messages_sent_today** / **messages_sent_today_date** — daily messaging counter, auto-resets at UTC midnight.
- **airtable_button_token** — per-campaign UUID. Same value is stamped on every Hitlist row's `Button_Token` field; the `/api/airtable/trigger` route validates clicks against it.
- **legacy_migrated** — one-shot flag so `migrateLegacyToBeMessaged` runs at most once per automation.

### KPI dashboard buckets

The KPI dashboard exposes the following tiles (sourced from `run_logs[].leads[].step` plus current-state counts from `lead_campaigns.message_status`):

| KPI tile | Source | What it really means |
|---|---|---|
| **Invites Sent** | `total_invites_sent` column | Genuinely delivered invites. Source of truth = `in_app_campaign_automations` only. |
| **To be messaged** | `lead_campaigns.message_status = 'to_be_messaged'` | Currently waiting for Message_1 (accepted by lead, not yet messaged). |
| **Messaged** | `lead_campaigns.message_status = 'messaged'` | Full M1/M2/M3 sequence delivered. Terminal. |
| **Invite failed** | `step = invite_failed` | LinkedIn refused the invite (already invited / connected / quota / flagged). Renamed from "Send failed" on Mar 11. |
| **Profile unreachable** | `step ∈ {profile_not_found, unipile_profile_error}` | Profile private / restricted / deactivated / 404. No usable `provider_id`. |
| **Skipped — bad input** | `step = skip` | Airtable row had no LinkedIn URL or it was malformed. We never called Unipile. |
| **Retry pending** | `step = retry_pending` or `transient = true` | Transient errors (429 / 5xx / network). Will be retried on the next cron run. |

The run-logs drawer adds badges + filters for the new lifecycle events: `accepted`, `message_1_sent`, `message_2_sent`, `messaged`, `messaging_failed`, and `legacy_migration`.

### "View run logs" drawer

On the per-campaign panel of the KPI dashboard, click **View run logs** to open a drawer with the full per-lead history pulled from `run_logs`. You'll see:

- 5 mini-tiles at the top (the bucket counts above, scoped to this campaign).
- An automation-status strip with the last run timestamp, status, and cumulative DB counters.
- A search box that matches LinkedIn URL, error string, Unipile response snippets, decision, and Airtable record ID.
- Filter pills with live counts (All / Invited / Send failed / Profile unreachable / Skipped / Retry pending).
- One card per lead per attempt, each showing: colour-coded step badge, clickable LinkedIn URL, Airtable record ID, decision, profile HTTP status, invite HTTP status, error block, collapsible "Profile response snippet", collapsible "Invite response snippet", and collapsible "Generated outreach messages" (Message_1/2/3).

This is the recommended way to answer "why did 46 leads fail?" — the breakdown by step + the raw Unipile response for each lead is one click away.

### Supabase lead status (separate)

**Supabase lead status** (optional, on the **leads** table): **new**, **interested**, **invited**, **messaged**, **in_progress**, **not interested**, **unqualified**. This is separate from the Hitlist status and is used for pipeline/CRM (e.g. HubSpot sync maps it to `hs_lead_status`).

---

## Data and integrations

- **Supabase:** Campaigns, leads, lead_campaigns, lead_posts, in_app_campaign_automations. One project per run (sales2k25 or prod2k26).
- **Airtable:** Hitlist table (leads, campaign_id, Message_1/2/3, status, etc.); Auto Like table (lead_name, post_content, commentators, reactioners, etc.). Tables live in the base specified by **AIRTABLE_BASE_ID**.
- **Unipile:** Profile resolution (LinkedIn identifier → provider_id), connection invite send. Uses **UNIPILE_ACCOUNT_ID** and API key.
- **OpenAI:** Message_1/2/3 generation (prompt in `lib/outreach-message-prompts.ts`). Uses **OPENAI_API_KEY**.

---

## Prompts (outreach Message_1 / Message_2 / Message_3)

**Module:** Hitlist automation. When a row has status **fresh** and **Message_1** is empty, the app generates three message variations via OpenAI.  
**Source:** `lib/outreach-message-prompts.ts` (`SYSTEM_PROMPT`, `buildOutreachUserPrompt`).

### System prompt (default)

```
You are an expert at writing personalized, contextual outreach messages for business professionals.

Write THREE short, personalized introductory message variations (2-3 sentences maximum each) for the following lead. Each message should:
- Be warm and professional
- Reference something specific from their background or company
- Provide context for what you do in ONE clear sentence
- DO NOT ask for a meeting in this first email - instead, ask if they'd be interested or open to learning more
- Be written in a language and tone appropriate for their location
- Avoid being overly salesy or generic
- Focus on providing value and solving a pain point, not just pitching
- Build curiosity and rapport as this is the first touchpoint

Message Type: INITIAL_COLD_OUTREACH (Day 1 - First touchpoint)

Tone Guidelines for Initial Outreach:
- Curious and helpful, focused on their challenges
- Lead with value, not product features
- Reference a specific pain point relevant to their industry/role
- Explain what you do in one simple, clear sentence
- End by asking for INTEREST, not a meeting (e.g., "Would this be interesting to you?" or "Would you be open to learning more?")
- Keep it conversational - write like a human, not a marketing bot
- AVOID phrases like: "schedule a call", "book a meeting", "demo", "quick chat"
- USE phrases like: "would this interest you?", "curious if this resonates?", "worth exploring?"

Language Guidelines:
- If location contains "France" or French-speaking region: Write in French
- If location contains "Spain" or Spanish-speaking region: Write in Spanish
- If location contains "Germany" or German-speaking region: Write in German
- Default: Write in English for all other locations

Return ONLY valid JSON with no markdown or extra text. Format:
{ "message_1": "...", "message_2": "...", "message_3": "..." }
Each value must be the full message text (2-3 sentences). Generate three distinct variations that feel human, relevant, and show you've done your research.
```

### User prompt (per lead)

The user message is built from lead and post data. Template shape:

- **Lead block:** Full Name, Company, Job Title/Description, Location, Company Domain, Headline, LinkedIn Profile, Number of Followers; optionally About/Summary (trimmed to 800 chars); optionally **Recent LinkedIn activity** from `lead_posts` (trimmed to 1500 chars).
- **Closing line:** “Generate three personalized message variations (message_1, message_2, message_3) that feel human, relevant, and show you've done your research. Return only the JSON object.”

Expected JSON output: `{ "message_1": "...", "message_2": "...", "message_3": "..." }`.

---

## Prerequisites & setup

- **Supabase:** At least one project with **campaigns**, **leads**, **lead_campaigns**, **lead_posts**, **in_app_campaign_automations** (and **clients**, **unipile_accounts** if used). **SUPABASE_URL**, **SUPABASE_SERVICE_ROLE_KEY** (and project-specific vars if you use prod2k26).
- **Airtable:** **AIRTABLE_API_KEY** (PAT with schema + data scope), **AIRTABLE_BASE_ID** (base where Hitlist and Auto Like tables are created).
- **Unipile:** **UNIPILE_API_KEY**, **UNIPILE_ACCOUNT_ID** (and optionally **UNIPILE_API_BASE**). Default sender can be set per automation or via env.
- **OpenAI:** **OPENAI_API_KEY** for message generation (optional but recommended).
- **n8n:** **N8N_API_URL**, **N8N_API_KEY**, **N8N_AUTO_LIKE_WORKFLOW_ID**, **N8N_HITLIST_WORKFLOW_ID** if you want workflow duplication.
- **Cron (scheduled runs):** **CRON_SECRET** and a cron job (e.g. Vercel cron or external) calling the run-scheduled API with that secret.

---

## In-app messaging (Mar 11)

As of Mar 11, every automation has a per-campaign toggle on `/campaign-automations`:

```
─── Campaign A ──────────────────────────────────────────────
   schedule: Daily 6 UTC          [ Run invite now ]
   In-app messaging:  [ Off | On ]   Quota: [30] DMs/day · 4/30 sent today
                                              [ Run messaging now ]
```

The daily cron always runs:

1. **Invite pass** — picks up `status='fresh'` rows and sends LinkedIn invites via Unipile.
2. **Acceptance pass** — picks up `status='invited'` rows, re-fetches the Unipile profile, and flips them to `status='to_be_messaged'` when `degree=1`.

When `messaging_runner='in_app'`, it also runs:

3. **Messaging pass** — picks up `to_be_messaged` / `message_1_sent` / `message_2_sent` rows whose tempo is due and sends the next message (M1/M2/M3) via Unipile DM (`POST /api/v1/chats`). Daily cap is `messaging_quota_daily` (default 30). Counter `messages_sent_today` resets at UTC midnight.

**Tempos.** Each row has `Tempo_1`, `Tempo_2`, `Tempo_3` (integers in days). If any is blank or invalid, the runner uses the default and writes the default back to Airtable so the user can see what was used.

| Step | Field | Default if blank |
|---|---|---|
| Before Message_1 | `Tempo_1` | **0 days** (send immediately on accept) |
| Before Message_2 | `Tempo_2` | **3 days** after `message_1_sent_at` |
| Before Message_3 | `Tempo_3` | **3 days** after `message_2_sent_at` |

**Run messaging now** is a button per row that streams progress live (`3 / 12 messages sent…`). It bypasses the toggle and the tempo timer, so you can force-fire pending messages for testing or after a manual reset.

### Airtable in-app button (per Hitlist row)

Each new Hitlist table gets a hidden `Button_Token` text column (stamped with the campaign's UUID at creation time). The campaign now exposes **two** button formulas in Campaign Manager:

- The existing n8n button (unchanged).
- A new **in-app button** pointing to `/api/airtable/trigger`.

Paste the in-app formula into a new Airtable Button column (`In_App_Button`). When clicked it:

1. Validates `Button_Token` against `in_app_campaign_automations.airtable_button_token`.
2. Reads the row's current status and dispatches the appropriate single-row pass (invite, acceptance, or messaging).
3. Returns a small confirmation HTML page with a link back to `/campaign-status?campaign=<id>`.

Both buttons coexist; the user can hide either column.

### Lead Campaign Status Dashboard (`/campaign-status`)

New page with two views:

- **By lead** — search by name / LinkedIn URL / email. Result: every campaign the lead has touched, with a lifecycle pill train (`Fresh → Invited → Accepted → M1 → M2 → Messaged`) and per-stage timestamps on hover.
- **By campaign** — pick a campaign, see every lead as a horizontal pill train. Filter pills: `All / Fresh / Invited / Accepted / Messages in flight / Messaged / Failures`. Inline search by lead name / company / URL.

Data source: `lead_campaigns.message_status` plus the timestamp columns (`acceptance_detected_at`, `message_X_sent_at`).

---

## Limits & behaviour

- **Create In-App:** Serverless timeout bumped to **300 s** on the inline route. Enrichment now runs **fully in-app** for any CSV size (the old `>25 leads → n8n` branch is gone); live progress streams to the UI (`47 / 100 leads enriched…`). CSVs larger than ~100 leads risk hitting the 300 s wall — the UI warns when that's likely.
- **Cross-campaign duplicate detection:** the CSV preview highlights leads whose `profile_url` already lives in another campaign and shows badges with those campaign names.
- **Message generation:** Runs per “fresh” row when Message_1 is empty; requires OpenAI key. Failures are logged but don’t block the invite step.
- **Invites:** Subject to Unipile and LinkedIn rate limits. Automation run logs show success/failure per lead.
- **Messaging:** Hard cap of `messaging_quota_daily` DMs/day per automation (default 30). When the cap hits mid-run, remaining leads are skipped and picked up tomorrow.
- **Cron:** On Vercel Hobby, cron runs once per day (e.g. 6:00 UTC); “Every 6h” etc. still only run when that single daily cron fires unless you use an external scheduler.

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| Airtable 404 NOT_FOUND | **AIRTABLE_BASE_ID** wrong or base deleted/no access. Check base URL and token permissions; see README/env-check. |
| Airtable 403 INVALID_PERMISSIONS | Token lacks `schema.bases:write` on the target base, or the base is in a workspace where you are not owner. The runner now auto-falls-back to the default `AIRTABLE_BASE_ID` when the account-specific base (e.g. `AIRTABLE_BASE_URL_YVES`) returns 403. See `docs/CAMPAIGN-MANAGER-AIRTABLE-ENV.md`. |
| Timeout on Create In-App | Reduce to ≤25 leads per run or split CSV; ensure enrichment and Airtable are not failing mid-run. |
| No invites sent | Confirm automation has **airtable_base_id** and **airtable_table_id**; Unipile account and API key; Airtable rows with status **fresh** and valid LinkedIn URL. |
| Messages not generated | Ensure **OPENAI_API_KEY** is set; check run logs for `messages_error`. |
| Campaign invites_sent not updating | Automation must have **campaign_id**; run uses same Supabase project as the campaign. Check run logs for errors. The KPI dashboard reads from `in_app_campaign_automations.total_invites_sent` only — `campaigns.invites_sent` is mirrored but not displayed. |
| KPI tile shows surprisingly high "Send failed" or "Profile unreachable" | Open the per-campaign **View run logs** drawer, filter by the bucket, inspect the Unipile response snippet on each card to see the real cause. Common: many leads are already 1st-degree connections, daily quota was hit mid-run, or profiles were private. |
| Leads stuck in `fresh` after a run | Either they hit a transient error (intentional — they will retry next cron) or the automation didn't pick them up (check `is_active`, `schedule_cron`, and that `last_run_at` advanced). |

---

## Related flows

For flow diagrams open **flows.pdf** in this folder (sections: Create In-App Campaign, Hitlist automations, Auto Like / Auto Comment).
