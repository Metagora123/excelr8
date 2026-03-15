# HubSpot sync – Client documentation

## Overview

The HubSpot sync takes **leads** and **campaigns** from the Excelr8 dashboard’s database (Supabase) and creates or updates **contacts** and **deals** in HubSpot. It also links contacts to deals (by campaign membership) and can add **notes** on contacts (e.g. dossier URL, LinkedIn post count). Sync runs **one-way**: Supabase is the source; HubSpot is updated to match.

**Who uses it:** Teams that use HubSpot as their CRM and want campaign and lead data from Excelr8 to appear there without manual re-entry.

**When to use it:** After you have leads and campaigns in Supabase (e.g. after creating campaigns in Campaign Manager). Run sync on demand from the dashboard (or via API); you can run it repeatedly to refresh HubSpot.

---

## Business value

- **Single source of truth:** Supabase holds the canonical lead and campaign data; HubSpot stays aligned for sales and reporting.
- **No double entry:** Invites sent, messages, and other metrics live in the dashboard; sync pushes what’s needed to HubSpot.
- **Consistent reporting:** Pipeline and activity in HubSpot reflect the same campaigns and contacts as the dashboard.
- **Traceability:** Contacts are matched by email (or by custom profile URL property); deals are matched by name so updates don’t create duplicates.

---

## How it works (user perspective)

1. Open the **HubSpot** page in the dashboard and choose the **Supabase project** (e.g. sales2k25 or prod2k26).
2. Click **Run sync** (or trigger the sync API). The dashboard loads all leads and campaigns from that project, then creates or updates HubSpot contacts and deals, links them (contact ↔ deal by campaign membership), and optionally adds notes (dossier URL, LinkedIn post summary).
3. You see a short **summary** (counts of contacts upserted, deals upserted, associations, notes) and any **logs** or errors. You can then open HubSpot to confirm contacts and deals.

---

## How it works (system / data)

- The sync **reads** from Supabase: **leads** (all columns used for mapping), **campaigns** (id, name, status, description, created_at, messages_sent, invites_sent, replies_received, comments_made, likes_reactions), **lead_campaigns** (lead_id, campaign_id) to know which lead belongs to which campaign.
- It **writes** to HubSpot: **contacts** (create or update by email / profile URL), **deals** (create or update by deal name), **associations** (contact–deal), and **notes** (body + association to contact).
- **Matching:** Contacts are found by **email** first; if no email, by custom property **excelr8_profile_url** (LinkedIn/profile URL). Deals are found by **deal name** (campaign name). If a match exists, the record is **updated**; otherwise it is **created**.
- **Direction:** One-way only (Supabase → HubSpot). Changes in HubSpot are not written back to Supabase.

---

## Data mapping: Supabase → HubSpot

### Leads → Contacts

| Supabase (`leads`) | HubSpot contact property | Notes |
|--------------------|---------------------------|------|
| `full_name` (or `name`) | Split into `firstname`, `lastname` | First word = firstname, rest = lastname. |
| `email` | `email` | Used for search/dedupe; only set if present and valid. |
| `profile_url` | `excelr8_profile_url` | Custom property; used for dedupe when email is missing. |
| `company_name` (or `company`) | `company` | |
| `title` | `jobtitle` | |
| `phone` | `phone` | |
| `location` | `address` | |
| `about_summary` | `linkedinbio` | Truncated to 65535 chars if needed. |
| `status` | `hs_lead_status` | Mapped: e.g. new→NEW, invited/messaged→OPEN, not interested→UNQUALIFIED, etc. |

Lead **id** is not stored on the contact; it is used only internally to associate contacts to deals via **lead_campaigns**.

### Campaigns → Deals

| Supabase (`campaigns`) | HubSpot deal property | Notes |
|------------------------|------------------------|------|
| `name` | `dealname` | Used for search/dedupe. |
| `description` | `description` | Truncated to 65535 chars if needed. |
| (optional) | `dealstage` | Set only if **HUBSPOT_DEAL_STAGE_ID** is set in env (pipeline stage ID). |

**Note:** The dashboard reads **messages_sent**, **invites_sent**, **replies_received**, **comments_made**, **likes_reactions** from Supabase for its own KPIs, but the **current sync does not write these to HubSpot deal properties**. If you want them in HubSpot, create custom deal properties (e.g. `invites_sent`, `messages_sent`) in HubSpot and the sync can be extended to map them.

### Associations and notes

- **Contact ↔ Deal:** For each **lead_campaigns** row, the sync associates the corresponding HubSpot contact (by lead_id) to the corresponding HubSpot deal (by campaign_id). Association type: Contact–Deal (HubSpot-defined).
- **Notes on contact:**  
  - If the lead has **dossier_url**, a note is created: `Dossier: {url}` and associated to the contact.  
  - If the lead has at least one **lead_posts** row, a note is created: `LinkedIn: {count} post(s). Latest: {first post URL}` (or without URL if none) and associated to the contact.

---

## Sync trigger and matching (summary)

| What | How |
|------|-----|
| **Trigger** | Manual: run from the HubSpot page or POST to the sync API with the desired project. |
| **Contact match** | 1) By **email** (HubSpot search). 2) If no email, by **excelr8_profile_url** (custom property search). If none found, create new contact. |
| **Deal match** | By **dealname** (HubSpot search). If found, PATCH; else POST new deal. |
| **Scope** | All leads and all campaigns for the chosen Supabase project in one run. |

---

## Prerequisites & setup

- **HubSpot:** Private App (or app with **contacts** and **deals** read/write, **notes** create, **associations**). **HUBSPOT_ACCESS_TOKEN** (or **HUBSPOT_PERSONAL_ACCESS_KEY**) must be set in the dashboard’s environment.
- **HubSpot custom property:** Create a contact property **excelr8_profile_url** (single-line text) if you want dedupe by LinkedIn URL when email is missing.
- **Optional:** **HUBSPOT_DEAL_STAGE_ID** to set deal stage on create/update. **HUBSPOT_API_BASE** (or **HUBSPOT_EU** / **HUBSPOT_NA**) if you use a specific HubSpot region.
- **Supabase:** The chosen project must have **leads**, **campaigns**, and **lead_campaigns** tables populated. For notes, **lead_posts** and lead **dossier_url** are used when present.

---

## Limits & behaviour

- **HubSpot API** rate limits apply (per your plan). The sync processes leads and campaigns sequentially (contacts first, then deals, then associations, then notes).
- **Large datasets:** Running sync on many leads/campaigns can take time; the UI may show progress or a final summary. If you hit rate limits, reduce scope or run sync more often with smaller changes.
- **Idempotency:** Re-running sync updates existing contacts and deals by email/dealname; it does not create duplicates for the same lead/campaign.

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| "HUBSPOT_ACCESS_TOKEN is not set" | Set **HUBSPOT_ACCESS_TOKEN** or **HUBSPOT_PERSONAL_ACCESS_KEY** in the dashboard env. |
| Contacts not found / duplicates | Ensure **email** is set on leads for primary matching. If you rely on profile URL, create **excelr8_profile_url** on contacts and ensure the sync uses it (it does when email is missing). |
| Deals not updating | Deal is matched by **name** (campaign name). If the campaign name changed in Supabase, HubSpot may have an old deal with the previous name; you may need to align names or handle renames in a custom way. |
| Associations failed | Logs indicate “missing contact or deal”; ensure every lead and campaign was upserted successfully and that **lead_campaigns** references valid lead_id and campaign_id. |
| Notes not appearing | Check that leads have **dossier_url** or at least one **lead_posts** row; sync only creates notes for those. |

---

## Related flows

For a visual of the sync (Supabase → contacts/deals → associations → notes), open **flows.pdf** in this folder (HubSpot sync section).
