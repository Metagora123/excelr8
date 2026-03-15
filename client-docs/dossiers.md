# Dossiers – Client documentation

## Overview

**Dossiers** in the Excelr8 dashboard are a **lead research view**: one place to see stored research and context for a lead (e.g. name, profile, notes, linked data). Data is stored in Supabase in the **dossiers** table and linked to **leads** via `lead_id`. The dashboard is the **viewer**; dossiers are typically **filled by other processes** (e.g. n8n, enrichment, or manual entry elsewhere).

**Who uses it:** Ops and sales who need a quick, consistent view of lead research before or during outreach.

**When to use it:** When you want to browse or open a dossier for a lead. Ensure the dossiers table is populated (by your ingestion or automation) for the chosen Supabase project.

---

## Business value

- **Single place** to review lead research so operators know where to look.
- **Structured:** Same format for every lead (e.g. HTML snippet, JSON summary) so the experience is predictable.
- **Traceable:** Data lives in Supabase and can be linked to campaigns and CRM (e.g. dossier URL synced to HubSpot as a note).
- **Integrable:** Other tools can write dossiers via Supabase or API; the dashboard displays them.

---

## How it works (user perspective)

1. Open the **Dossiers** page and choose the **Supabase project** (e.g. sales2k25 or prod2k26).
2. The app loads **dossiers** from Supabase (filtered by project). Each dossier is tied to a **lead** (`lead_id`) and can show **lead name**, **dossier data** (e.g. HTML snippet, JSON), and links.
3. You browse the list and open a dossier to see the full research view. If the lead has a **dossier_url** (e.g. external link), you can use that for the full report.

---

## How it works (system / data)

- **Source:** Supabase table **dossiers**. Typical columns: **id**, **lead_id**, **lead_name**, **html_snippet**, **dossier_data** (JSON), **created_at**. The dashboard reads this table (with project-specific Supabase client). Optionally, lead data is joined from **leads** (e.g. for name, status) when available.
- **Linking:** Each dossier row has **lead_id**; the same lead can appear in **lead_campaigns** and in **leads**. The HubSpot sync can create a note on the contact with **Dossier: {dossier_url}** when the lead has **dossier_url** set on the **leads** table (this may be set by your process when a dossier is created or updated).
- **No write from dashboard:** The dossier UI is read-only; creating or updating dossiers is done by your pipelines or tools.

---

## Data and formats

- **dossiers table:** **html_snippet** (text), **dossier_data** (JSON). Structure of **dossier_data** is defined by whatever writes it (e.g. n8n or an enrichment job). The dashboard displays what’s stored; it doesn’t enforce a fixed schema.
- **lead_id:** UUID; must match **leads.id** in the same project if you want lead name or other lead fields to resolve.
- **Export:** The dashboard is for viewing; there is no built-in CSV/Excel export. You can add an export feature or read from Supabase directly if needed.

---

## Prerequisites & setup

- **Supabase:** One project with **dossiers** table (and optionally **leads** for join). The dashboard uses the same project selector as elsewhere (sales2k25 / prod2k26).
- **Population:** Some process (n8n, script, or another app) must insert/update **dossiers** and optionally set **leads.dossier_url** so that the HubSpot sync can attach a dossier note to the contact.

---

## Limits & behaviour

- **Read-only:** The dashboard does not create or edit dossiers; it only displays them.
- **Size:** Very large **html_snippet** or **dossier_data** may affect load time; consider truncation or pagination if you have huge payloads.
- **Project:** Only dossiers in the selected Supabase project are shown; **lead_id** is resolved within that project.

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| No dossiers showing | Confirm the **dossiers** table has rows for the selected project and that your ingestion or automation has run. |
| Lead name or details missing | Ensure **lead_id** on the dossier matches **leads.id** in the same project and that the dashboard query joins or fetches lead data. |
| Dossier URL not in HubSpot | HubSpot sync creates a note from **leads.dossier_url**; ensure that field is set (e.g. by your dossier pipeline) when you want it in HubSpot. |
| Wrong project | Use the project selector; data is filtered by the chosen Supabase project. |

---

## Related flows

Dossiers are a view over Supabase; there is no separate flow diagram in Flows. For how **dossier_url** is used in HubSpot, open **hubspot.pdf** in this folder.
