# Campaign Manager: How It Works

## Overview

The Campaign Manager ingests a **CSV of leads**, normalizes rows to a fixed schema, then (optionally) creates Supabase campaign + leads + lead_campaigns, Airtable Hitlist/Auto-Like tables, and duplicates n8n workflows. The **schema** used for Airtable tables comes from either **template tables** (env) or **built-in static schemas**.

## 1. CSV ingestion and normalization

- **Input:** User uploads a CSV file (e.g. from Post Radar export, Clay, or any source).
- **Parsing:** `parseCsvToNormalizedRows(csvText)` in `lib/campaign-manager-inline.ts`:
  - Splits CSV into rows (handles quoted fields and newlines inside quotes).
  - Reads the first row as headers.
  - For each data row, builds an object keyed by header names.
  - Each row is passed to `normalizeCsvRow(row)`.

### Normalization (FIELD_MAPPINGS)

`normalizeCsvRow` maps **many possible column names** to a single internal field. Examples:

| Internal field    | Recognized CSV column names (examples) |
|------------------|----------------------------------------|
| `full_name`      | name, Name, Enrich person, full_name   |
| `profile_url`    | LinkedIn, Linkedin_Profile, Profile_url, URL, profile_url |
| `title`          | title, Title, Headline, job_title      |
| `company_name`   | Org, Company, company_name             |
| `description`    | Reasoning, description, Description, notes |
| …                | (see `FIELD_MAPPINGS` in `campaign-manager-inline.ts`) |

- Matching is **case-insensitive** for header names.
- Rows without at least `full_name` (or equivalent) are dropped.
- Output is a `NormalizedLead[]` used for Supabase and Airtable.

So: **any CSV whose columns match those names (e.g. Name, LinkedIn, Title, Reasoning) will be correctly ingested** when you upload it in Campaign Manager.

## 2. Schema for Airtable tables

Two table types are created (when enabled):

- **Hitlist** – leads for outreach (Name, LinkedIn, Title, Org, Lead_Scoring, status, etc.).
- **Auto Like / Comment** – post/comment/reaction fields for LinkedIn engagement.

Schema resolution:

1. **Optional template table IDs** (env):
   - `AIRTABLE_TEMPLATE_HITLIST_TABLE_ID`
   - `AIRTABLE_TEMPLATE_AUTO_LIKE_TABLE_ID`
2. If set, the app calls Airtable **Meta API** (`GET .../meta/bases/{baseId}`) to read that table’s **field list** (name + type) and uses it when creating the new table.
3. If not set or Meta returns 403/missing, the app falls back to **built-in static schemas**:
   - `HITLIST_TABLE_FIELDS` – fixed list of fields (Enrich_person, Email, LinkedIn, Name, Title, Org, Headline, …).
   - `AUTO_LIKE_TABLE_FIELDS` – lead_name, lead_profile, post_content, commentators(json), etc.

So: **schema is either cloned from your Airtable template or taken from the built-in list**; the generated table is then created in the same base and records are appended.

## 3. Flow (inline route)

1. Create campaign row in Supabase (`campaigns`).
2. Parse CSV → `NormalizedLead[]`.
3. Upsert leads in Supabase (`leads`), link to campaign (`lead_campaigns`).
4. (Optional) Trigger on-demand enrichment webhooks.
5. (Optional) Create Airtable **Auto Like** table (empty) using resolved schema.
6. (Optional) Create Airtable **Hitlist** table and **append** normalized leads (each lead mapped via `leadToAirtableHitlistFields`).
7. (Optional) Duplicate n8n Auto Like and Hitlist workflows.
8. Update campaign row with Airtable table URLs.

So: **the “thingies” generated are** Supabase rows, Airtable tables (and records), and n8n workflow copies. All of them are driven by the **normalized lead schema** from the CSV.

## 4. Post Radar → Campaign CSV

For a CSV exported from Post Radar to be **campaign-compatible**, it should use column names the campaign parser recognizes, for example:

- **Name** (→ full_name)
- **LinkedIn** (→ profile_url)
- **Title** (→ title; use headline from Radar)
- **Reasoning** (→ description; use comment or notes)

Optionally **Score** for lead scoring. The Radar page “Download as campaign CSV” uses these headers so the file can be uploaded directly in Campaign Manager and parsed correctly.
