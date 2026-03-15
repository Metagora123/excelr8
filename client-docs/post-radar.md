# Post Radar – Client documentation

## Overview

Post Radar is the part of the Excelr8 dashboard that shows **LinkedIn post activity** for your leads: their recent posts, who commented, and who reacted. It helps you see what’s resonating and discover new prospects (commentators and reactioners). Optionally, you can run **ICP (Ideal Customer Profile) scoring** so the system ranks those people by fit.

**Who uses it:** Ops and sales teams who run LinkedIn campaigns and want one place to see post engagement and prioritize who to contact next.

**When to use it:** After leads and their posts are in the system (e.g. after running Campaign Manager with enrichment, or after another process has filled `lead_posts`). Use Radar to browse posts, then optionally run ICP to score commentators/reactioners.

---

## Business value

- **Single view** of “what’s hot” among your leads and their networks.
- **New prospects:** Commentators and reactioners are often good outreach targets; Radar surfaces them with minimal effort.
- **Prioritization:** ICP scoring (optional) ranks people by how well they match your criteria so you focus on the best fits.
- **Uses existing data:** No extra manual collection; data comes from Supabase and, when needed, Unipile.
- **Auditable:** You see which post, which people, and (with ICP) why they scored high or low.

---

## How it works (user perspective)

1. Open the **Post Radar** page and choose the **Supabase project** (e.g. sales2k25 or prod2k26).
2. The page loads **posts** from the database (and optionally from Unipile if you open a post by ID that isn’t in the DB yet).
3. You see a list of posts with **content**, **comment count**, **reaction count**, and **author** (lead name/company). You can open a post to see **commentators** and **reactioners** (name, headline, profile URL when available).
4. **Optional:** Configure **ICP criteria** (e.g. job titles, industries, locations) and run **ICP scoring**. The system sends the list of people to the AI and returns a **match score** (0–100) and short reasoning per person. Results are shown in the UI so you can sort and filter by score.
5. You use that list to decide who to add to campaigns or contact next.

---

## How it works (system / data)

- **Primary source:** Supabase table **`lead_posts`**. Each row is one LinkedIn post linked to a lead (`lead_id`). Rows are populated by **enrichment** (Campaign Manager “Create In-App” with enrichment on) or by any other process that writes to `lead_posts`.
- **Optional source:** If you open a post by **post ID** (e.g. from a URL) and that post isn’t in Supabase, the app can fetch it from **Unipile** (LinkedIn API), normalize it, and optionally enrich commentator/reactioner profiles via Unipile. Data is then shown in the UI (and can be stored depending on your flow).
- **ICP:** When you run ICP, the app sends the chosen people (name, headline, profile_url, type: commentator/reactioner) plus your criteria to the **OpenAI** API. The model returns a JSON object with scores and reasoning; the dashboard displays and optionally stores or uses that result.

---

## Data & APIs

### Where the data comes from

| Source | What it provides | When it’s used |
|--------|------------------|----------------|
| **Supabase `lead_posts`** | Post content, comments/reactions counts, `commentators` and `reactioners` (JSON), post URL, lead name/company | Default: Radar loads posts from this table (by project). |
| **Unipile** | Live post data, comments list, reactions list, and user profiles (for missing `profile_url` / headline) | When opening a post by ID not in DB, or when enriching commentators/reactioners. |
| **OpenAI** | ICP match scores (0–100), reasoning, matched criteria per person | When you run “Score with ICP” in the UI. |

### API calls used by Post Radar

| API | Method | Purpose | Data in / out |
|-----|--------|---------|----------------|
| **Supabase** | `GET` (REST) | Read `lead_posts` rows (filter by `linkedin_post_id` or `post_url`). | In: project, optional post ID. Out: row(s) with `content`, `comments`, `reactions`, `commentators`, `reactioners`, `post_url`, `lead_name`, `lead_company`, etc. |
| **Unipile** | `GET /api/v1/posts/{urn}` | Fetch a single post by LinkedIn URN (e.g. `urn:li:activity:123`). | In: post URN, `account_id`. Out: post JSON (content, dates, etc.). |
| **Unipile** | `GET /api/v1/posts/{urn}/comments` | Fetch comments for that post. | In: post URN, `account_id`. Out: `{ items: [ … ] }` (each item has creator/author info). |
| **Unipile** | `GET /api/v1/posts/{urn}/reactions` | Fetch reactions for that post. | In: post URN, `account_id`. Out: `{ items: [ … ] }` (each item has actor/owner info). |
| **Unipile** | `GET /api/v1/users/{identifier}` | Resolve a person’s profile (e.g. `provider_id` or `public_identifier`) to get `profile_url` and `headline`. | In: identifier, `account_id`. Out: `profile_url`, `headline`, etc. Used to fill missing profile URLs for commentators/reactioners. |
| **OpenAI** | `POST /v1/chat/completions` | ICP scoring: score each person 0–100 against your criteria. | In: system + user prompt (criteria + JSON array of people). Out: JSON `{ results: [ { index, matchScore, reasoning, matchedCriteria } ] }`. |

All Unipile calls use **X-API-KEY** and (where required) **account_id**. OpenAI uses the project’s **OPENAI_API_KEY**.

### Data formats

- **`lead_posts` (Supabase)**  
  - **commentators** / **reactioners:** Stored as **JSON** (array of objects). Each object can have: `id`, `name`, `headline`, `profile_url`, `text`, `date`, `reaction_type`, and other Unipile-style fields. The Radar UI expects at least `name`; `profile_url` and `headline` are used when present (and can be filled by Unipile if missing).  
  - **content**, **post_url**, **linkedin_post_id:** Text.  
  - **comments**, **reactions:** Numbers (counts).  
  - **lead_name**, **lead_company:** Text (author context).

- **Unipile responses**  
  - **Comments/reactions:** JSON with an `items` array. Item shape depends on Unipile; the app normalizes known fields (creator/author/actor, etc.) into a single **RadarPerson** shape (id, name, headline, profile_url, type, text, date, reaction_type).

- **ICP (OpenAI)**  
  - **Input:** JSON body with `icpConfig` (e.g. jobTitles, industries, locations) and `people` (array of `{ index, name, headline, profile_url, type }`).  
  - **Output:** JSON `{ matchResults: { "index:N" | profile_url: { matchScore, reasoning, matchedCriteria } } }`.

- **Export / import**  
  - The dashboard **displays** data and ICP results in the UI. There is no built-in CSV/Excel export; data is consumed in-app. If you need export, it can be added as a feature (e.g. “Export to CSV”).

---

## Prerequisites & setup

- **Supabase:** One project (e.g. sales2k25 or prod2k26) with the **`lead_posts`** table populated (e.g. via Campaign Manager enrichment).
- **Unipile** (optional but recommended for full experience): **UNIPILE_API_KEY**, **UNIPILE_ACCOUNT_ID**, and optionally **UNIPILE_API_BASE**. Required if you want to open posts by ID that aren’t in Supabase or to enrich missing commentator/reactioner profiles.
- **OpenAI** (for ICP): **OPENAI_API_KEY** (or **VITE_OPENAI_API_KEY**) must be set. Without it, ICP scoring is disabled or returns an error.

---

## Limits & behaviour

- **Unipile:** Rate limits and quotas depend on your Unipile plan. The app adds a short delay (~180 ms) between profile-enrichment calls to reduce burst load.
- **OpenAI:** ICP sends people in batches (default batch size 20, max 50). Token usage depends on the number of people and length of criteria.
- **Supabase:** Normal Postgres/API limits apply; Radar reads with simple filters (e.g. by `linkedin_post_id` or `post_url`).

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| No posts showing | Confirm `lead_posts` has rows for the selected project and that enrichment (or another process) has run. |
| Commentators/reactioners empty | Ensure the enrichment (or Unipile) flow stores **commentators** and **reactioners** JSON in `lead_posts`. Check one row in Supabase to see the column format. |
| Missing profile URLs | If Unipile is configured, the app will try to fill them via `GET /users/{identifier}`. If not, add Unipile keys or ensure the upstream process writes `profile_url` into the JSON. |
| ICP fails or not available | Ensure **OPENAI_API_KEY** is set in the environment the dashboard runs with. Check browser network tab for 503 or error message from the ICP API. |
| Wrong project’s data | Use the project selector on the Radar page; it filters Supabase data by project (sales2k25 vs prod2k26). |

---

## Related flows

For a visual of how Post Radar gets data and where ICP fits in, open **flows.pdf** in this folder (Post Radar section).
