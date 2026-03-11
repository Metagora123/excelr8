# Campaign Manager – Airtable base, tables, and env

## Correct base and view

- **Base ID:** `appmn0qxztijCXMQT` (from your URL).
- **URL you shared:**  
  `https://airtable.com/appmn0qxztijCXMQT/tblMB7OE902QVIvTH/viwQw3CPaMLo8opqb?blocks=hide`
- New campaign tables are created **in this same base**. Views are per-table; new tables get a default view automatically. No extra “view” env var is needed.

## .env – what to set

### Replace (lines 7–8)

| Variable | Replace with |
|--------|---------------|
| `AIRTABLE_BASE_ID` | `appmn0qxztijCXMQT` |
| `AIRTABLE_TABLE_NAME` | Keep `Leads` if you use it elsewhere; campaign automation creates tables with dynamic names and does not use this. |

### New variables (already added to `.env` / `.env.example`)

| Variable | Purpose |
|----------|--------|
| `N8N_API_URL` | n8n instance base URL (e.g. `https://n8n.srv1123126.hstgr.cloud`). |
| `N8N_API_KEY` | **You must set this.** X-N8N-API-KEY header value (from n8n Settings → API). Used to duplicate and activate workflows. |
| `N8N_AUTO_LIKE_WORKFLOW_ID` | Template workflow for Auto Like / Auto Comment (`590NAO6MG2wVJISB`). |
| `N8N_HITLIST_WORKFLOW_ID` | Template workflow for Hitlist (`zuAYh1MEMI2U5lep`). |

### Optional: clone schema from existing tables

To reuse **exact column names and types** from existing tables in the same base:

1. In Airtable, open the table you use as the **Auto Like / Auto Comment** template and copy the table ID from the URL: `airtable.com/.../tblXXXXXXXXXXXXXX/...`.
2. Do the same for the **Hitlist** template table.
3. Add to `.env` (optional):

```env
AIRTABLE_TEMPLATE_AUTO_LIKE_TABLE_ID=tblXXXXXXXXXXXXXX
AIRTABLE_TEMPLATE_HITLIST_TABLE_ID=tblYYYYYYYYYYYYYY
```

If these are set, the app will **GET the table schemas** from this base and create new tables with the same field names and types. If not set, the app uses a built-in schema derived from the Campaign Manager JSON (Hitlist and Auto Like field list).

## Summary

- **Base:** Set `AIRTABLE_BASE_ID=appmn0qxztijCXMQT` so all new campaign tables are created in the correct base (and thus in the same “place” as your existing view).
- **Column names/types:** Either set the two optional `AIRTABLE_TEMPLATE_*` IDs to copy from existing tables, or rely on the built-in schema.

---

## If you get 403 on "base schema" (GET metadata)

Other users have hit **403 / INVALID_PERMISSIONS** on Airtable Metadata API (listing bases works, reading base schema returns 403). Common causes and fixes:

1. **Workspace role**  
   The account that created the PAT must be **owner or creator** of the workspace that contains the base. If the base was shared with you (or the token's user) but you're not the workspace owner, schema read can still return 403.  
   - **Fix:** Have a workspace **owner** create the PAT and add the base to its Access, or move the base into a workspace where you are owner/creator.

2. **Scopes**  
   Token must have `schema.bases:read` and `schema.bases:write`. You already have these; if 403 persists, it's usually the workspace role above.

3. **References**  
   - [Invalid permissions accessing metadata API](https://community.airtable.com/development-apis-11/invalid-permissions-accessing-metadata-api-3610) (fix: correct scopes in auth URL for OAuth; for PAT, check workspace role).  
   - [Airtable API common troubleshooting](https://support.airtable.com/docs/api-common-troubleshooting) (403 / INVALID_PERMISSIONS).

### Can we still run the campaign flow with 403 on schema read?

**Yes.** Creating tables does **not** require reading the base schema first. The app will:

- Call **POST** `https://api.airtable.com/v0/meta/bases/{baseId}/tables` with a JSON body: `name` + `fields` (column names and types).
- Use a **built-in schema** (same fields as in your Campaign Manager workflow) for the Hitlist and Auto Like/Auto Comment tables, so column names and types stay correct for n8n.

So as long as the token can **list bases** and has **schema.bases:write**, table creation can work even when **GET base schema** returns 403. The env check script treats "Airtable schema 403" as a warning and still exits successfully so you can proceed with the implementation.
