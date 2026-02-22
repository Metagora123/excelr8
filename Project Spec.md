# Excelr8 App – Full Project Specification

This document describes the entire project so the dashboard and app can be regenerated or rebuilt from scratch. It covers structure, pages, functionality, env variables, theming, animations, and UI patterns.

---

## 1. Project overview

- **Name:** excelr8-app  
- **Stack:** React 18, Vite 5, React Router 6, Tailwind CSS, shadcn/ui (Radix primitives), Recharts  
- **Entry:** `index.html` → `src/main.jsx` → `App.jsx`  
- **Title:** Excelr8 - AI Automation Services  

---

## 2. Directory structure

```
excelr8-app/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── jsconfig.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── main.jsx              # React root, imports App + index.css
│   ├── App.jsx               # Router, ThemeProvider, Layout, routes
│   ├── styles/
│   │   └── index.css         # Tailwind layers, :root, themes, animations, components
│   ├── components/
│   │   ├── Layout.jsx        # Sidebar + header, nav, theme switcher
│   │   ├── ProtectedRoute.jsx
│   │   ├── LoadingSpinner.jsx
│   │   ├── Excelr8Logo.jsx
│   │   └── ui/               # shadcn components (see list below)
│   ├── contexts/
│   │   └── ThemeContext.jsx  # themes object, useTheme(), data-theme
│   ├── lib/
│   │   ├── supabase.js       # createClient, leadQueries, campaignQueries
│   │   ├── auth.js           # login, session, VITE_ADMIN_*
│   │   ├── utils.js          # cn() (clsx + tailwind-merge)
│   │   ├── airtable.js       # Airtable (VITE_AIRTABLE_*)
│   │   └── r2.js             # R2 API (VITE_R2_API_URL, getDateFolders, etc.)
│   └── pages/
│       ├── Login.jsx
│       ├── Dashboard.jsx
│       ├── FileIngestion.jsx
│       ├── Dossiers.jsx
│       ├── PostRadar.jsx
│       ├── CampaignManager.jsx
│       ├── KPIDashboard.jsx
│       └── Newsletter.jsx
├── api/                      # Optional backend (R2, etc.)
└── supabase/migrations/      # SQL migrations (e.g. campaigns KPI columns)
```

---

## 3. Routes and pages

All routes except `/login` are protected (wrapped in `ProtectedRoute` and `Layout`).

| Path | Component | Description |
|------|-----------|-------------|
| `/login` | `Login` | Public; username/password; uses `auth.js` |
| `/` | `Dashboard` | Main dashboard: stats, pie/bar/line charts, recent leads table |
| `/ingestion` | `FileIngestion` | CSV upload to n8n webhook (Supabase ingestion) |
| `/dossiers` | `Dossiers` | List and detail view of leads with dossiers (from Supabase) |
| `/radar` | `PostRadar` | LinkedIn post analysis: URL input, Supabase/Unipile, ICP filter, OpenAI |
| `/campaign-manager` | `CampaignManager` | Campaign creation: client/category, CSV upload to n8n |
| `/kpi` | `KPIDashboard` | Campaign KPIs: cards, progress bars, bar charts (Supabase campaigns) |
| `/newsletter` | `Newsletter` | R2 date folders, file list, generate newsletter via n8n |
| `*` | — | Redirect to `/` |

---

## 4. Page-by-page content and functionality

### 4.1 Login (`src/pages/Login.jsx`)

- **UI:** Centered card (shadcn `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`), `Input` + `Label` for username/password, `Button` submit, Lock/User icons (lucide-react).
- **State:** `username`, `password`, `error`, `loading`.
- **Logic:** `handleSubmit` → `login(username, password)` from `../lib/auth`; on success `navigate('/', { replace: true })`; on failure set `error`.
- **Styling:** `min-h-screen flex items-center justify-center bg-background p-4`; error block uses `border-destructive/50 bg-destructive/10 text-destructive`.

### 4.2 Dashboard (`src/pages/Dashboard.jsx`)

- **Data:** `leadQueries.getAll()` and client-side stats (total, withDossiers, byStatus, byTier, averageScore). Invalid leads filtered by `isValidLead()` (name not empty, no emojis, not "no profile found", etc.).
- **Layout (top to bottom):**
  1. **Header card:** Title "Dashboard", description, theme dropdown (`DropdownMenu` with `themes.map`, `getThemeLabel`, `setTheme`), Refresh button (`fetchData`, `RefreshCw` icon).
  2. **Separator** (shadcn).
  3. **Stats row:** 4 `StatCard`s in grid (Total Leads, With Dossiers, Average Score, Data Source). Each has optional `tooltip` (shadcn `Tooltip`/`TooltipTrigger`/`TooltipContent`) and optional `progress` (shadcn `Progress`). Dossier card shows `dossierPct` and a `Progress` bar.
  4. **Charts row (2 columns):**
     - **Leads by Status:** `ChartContainer` + Recharts `PieChart`/`Pie`/`Cell`; `getChartColors()` per theme (COLORS array); Recharts `Tooltip` and `Legend` with `theme.colors` (contentStyle, labelStyle, formatter with percentage). Config: `{ status, value }`.
     - **Leads by Tier:** `ChartContainer` + `BarChart`/`Bar`; gradient from `theme.colors.gradientFrom`/`gradientTo`; axes/grid use `theme.colors`; Recharts `Tooltip`.
  5. **Lead Growth Timeline:** `ChartContainer` + `LineChart`/`Line`; cumulative average score over time (from sorted leads by `created_at`); gradient and stroke from `theme.colors`; Recharts `Tooltip`/`Legend`.
  6. **Recent Leads card:** shadcn `Table` (Name with avatar/initials, Company, Status/Tier/Badge, Score, Dossier link); first 10 valid leads; `CardFooter` with "View all leads" `Button` as `Link` to `/dossiers`.
- **Loading:** Skeleton UI (same layout with `Skeleton` placeholders for header, 4 stat cards, 2 chart areas, timeline, table rows) inside `TooltipProvider`.
- **Animations:** Stat cards use `animate-slideInUp` with `style={{ animationDelay: '0.1s' }}` etc.
- **Theme:** `useTheme()` → `currentTheme`, `setTheme`, `theme`, `themes`, `getThemeLabel`. Chart colors from `getChartColors()` (different hex arrays for excelr8, excelr82, upwork, testTheme1, default).

### 4.3 File Ingestion (`src/pages/FileIngestion.jsx`)

- **Env:** `VITE_N8N_WEBHOOK_URL`, `VITE_N8N_SUPABASE_TEST_ENDPOINT`, `VITE_N8N_SUPABASE_PROD_ENDPOINT`.
- **UI:** Endpoint toggle (test/prod), drag-and-drop or file input for CSV, upload button, status message (success/error).
- **Logic:** `FormData` with key `data`, POST to `${webhookUrl}/${selectedEndpoint}/clay`.
- **State:** `file`, `uploading`, `uploadingFileName`, `status`, `isDragging`, `endpoint`.

### 4.4 Dossiers (`src/pages/Dossiers.jsx`)

**Purpose:** Browse, search, filter, and open lead dossiers (leads that have a research dossier attached). All data comes from Supabase; no external APIs.

**Data source and API:**
- **Single API call:** `leadQueries.getWithDossiers()` from `src/lib/supabase.js`.
- **Query:** Supabase `from('leads')` with `.eq('is_dossier', true)`, `.not('dossier_url', 'is', null)`, `.order('created_at', { ascending: false })`, paginated via `fetchAllRecords`.
- **No other APIs** – no n8n, R2, or third-party calls. Everything is from the `leads` table.

**State:**
- `dossiers` – raw list from API.
- `filteredDossiers` – result of client-side search + tier + status filters.
- `searchTerm`, `filterTier` ('all' | 'Gold' | 'Silver' | 'Bronze'), `filterStatus` ('all' | 'new' | 'contacted' | 'qualified' | 'converted').
- `selectedDossier` – the lead object when a card is clicked (drives modal visibility).
- `loading`, `refreshing`.

**Fetching and filtering:**
1. On mount, `fetchDossiers()` runs and sets `dossiers` and `filteredDossiers`.
2. A `useEffect` depends on `[searchTerm, filterTier, filterStatus, dossiers]`. It filters `dossiers` by:
   - **Search:** `full_name`, `company_name`, or `email` (case-insensitive) includes `searchTerm`.
   - **Tier:** `d.tier === filterTier` when not `'all'`.
   - **Status:** `d.status === filterStatus` when not `'all'`.
3. Result is stored in `filteredDossiers`. No server-side filtering; all filtering is in memory.

**Rendering:**
- **Header:** Title "Dossiers", subtitle with `filteredDossiers.length`, Refresh button (calls `fetchDossiers` again). Uses `text-gradient` and theme-aware text color via `useTheme()` (`isLightTheme`).
- **Filters card:** Three inputs in a grid – search (placeholder "Search by name, company, email..."), tier `<select>` (All Tiers, Gold, Silver, Bronze), status `<select>` (All Statuses, new, contacted, qualified, converted). All use class `input-field`; Search/Filter icons (lucide-react).
- **Grid:** If `filteredDossiers.length === 0`, show empty state (FileText icon, "No dossiers found", "Try adjusting your filters or search term"). Otherwise map `filteredDossiers` to `DossierCard` with `dossier` and `onSelect={setSelectedDossier}`. Each card has `animate-slideInUp` with staggered `animationDelay`.
- **DossierCard (custom component):** Receives `dossier`, `onSelect`. Renders a clickable card (`.card .card-hover`) that calls `onSelect(dossier)` on click. Shows: profile image (or initials avatar on error), `full_name`, `title`, score badge (Star icon), company (Building), location (MapPin), email (Mail), phone (Phone), tier/status/keywords/tech_stack_tags badges, `created_at` (date-fns `format`), `about_summary` (line-clamp-2). Two links if `dossier_url`: "Download" (gradient button) and "View" (secondary), both open `dossier_url` in new tab; click uses `e.stopPropagation()` so card click doesn’t fire. Theme: `useTheme()` for `isLightTheme`; text and borders use inline styles based on light vs dark.
- **DossierModal (custom component):** When `selectedDossier` is set, a full-screen overlay (fixed, backdrop blur) shows. Modal content: sticky header with larger avatar, `full_name`, `title`, close button (×). Sections: Contact Information (company, location, email, phone in grid), Status badges (Tier, Status, Score), About (about_summary), Personality (personality), Expertise (expertise), Tech Stack (tech_stack_tags split by comma as tags), Company Overview (company_description), Social Reach (followers_count, connections_count). Footer: "Download Dossier" (dossier_url), "View Profile" (profile_url) if present. Modal is light-themed (gray/white) regardless of app theme. Clicking overlay calls `onClose`.

**Lead fields used (from Supabase `leads`):**  
`id`, `full_name`, `title`, `company_name`, `location`, `email`, `phone`, `score`, `tier`, `status`, `keywords`, `tech_stack_tags`, `about_summary`, `personality`, `expertise`, `company_description`, `followers_count`, `connections_count`, `dossier_url`, `profile_url`, `profile_picture_url`, `created_at`.

**Dependencies:** `leadQueries` (supabase), `format` (date-fns), `useTheme`, lucide-react icons (FileText, Download, ExternalLink, Search, Filter, User, Building, Mail, Phone, MapPin, Star, Calendar, RefreshCw, Tag).

---

### 4.5 Post Radar (`src/pages/PostRadar.jsx`)

**Purpose:** Enter a LinkedIn post URL, load that post’s data (from Supabase or Unipile), view commentators and reactioners, optionally filter them by ICP (Ideal Customer Profile) using OpenAI, adjust match threshold, and export CSV.

**Data flow (how data is obtained):**
1. User pastes a LinkedIn post URL and clicks Search.
2. **Post ID extraction:** `extractPostId(url)` parses the URL with multiple regex patterns to get a numeric ID: `urn:li:activity:(\d+)`, `urn:li:ugcPost:(\d+)`, `activity-(\d+)`, `ugcPost-(\d+)`, `/posts/...-activity-(\d+)`, `/posts/...-ugcPost-(\d+)`. Returns the first match or null.
3. **Supabase first:** `searchSupabase(postId)` queries the `lead_posts` table:
   - Tries `linkedin_post_id` = `urn:li:activity:${postId}` → `.maybeSingle()`.
   - Then `linkedin_post_id` = `urn:li:ugcPost:${postId}` → `.maybeSingle()`.
   - Then `post_url` ILIKE `%activity-${postId}%` → `.maybeSingle()`.
   - Then `post_url` ILIKE `%ugcPost-${postId}%` → `.maybeSingle()`.
   - If any returns a row, that row is used and `source` is set to `'supabase'`.
4. **Unipile fallback:** If Supabase returns nothing, `fetchFromUnipile(postId)` is called.
   - **Env:** `VITE_UNIPILE_API_KEY`, `VITE_UNIPILE_ACCOUNT_ID`.
   - **Base URL:** `https://api17.unipile.com:14713/api/v1`.
   - **Calls:**
     - `GET /posts/${encodeURIComponent(urn:li:activity:${postId})}?account_id=${accountId}` — post details. Headers: `X-API-KEY`, `accept: application/json`.
     - `GET /posts/${encodedUrn}/comments?account_id=${accountId}` — comments list; response `items` array.
     - `GET /posts/${encodedUrn}/reactions?account_id=${accountId}` — reactions list; response `items` array.
   - Returns `{ postData, comments, reactions }`. `source` is set to `'unipile'`.
5. **Normalization:** Supabase row is normalized with `normalizeSupabaseData()` (maps `lead_name`, `lead_company`, `content`, `reactions`, `comments`, `post_url`, `topic`, `status`, `is_repost`, `commentators`, `reactioners`, `created_at`, `linkedin_post_id`). Unipile response is normalized with `normalizeUnipileData(postData, comments, reactions)` (author name/headline, text, counters, share_url, commentators/reactioners as objects with name, headline, profile_url, text/date or reaction_type, etc.). The normalized object is stored in `postData` and rendered everywhere.

**ICP filtering (OpenAI):**
- **Env:** `VITE_OPENAI_API_KEY`.
- **Config (state):** `icpConfig` has `companySize`, `industries`, `jobTitles`, `locations`, `revenueRange`, `techStack` (arrays of strings), `additionalCriteria` (string). Loaded from `localStorage` key `icpConfig` on mount; saved when user updates ICP in the modal (`saveIcpConfig`).
- **When user runs "Filter by ICP":** `filterByICP()` builds an ICP criteria string from `icpConfig`, then combines `postData.commentators` and `postData.reactioners` into one list (each item gets `type: 'commentator'|'reactioner'` and `originalIndex`). List is split into batches (batch size from state: `'10'`, `'20'`, `'50'`, or `'all'`). For each batch, `processBatch()` is called:
  - Sends to OpenAI `https://api.openai.com/v1/chat/completions`, model `gpt-4o`, with a system + user prompt asking for JSON: `{ "results": [ { "index", "matchScore" (0–100), "reasoning", "matchedCriteria" } ] }`. Request uses `response_format: { type: 'json_object' }`, temperature 0.3.
  - Response is parsed; results are matched back to people by `originalIndex` (or position fallback). For each person, `matchResults[person.profile_url]` is set to `{ matchScore, reasoning, matchedCriteria }`.
- After all batches, `filteredCommentators` and `filteredReactioners` are set to those whose `matchResults[profile_url].matchScore >= matchThreshold`. `matchThreshold` is state (default 50); user can change it and click "Apply threshold" to recompute filtered lists without re-calling OpenAI.

**State summary:**  
`postUrl`, `loading`, `postData` (normalized post), `source` ('supabase'|'unipile'), `error`; `icpConfig`, `showIcpModal`, `isFiltering`, `matchResults` (profile_url → { matchScore, reasoning, matchedCriteria }), `isFilterActive`, `filteredCommentators`, `filteredReactioners`, `batchSize`, `filterProgress`, `showStatsModal`, `matchThreshold`.

**Rendering (high level):**
- **Floating button:** "ICP Settings" (Sparkles icon); opens ICP modal; shows checkmark if `isIcpConfigured()`.
- **Search area:** Input for post URL, Search button (and Enter key). Loading spinner and error message when applicable.
- **Post summary:** When `postData` exists, show post content, reaction/comment counts, source badge, link to post.
- **Tabs or sections:** Commentators list and Reactioners list. When ICP filter has been run, show either full lists or filtered lists (depending on UX); each person can show match score badge (color by score: green ≥80, yellow ≥60, orange ≥50, gray &lt;50). Buttons to download commentators/reactioners as CSV (`downloadCSV`, filenames include `linkedinPostId` and date).
- **ICP modal:** Form with multi-select or checkboxes for company size, industries, job titles, locations, revenue, tech stack (options arrays in code), plus free-text additional criteria. Save loads into `icpConfig` and localStorage.
- **Stats modal:** From `calculateStats()` – total scored, avg/min/max/median, distribution (0–20, 21–40, …), list of people with scores sorted by score. Shown when `showStatsModal` is true.
- **Reset filter:** Clears `filteredCommentators`/`filteredReactioners`, `matchResults`, sets `isFilterActive` false (e.g. when searching a new post).

**APIs called (summary):**
| API | When | Env / Details |
|-----|------|----------------|
| Supabase `lead_posts` | Every search | Same client as rest of app; queries by `linkedin_post_id` or `post_url` |
| Unipile GET post | When Supabase has no row | `VITE_UNIPILE_API_KEY`, `VITE_UNIPILE_ACCOUNT_ID`; base `https://api17.unipile.com:14713/api/v1` |
| Unipile GET comments | Same as above | `/posts/{urn}/comments` |
| Unipile GET reactions | Same as above | `/posts/{urn}/reactions` |
| OpenAI Chat Completions | When user clicks Filter by ICP | `VITE_OPENAI_API_KEY`; model `gpt-4o`, JSON response |

**Helper functions:** `extractPostId`, `searchSupabase`, `fetchFromUnipile`, `normalizeSupabaseData`, `normalizeUnipileData`, `handleSearch`, `filterByICP`, `processBatch`, `resetFilter`, `calculateStats`, `applyThreshold`, `getMatchScore`, `getMatchBadgeColor`, `escapeCSV`, `downloadCSV`, `handleDownloadCommentators`, `handleDownloadReactioners`, `toggleArrayItem` (for ICP form). Options for ICP dropdowns: `companySizeOptions`, `industryOptions`, `jobTitleOptions`, `locationOptions`, `revenueOptions`, `techStackOptions` (all defined as arrays in the file).

### 4.6 Campaign Manager (`src/pages/CampaignManager.jsx`)

- **Env:** `VITE_N8N_WEBHOOK_URL`, `VITE_N8N_CAMPAIGN_TEST_ENDPOINT`, `VITE_N8N_CAMPAIGN_PROD_ENDPOINT`.
- **Data:** Supabase `clients` (id, name) for Select; form: campaign name, client (Select), category, managed by, optional custom category/managed by; CSV file upload.
- **UI:** Card with form (Label + Input/Select), file drop zone, test/prod endpoint, upload/send button, status.
- **Logic:** FormData with file + metadata; POST to n8n webhook. Clients loaded with `supabase.from('clients').select('id, name').order('name')`.

### 4.7 KPI Dashboard (`src/pages/KPIDashboard.jsx`)

- **Data:** `campaignQueries.getKpiTotals()` and `campaignQueries.getAll()` (Supabase `campaigns`: messages_sent, invites_sent, replies_received, comments_made, likes_reactions).
- **Layout:**
  1. Header: title "Campaign KPI Overview", description, Refresh button (icon only).
  2. Five summary cards (Campaigns, Messages Sent, Invites Sent, Replies Received, Engagement) using shadcn `Card`/`CardContent`, icons (Target, MessageSquare, UserPlus, Reply, Heart), theme tokens.
  3. Two cards side by side: "Outreach & Coverage" (Messages sent / Invites sent with shadcn `Progress` bars); "Engagement & Intent" (Replies, Comments, Likes with `Progress` bars).
  4. "Engagement mix" card: horizontal bar chart (Recharts `BarChart` inside `ChartContainer` with `engagementChartConfig`), only if data.
  5. "KPIs by campaign" card: stacked horizontal bar chart (ChartContainer + byCampaignChartConfig), up to 12 campaigns; Recharts `ChartTooltip`/`ChartTooltipContent`, `ChartLegend`/`ChartLegendContent` (used here; charts are not portaled).
  6. Footer line: "All metrics from Supabase campaigns table..."
- **Colors:** `CHART_COLORS = ['var(--chart-1)', ..., 'var(--chart-5)']`; chart configs reference these for labels/colors.
- **Loading:** `LoadingSpinner` until data is fetched.

### 4.8 Newsletter (`src/pages/Newsletter.jsx`)

- **Env:** `VITE_N8N_WEBHOOK_URL`, `VITE_N8N_NEWSLETTER_TEST_ENDPOINT`, `VITE_N8N_NEWSLETTER_PROD_ENDPOINT`.
- **Data:** R2 date folders and file list via `getDateFolders`, `getFilesInDateFolder`, `getFileContent` from `../lib/r2`; optional existing newsletter HTML.
- **UI:** Date folder selector, file list for selected date, tone selector/custom tone, test/prod endpoint, "Generate" button, generated HTML display, copy button, raw response toggle.
- **State:** `dateFolders`, `selectedDate`, `files`, `generating`, `status`, `generatedHtml`, `copied`, `tone`, `customToneText`, `endpoint`, etc.

---

## 5. Layout and shell

- **File:** `src/components/Layout.jsx`
- **Structure:** `SidebarProvider` → `Sidebar` (left) + `SidebarInset` (main).
- **Sidebar:**  
  - Header: logo (`Excelr8Logo`), "EXCELR8", "AI Automation".  
  - Nav: `navItems` array with `path`, `label`, `icon` (LayoutDashboard, Upload, FileText, Radar, Target, BarChart2, Mail); each is `SidebarMenuButton` + `Link`; active state by `location.pathname === item.path`.  
  - Footer: user dropdown (`DropdownMenu`): "My Account", separator, Logout (`handleLogout` → `logout()` + `navigate('/login', { replace: true })`).
- **Main area:** Header bar with `SidebarTrigger`, `Separator`, "Excelr8 App" text, Theme `DropdownMenu` (Palette icon, "Theme"; items from `themes.map`, `getThemeLabel`, checkmark on `currentTheme`). Content: `<div className="flex flex-1 flex-col p-4 md:p-6">{children}</div>`.
- **Auth:** `getSession()` from `../lib/auth`; username shown in sidebar footer.

---

## 6. Environment variables and usage

- **Vite:** All client-visible variables must be prefixed with `VITE_` and are read as `import.meta.env.VITE_*`.

| Variable | Used in | Purpose |
|----------|---------|---------|
| `VITE_SUPABASE_URL` | `src/lib/supabase.js` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `src/lib/supabase.js` | Anon key (default) |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | `src/lib/supabase.js` | Optional; used if set (bypasses RLS) |
| `VITE_ADMIN_USERNAME` | `src/lib/auth.js` | Login username (default `'admin'`) |
| `VITE_ADMIN_PASSWORD_HASH` | `src/lib/auth.js` | SHA-256 hash of password |
| `VITE_AIRTABLE_API_KEY` | `src/lib/airtable.js` | Airtable API key |
| `VITE_AIRTABLE_BASE_ID` | `src/lib/airtable.js` | Airtable base ID |
| `VITE_AIRTABLE_TABLE_NAME` | `src/lib/airtable.js` | Airtable table name |
| `VITE_N8N_WEBHOOK_URL` | FileIngestion, CampaignManager, Newsletter | Base URL for n8n webhooks |
| `VITE_N8N_SUPABASE_TEST_ENDPOINT` | FileIngestion | Test endpoint path (e.g. webhook-test) |
| `VITE_N8N_SUPABASE_PROD_ENDPOINT` | FileIngestion | Prod endpoint path |
| `VITE_N8N_CAMPAIGN_TEST_ENDPOINT` | CampaignManager | Campaign test endpoint |
| `VITE_N8N_CAMPAIGN_PROD_ENDPOINT` | CampaignManager | Campaign prod endpoint |
| `VITE_N8N_NEWSLETTER_TEST_ENDPOINT` | Newsletter | Newsletter test endpoint |
| `VITE_N8N_NEWSLETTER_PROD_ENDPOINT` | Newsletter | Newsletter prod endpoint |
| `VITE_UNIPILE_API_KEY` | PostRadar | Unipile API key |
| `VITE_UNIPILE_ACCOUNT_ID` | PostRadar | Unipile account ID |
| `VITE_OPENAI_API_KEY` | PostRadar | OpenAI API key for ICP |
| `VITE_R2_API_URL` | `src/lib/r2.js` | Optional; R2 API base URL (dev/prod) |

- **Auth:** Password is hashed with SHA-256 (Web Crypto); `auth.js` logs the hash to console on login attempt so it can be copied to `.env` as `VITE_ADMIN_PASSWORD_HASH`.

---

## 7. Theming (ThemeContext and CSS)

- **Context:** `src/contexts/ThemeContext.jsx`
- **API:** `useTheme()` returns `{ currentTheme, setTheme, theme, themes, getThemeLabel }`.  
  - `themes` = array of theme keys.  
  - `theme` = full theme object for `currentTheme` (e.g. `theme.colors`).  
  - `getThemeLabel(key)` = `themes[key]?.displayName ?? themes[key]?.name ?? key`.
- **Theme keys:** `default`, `excelr8`, `excelr82`, `testTheme1`, `upwork`, `shadcn`, `darkGreen`.
- **Per-theme shape:** Each theme has `name` and `colors`. Optional: `displayName` (e.g. darkGreen: "Dark Green"), `shadcnVars` (for shadcn theme: HSL values for background, foreground, card, primary, etc.).
- **Application:** In `useEffect` on `currentTheme`: (1) set `--theme-*` on `document.documentElement` from `theme.colors`; (2) if `theme.shadcnVars`, set `--background`, `--primary`, etc. on root; (3) set `data-theme={currentTheme}` on root; (4) persist to `localStorage` key `app-theme`.
- **CSS (`src/styles/index.css`):**
  - `:root`: Default `--theme-*` and shadcn-style vars (`--background`, `--foreground`, `--card`, `--primary`, `--chart-1`…`--chart-5`, `--sidebar-*`, etc.) in HSL.
  - `body`: `background: var(--theme-bg)`, `min-height: 100vh`, `@apply text-white`; `* { border-color: var(--theme-borderLight) }`.
  - `.dark`: Override shadcn vars for dark.
  - `[data-theme="darkGreen"]`: Full set of oklch vars (background, card, primary electric green, sidebar, chart-1…5, etc.); `[data-theme="darkGreen"] body` sets background/foreground.
  - `[data-theme="shadcn"] body`: Uses `hsl(var(--background))` / `hsl(var(--foreground))`.
- **Tailwind:** `tailwind.config.js` extends colors with semantic names that map to CSS vars: `background: 'var(--background)'`, `foreground: 'var(--foreground)'`, `card`, `primary`, `muted`, `chart.1`…`chart.5`, `sidebar.*`, etc. Border radius uses `var(--radius)`.

---

## 8. Animations (Tailwind + CSS)

- **Defined in:** `tailwind.config.js` under `theme.extend.animation` and `theme.extend.keyframes`.
- **Names and behavior:**
  - `fadeIn` – opacity 0→1, translateY 20px→0
  - `slideInLeft` – from translateX(-50px)
  - `slideInRight` – from translateX(50px)
  - `slideInUp` – from translateY(50px)
  - `slideInDown` – from translateY(-50px)
  - `slideInFromTop` / `slideInFromBottom` – from ±100px
  - `slideHorizontal` – from translateX(-100%)
  - `scaleIn` – scale 0.9→1
  - `glow` – box-shadow pulse (green)
  - `float` – translateY 0 → -10px → 0
  - `pulse-slow` – slow pulse
- **Usage:** e.g. `className="animate-slideInUp"` or `style={{ animationDelay: '0.1s' }}` on cards.

---

## 9. Supabase and data layer

- **Client:** `createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey)` in `src/lib/supabase.js`.
- **Pagination helper:** `fetchAllRecords(queryBuilderFn, pageSize = 1000)` – loops with `.range(from, to)` until a page is shorter than `pageSize`.
- **leadQueries:**  
  - `getAll()`, `getWithDossiers()`, `getById(id)`, `getByStatus(status)`, `getByTier(tier)` – from `leads`.  
  - `getStats()` – fetches status, tier, is_dossier, score; returns `{ total, withDossiers, byStatus, byTier, averageScore }`.
- **campaignQueries:**  
  - `getAll()` – from `campaigns`, select id, name, status, created_at, messages_sent, invites_sent, replies_received, comments_made, likes_reactions.  
  - `getKpiTotals()` – aggregates above numeric fields across all campaigns.
- **Tables used:** `leads`, `campaigns`, `clients`, `lead_posts` (see migrations for schema).

---

## 10. Auth

- **File:** `src/lib/auth.js`
- **Functions:** `hashPassword`, `verifyCredentials`, `createSession`, `isSessionValid`, `getSession`, `clearSession`, `login`, `logout`.
- **Session:** Stored in `localStorage` key `auth_session`; object has `isAuthenticated`, `username`, `expiresAt` (12 hours).
- **ProtectedRoute:** Checks `isSessionValid()`; if loading shows `LoadingSpinner`; if invalid redirects to `/login` with `<Navigate to="/login" replace />`.

---

## 11. shadcn / UI components

- **Path alias:** `@` → `./src` (vite + jsconfig/tsconfig).
- **Utility:** `src/lib/utils.js` exports `cn(...inputs)` (clsx + tailwind-merge).
- **Components under `src/components/ui/`:**  
  `badge`, `button`, `card`, `chart`, `dropdown-menu`, `input`, `label`, `progress`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `table`, `tooltip`.
- **Card:** Exports `Card`, `CardHeader`, `CardFooter`, `CardTitle`, `CardDescription`, `CardContent`.
- **Chart:** Wraps Recharts; exports `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`. Uses `config` for labels/colors; injects `--color-*` via ChartStyle. **Note:** Tooltip/Legend content that use `useChart()` must render inside the same React tree as `ChartContainer` (Recharts often portals tooltips, which can break context).
- **Sidebar:** `SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarGroup`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarInset`, `SidebarTrigger`; uses CSS vars `--sidebar-background`, `--sidebar-foreground`, etc. (no `hsl()` wrapper so oklch works).

---

## 12. Dashboard-specific details (for regeneration)

- **Imports:** React, Link, Recharts (BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend), lucide-react (Users, FileText, TrendingUp, Database, RefreshCw, Palette, ArrowRight), Card* from `@/components/ui/card`, Button, ChartContainer from `@/components/ui/chart`, Table* from `@/components/ui/table`, Badge, Progress, Separator, Skeleton, TooltipRoot/TooltipContent/TooltipProvider/TooltipTrigger from `@/components/ui/tooltip`, DropdownMenu* from `@/components/ui/dropdown-menu`, leadQueries, LoadingSpinner, useTheme.
- **StatCard:** Receives `title`, `value`, `icon`, `subtitle`, optional `tooltip` (string), optional `progress` (number 0–100). Renders Card with optional Tooltip on value and optional Progress bar.
- **Chart colors:** `getChartColors()` returns array of hex colors by `currentTheme` (excelr8, excelr82, upwork, testTheme1, default). Pie uses `COLORS[index % COLORS.length]` for each Cell.
- **Pie Legend formatter:** Uses `stats?.total ?? 1` to avoid division by zero; shows "Status: count (percent%)".
- **Loading:** Skeleton layout mirrors final layout (header, 4 stat cards, 2 chart placeholders, 1 timeline placeholder, 1 table placeholder).
- **Body wrapper:** Main content wrapped in `TooltipProvider` and `<div className="space-y-8">`.

---

## 13. Vite and build

- **Config:** `vite.config.js` – React plugin, alias `@` → `./src`, dev server port 3000, proxy for `/api/webhook-test` and `/api/webhook` to n8n.
- **Scripts:** `npm run dev`, `npm run build`, `npm run preview`, `npm run server` (node server.js).

---

## 14. Prompting for full regeneration

You can instruct an AI to:

1. **Scaffold:** Create a Vite + React app with React Router, Tailwind, and path alias `@` → `./src`.
2. **Auth:** Implement login (username + password, SHA-256 hash), session in localStorage (12h), ProtectedRoute, and redirect to `/login` when unauthenticated.
3. **Layout:** Implement a sidebar layout (shadcn-style or custom) with nav links for Dashboard, File Ingestion, Dossiers, Post Radar, Campaign Manager, KPI Dashboard, Newsletter; header with theme switcher and user menu (logout).
4. **Theming:** Add ThemeContext with multiple themes (default, excelr8, darkGreen, shadcn, etc.), apply `--theme-*` and `data-theme` on root, and define `[data-theme="darkGreen"]` (and others) in CSS with semantic vars (background, primary, chart-1…5, sidebar).
5. **Supabase:** Create client (anon or service role key from env), implement leadQueries and campaignQueries with pagination, and use tables leads, campaigns.
6. **Dashboard page:** Four stat cards (Total Leads, With Dossiers with Progress, Average Score, Data Source) with optional tooltips; Leads by Status (Pie); Leads by Tier (Bar with gradient); Lead Growth Timeline (Line); Recent Leads table with link to Dossiers; theme dropdown and refresh; Skeleton loading; animations (e.g. slideInUp with delay).
7. **Charts:** Use ChartContainer (or equivalent) + Recharts; Tooltip/Legend with theme-based styling (no ChartTooltipContent/ChartLegendContent if they rely on context and tooltips are portaled).
8. **Env:** Document and use all `VITE_*` variables listed above; ensure auth uses `VITE_ADMIN_USERNAME` and `VITE_ADMIN_PASSWORD_HASH`.

This spec, plus the actual source files, is enough to regenerate or fully rebuild the Excelr8 app and dashboard.
