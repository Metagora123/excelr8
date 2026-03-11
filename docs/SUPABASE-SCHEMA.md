# Supabase schema

Reference for all Supabase tables used by the excelr8 dashboard, with column types and one example row per table.

---

## Table: `leads`

Used in: Dashboard, Dossiers, `lib/leadQueries.ts`, `/api/dashboard`, `/api/dossiers`.

| Column                | Type     | Description                          |
|-----------------------|----------|--------------------------------------|
| `id`                  | string   | Primary key                          |
| `name`                | string?  | Display name                         |
| `title`               | string?  | Job title                            |
| `company`             | string?  | Company name                         |
| `location`            | string?  | Location / country                   |
| `email`               | string?  | Email                                |
| `phone`               | string?  | Phone                                |
| `status`              | string?  | Lead status (e.g. New, Contacted)    |
| `tier`                | string?  | Tier (e.g. A, B, C)                  |
| `score`               | number?  | Lead score                           |
| `is_dossier`          | boolean? | Whether lead has a dossier           |
| `dossier_url`         | string?  | Link to dossier                      |
| `profile_url`         | string?  | LinkedIn profile URL                 |
| `profile_picture_url` | string?  | Avatar URL                           |
| `about_summary`       | string?  | About / summary text                 |
| `personality`         | string?  | Personality notes                    |
| `expertise`           | string?  | Expertise areas                      |
| `tech_stack_tags`     | string?  | Tech stack / skills                  |
| `company_description` | string?  | Company description                  |
| `followers_count`     | number?  | LinkedIn followers                   |
| `connections_count`   | number?  | LinkedIn connections                 |
| `created_at`          | string?  | ISO timestamp                        |
| `campaign_name`       | string?  | Associated campaign name             |

### Example row

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "Jane Smith",
  "title": "Head of Engineering",
  "company": "Acme Corp",
  "location": "San Francisco, CA",
  "email": "jane.smith@acme.com",
  "phone": null,
  "status": "Contacted",
  "tier": "A",
  "score": 85,
  "is_dossier": true,
  "dossier_url": "https://app.example.com/dossiers/550e8400",
  "profile_url": "https://linkedin.com/in/janesmith",
  "profile_picture_url": "https://media.example.com/avatar.jpg",
  "about_summary": "Engineering leader with 10+ years in SaaS.",
  "personality": null,
  "expertise": "React, Node.js, AWS",
  "tech_stack_tags": "TypeScript, PostgreSQL",
  "company_description": "B2B SaaS platform.",
  "followers_count": 1200,
  "connections_count": 500,
  "created_at": "2025-01-15T14:30:00.000Z",
  "campaign_name": "Q1 Outbound"
}
```

---

## Table: `dossiers`

Used in: Dossiers page, `lib/leadQueries.ts` (`getWithDossiers()`). Rows are mapped to `LeadRow`; aliases like `lead_id`, `lead_name`, `company_name`, `url` are supported.

| Column        | Type     | Description                    |
|---------------|----------|--------------------------------|
| `id`          | string   | Primary key (or dossier id)    |
| `lead_id`     | string?  | FK to leads.id                |
| `name`        | string?  | Lead name (or `lead_name`)     |
| `title`       | string?  | Job title (or `job_title`)     |
| `company`     | string?  | Company (or `company_name`)    |
| `location`    | string?  | Location (or `country`)        |
| `status`      | string?  | Status                         |
| `tier`        | string?  | Tier (or `tier_level`)         |
| `score`       | number?  | Score (or `lead_score`)        |
| `dossier_url` | string?  | Dossier link (or `url`, `link`)|
| `campaign_id` | string?  | FK to campaigns.id            |
| `created_at`  | string?  | ISO timestamp                  |
| *(others)*    | *        | Same shape as leads when merged|

### Example row

```json
{
  "id": "doss-abc-123",
  "lead_id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "Jane Smith",
  "title": "Head of Engineering",
  "company": "Acme Corp",
  "location": "San Francisco, CA",
  "status": "Contacted",
  "tier": "A",
  "score": 85,
  "dossier_url": "https://app.example.com/dossiers/550e8400",
  "campaign_id": "camp-xyz-456",
  "created_at": "2025-02-01T09:00:00.000Z"
}
```

---

## Table: `clients`

Used in: Campaign Manager, `lib/campaignQueries.ts`, `/api/campaigns/clients`.

| Column | Type    |
|--------|---------|
| `id`   | string  |
| `name` | string? |

### Example row

```json
{
  "id": "client-001",
  "name": "Metagora"
}
```

---

## Table: `campaigns`

Used in: KPI Dashboard, `lib/campaignQueries.ts`, `/api/kpi`.

| Column             | Type     | Description        |
|--------------------|----------|--------------------|
| `id`               | string   | Primary key        |
| `name`             | string?  | Campaign name      |
| `status`           | string?  | e.g. Active, Done  |
| `created_at`       | string?  | ISO timestamp      |
| `messages_sent`    | number?  | Messages sent      |
| `invites_sent`     | number?  | Invites sent       |
| `replies_received` | number?  | Replies received   |
| `comments_made`    | number?  | Comments made      |
| `likes_reactions`  | number?  | Likes / reactions  |

### Example row

```json
{
  "id": "camp-xyz-456",
  "name": "Q1 Outbound",
  "status": "Active",
  "created_at": "2025-01-01T00:00:00.000Z",
  "messages_sent": 450,
  "invites_sent": 200,
  "replies_received": 38,
  "comments_made": 12,
  "likes_reactions": 89
}
```

---

## Table: `lead_posts`

Used in: Radar API, `app/api/radar/route.ts`. Fetched by `linkedin_post_id` or `post_url`; can contain embedded commentators and reactioners.

| Column             | Type     | Description                    |
|--------------------|----------|--------------------------------|
| `id`               | string?  | Primary key                    |
| `content`          | string?  | Post text content              |
| `post_url`         | string?  | LinkedIn post URL              |
| `linkedin_post_id` | string?  | e.g. `urn:li:activity:123`     |
| `created_at`       | string?  | ISO timestamp                  |
| `lead_name`        | string?  | Author display name            |
| `lead_company`     | string?  | Author company/headline        |
| `reactions`        | number?  | Total reaction count           |
| `comments`         | number?  | Total comment count            |
| `commentators`     | array?   | `[{ id, name, headline, profile_url, text, date }]` |
| `reactioners`      | array?   | `[{ id, name, profile_url, reaction_type, date }]`   |

### Example row

```json
{
  "id": "post-uuid-789",
  "content": "Excited to share our new product launch...",
  "post_url": "https://www.linkedin.com/feed/update/urn:li:activity:7123456789",
  "linkedin_post_id": "urn:li:activity:7123456789",
  "created_at": "2025-02-10T16:45:00.000Z",
  "lead_name": "Jane Smith",
  "lead_company": "Acme Corp",
  "reactions": 24,
  "comments": 5,
  "commentators": [
    {
      "id": "conn-1",
      "name": "John Doe",
      "headline": "CTO at Beta Inc",
      "profile_url": "https://linkedin.com/in/johndoe",
      "text": "Congrats!",
      "date": "2025-02-10T17:00:00Z"
    }
  ],
  "reactioners": [
    {
      "id": "conn-2",
      "name": "Alice Lee",
      "profile_url": "https://linkedin.com/in/alicelee",
      "reaction_type": "LIKE",
      "date": "2025-02-10T16:50:00Z"
    }
  ]
}
```

---

## Table: `in_app_campaign_automations`

Used in: Campaign Automations page, KPI Dashboard, `lib/campaignAutomationQueries.ts`, `/api/campaign-automations`, `/api/kpi`.

One row per campaign that has in-app hitlist automation. Run logs and metrics are stored here; “Run now” also updates `campaigns.invites_sent`.

| Column                      | Type     | Description                                    |
|-----------------------------|----------|------------------------------------------------|
| `id`                        | string   | Primary key                                    |
| `campaign_id`               | string   | FK to campaigns.id (UNIQUE)                    |
| `airtable_base_id`          | string   | Airtable base for hitlist                      |
| `airtable_table_id`         | string   | Airtable table id for hitlist                  |
| `schedule_cron`             | string   | e.g. `0 6 * * *`                               |
| `is_active`                 | boolean  | Whether automation is active                   |
| `default_unipile_sender_id` | string?  | FK to unipile_accounts.id                     |
| `total_invites_sent`        | number   | Total invites sent by this automation         |
| `invites_sent_today`        | number   | Invites sent today                            |
| `total_to_be_messaged`      | number   | Leads marked to_be_messaged                   |
| `total_rejected`            | number   | Rejected / skipped                            |
| `last_run_at`               | string?  | Last run timestamp                            |
| `last_run_status`           | string?  | success / partial / error                     |
| `run_logs`                  | array    | One object per run; each has `leads` with step, degree, Unipile status/response |
| `created_at`                | string   | ISO timestamp                                 |
| `updated_at`                | string   | ISO timestamp                                 |

### Example run_logs entry

```json
{
  "run_date": "2026-03-11",
  "started_at": "2026-03-11T05:49:00.000Z",
  "finished_at": "2026-03-11T05:49:01.000Z",
  "status": "success",
  "invited_count": 3,
  "to_be_messaged_count": 0,
  "rejected_count": 0,
  "leads": [
    {
      "linkedin_url": "https://linkedin.com/in/jane-doe",
      "step": "invited",
      "unipile_degree": "2",
      "decision": "invited",
      "unipile_profile_status": 200,
      "unipile_invite_status": 200
    }
  ]
}
```

---

## Summary

| Table                          | Purpose                                      |
|--------------------------------|----------------------------------------------|
| `leads`                        | All leads; dashboard & dossiers              |
| `dossiers`                     | Dossier subset (optional source)             |
| `clients`                      | Clients for campaign manager                 |
| `campaigns`                    | Campaigns and KPI metrics (invites_sent etc.)|
| `unipile_accounts`             | Unipile sender accounts (Campaign Automations)|
| `lead_campaigns`               | Which lead is in which campaign per client   |
| `lead_messages`                | Messages / threads per lead                  |
| `lead_posts`                   | LinkedIn posts for Radar view                |
| `in_app_campaign_automations`  | Hitlist automation config, run logs, metrics; Campaign Automations page + KPI |

To capture the current schema from your Supabase project, use the Supabase dashboard (Table Editor → export or SQL) or run the SQL from `docs/supabase-schema-only.sql` in a new project. The `in_app_campaign_automations` table is also defined in `docs/in-app-campaign-automations.sql`.
