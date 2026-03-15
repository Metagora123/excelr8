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
- **Hitlist automation run:** Loads automation (base + table, Unipile account). Lists Airtable rows with `status = 'fresh'`. For each row: if Message_1 is empty, fetches lead and lead_posts from Supabase, calls OpenAI to generate Message_1/2/3, writes them to Airtable. Then resolves LinkedIn profile via Unipile and sends invite; on success sets Airtable status to **invited** and increments **campaigns.invites_sent** and automation counters; on failure sets status to **to_be_messaged** and logs. All Supabase reads/writes use the **same project** (e.g. sales2k25).
- **Auto Like:** Table is populated once at campaign creation from **lead_posts**. n8n (or another runner) reads that table and performs likes/comments; the dashboard does not run the like/comment actions itself.

---

## Lead status (Hitlist / in-app automation)

Each row in the **Airtable Hitlist** table has a **status** field. The automation only processes rows with status **fresh**; after a run it sets rows to **invited** or **to_be_messaged**. You can also mark leads as **messaged** when you’ve sent the first message (e.g. after they accept the connection).

| Status | Meaning |
|--------|--------|
| **fresh** | New lead, not yet processed by the automation. Next run will try to generate Message_1/2/3 (if empty) and send the connection invite. |
| **invited** | Connection invite was **sent successfully**. Lead may or may not have accepted yet; once they accept, you send Message_1/2/3 (manually or via n8n) and can then set status to **messaged**. |
| **to_be_messaged** | **Invite step failed** (profile not found, Unipile error, or invite rejected). This does **not** mean “they accepted, ready to message.” It means the automation could not complete the invite; the row is for manual follow-up or retry. Automation will not retry unless you set status back to **fresh**. |
| **messaged** | First message (Message_1/2/3) has been sent. Use this **only after** the lead has accepted the invite and you’ve sent the first message. |

**Important:** “To be messaged” in the app = **invite failed**, not “accepted and waiting for our message.” Leads who have accepted and are ready for Message_1/2/3 are still in status **invited** until you send the message and set them to **messaged**.

**Automation counters** (per automation, in Supabase): **total_invites_sent**, **invites_sent_today**, **total_to_be_messaged**, **total_rejected**. In the app table, **Invites** = invites sent successfully; **To message** = count of rows where the invite step failed (to_be_messaged). **total_rejected** counts leads rejected by Unipile/LinkedIn during the run.

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

## Limits & behaviour

- **Create In-App:** Serverless timeout (e.g. 120 s on Vercel Hobby). When leads are **≤ 25**, enrichment runs **in-app** (Unipile per lead). When leads are **&gt; 25**, enrichment is **not** run in-app; instead the app triggers the **on-demand enrichment n8n flow** (webhook) with the campaign and lead data, and n8n enriches leads asynchronously. So you can create campaigns with more than 25 leads; only the enrichment step switches to n8n.
- **Message generation:** Runs per “fresh” row when Message_1 is empty; requires OpenAI key. Failures are logged but don’t block the invite step.
- **Invites:** Subject to Unipile and LinkedIn rate limits. Automation run logs show success/failure per lead.
- **Cron:** On Vercel Hobby, cron runs once per day (e.g. 6:00 UTC); “Every 6h” etc. still only run when that single daily cron fires unless you use an external scheduler.

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| Airtable 404 NOT_FOUND | **AIRTABLE_BASE_ID** wrong or base deleted/no access. Check base URL and token permissions; see README/env-check. |
| Timeout on Create In-App | Reduce to ≤25 leads per run or split CSV; ensure enrichment and Airtable are not failing mid-run. |
| No invites sent | Confirm automation has **airtable_base_id** and **airtable_table_id**; Unipile account and API key; Airtable rows with status **fresh** and valid LinkedIn URL. |
| Messages not generated | Ensure **OPENAI_API_KEY** is set; check run logs for `messages_error`. |
| Campaign invites_sent not updating | Automation must have **campaign_id**; run uses same Supabase project as the campaign. Check run logs for errors. |

---

## Related flows

For flow diagrams open **flows.pdf** in this folder (sections: Create In-App Campaign, Hitlist automations, Auto Like / Auto Comment).
