# Schema reference & MCP verification

This doc lists the **column names and tables** the app expects. Use the **Supabase MCP** and **Airtable MCP** to verify or discover the real schema (e.g. `list_tables`, `execute_sql`, `describe_table`) and align this file and the code if needed.

---

## Supabase

### Table: `leads`

Used in: Dashboard, Dossiers, `lib/leadQueries.ts`, `/api/dashboard`, `/api/dossiers`.

| Column        | Type    | Used for |
|---------------|---------|----------|
| `id`          | string  | Primary key |
| `name`        | string? | Display, search |
| `title`       | string? | Job title (Dossiers card) |
| `company`     | string? | Display, search |
| `location`    | string? | Dossiers detail |
| `status`      | string? | Dashboard stats/charts, Badge |
| `tier`        | string? | Dashboard charts, Badge |
| `score`       | number? | Stats, timeline, table |
| `is_dossier`  | boolean?| Dossiers filter |
| `dossier_url` | string? | Dossier link, filter |
| `created_at`  | string? | Ordering, timeline |

**MCP check:** `list_tables` then inspect `leads` columns; or `execute_sql`: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'leads';`

---

### Table: `dossiers`

Used in: Dossiers page, `lib/leadQueries.ts` (`getWithDossiers()`). We try this table first; if it has rows we map them to `LeadRow` (id, name, title, company, location, status, tier, score, dossier_url, created_at). If the table has different column names, we map common aliases (e.g. `lead_id`, `lead_name`, `company_name`, `url`).

**MCP check:** `SELECT column_name FROM information_schema.columns WHERE table_name = 'dossiers';`

---

### Table: `clients`

Used in: Campaign Manager, `lib/campaignQueries.ts`, `/api/campaigns/clients`.

| Column | Type   |
|--------|--------|
| `id`   | string |
| `name` | string?|

**MCP check:** Same as above for table `clients`.

---

### Table: `campaigns`

Used in: KPI Dashboard, `lib/campaignQueries.ts`, `/api/kpi`.

| Column             | Type    |
|--------------------|---------|
| `id`               | string  |
| `name`             | string? |
| `status`           | string? |
| `created_at`       | string? |
| `messages_sent`    | number? |
| `invites_sent`     | number? |
| `replies_received` | number? |
| `comments_made`    | number? |
| `likes_reactions`  | number? |

**MCP check:** Same for table `campaigns`.

---

## Airtable (Project Plan)

Env: `VITE_AIRTABLE_API_KEY`, `VITE_AIRTABLE_BASE_ID`, `VITE_AIRTABLE_TABLE_NAME` (e.g. `Leads`).

The app currently reads **Supabase** `leads` for Dashboard/Dossiers. If you sync or mirror from Airtable, use Airtable MCP to confirm field names:

- **Airtable MCP:** `list_bases` → pick base → `list_tables` → `describe_table` for the Leads table.
- Map Airtable field names to the Supabase `leads` columns above (or update `leadQueries` to use Airtable field names if you switch the source).

---

## If column names differ

1. **Supabase:** Run `execute_sql` or inspect tables via MCP, then update:
   - `lib/leadQueries.ts` – `getAllLeads()` select list and `LeadRow` type.
   - `lib/campaignQueries.ts` – `getClients()`, `getAllCampaigns()` select lists and types.
2. **Airtable:** After `describe_table`, align field names in any Airtable client or sync layer you add.

---

## MCP tool names (when connected)

- **Supabase:** `list_tables`, `execute_sql`, `list_migrations`, `generate_typescript_types`, etc.
- **Airtable:** `list_bases`, `list_tables`, `describe_table`, `list_records`, `search_records`, etc.

Use these to resolve “column X does not exist” or to add new columns we don’t yet use.
