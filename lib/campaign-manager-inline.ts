/**
 * Campaign Manager in-app flow: normalize CSV, Supabase campaign/leads/lead_campaigns,
 * Airtable tables (built-in schema), n8n workflow duplicate.
 */

import { createClient, type SupabaseProject } from "@/lib/supabase"
import { getUnipileAccounts } from "@/lib/campaignQueries"
import {
  getAirtableApiKey,
  getAirtableBaseId,
  getAirtableTemplateAutoLikeTableId,
  getAirtableTemplateHitlistTableId,
  getN8nApiUrl,
  getN8nApiKey,
  getN8nAutoLikeWorkflowId,
  getN8nHitlistWorkflowId,
} from "@/lib/env"

const FIELD_MAPPINGS: Record<string, string[]> = {
  full_name: ["name", "Name", "Enrich person", "full_name", "fullname"],
  email: ["email", "Email", "Email Final", "email_address"],
  profile_url: ["LinkedIn", "Linkedin_Profile", "Profile_url", "URL", "profile_url", "linkedin_url"],
  title: ["title", "Title", "Title - Experience", "Headline", "job_title"],
  company_name: ["Org", "Company", "Company - Experience", "company_name", "organization"],
  location: ["Location Name", "location", "Location", "city", "region"],
  followers_count: ["Num Followers", "followers_count", "followers", "follower_count"],
  connections_count: ["connections_count", "connections", "Num Connections"],
  phone: ["Mobile Phone (EMEA)", "phone", "Phone", "mobile", "phone_number"],
  tier: ["Tier", "tier", "customer_tier"],
  score: ["Score", "score", "lead_score"],
  status: ["Lead Scoring", "status", "Status", "lead_status"],
  description: ["Reasoning", "description", "Description", "notes"],
  about_summary: ["about_summary", "about", "summary", "bio"],
  expertise: ["expertise", "skills", "specialties"],
}

function findValue(input: Record<string, unknown>, keys: string[]): string | number | null {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      const v = input[key]
      if (v !== null && v !== undefined && v !== "") return v as string | number
    }
  }
  const lower: Record<string, unknown> = {}
  for (const k of Object.keys(input)) lower[k.toLowerCase()] = input[k]
  for (const key of keys) {
    const v = lower[key.toLowerCase()]
    if (v !== null && v !== undefined && v !== "") return v as string | number
  }
  return null
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v
  if (v === null || v === undefined || v === "") return null
  const n = parseInt(String(v), 10)
  return Number.isNaN(n) ? null : n
}

/** Supabase leads.status column uses this enum. Invalid CSV values are coerced to "new". */
const LEAD_STATUS_ENUM = [
  "new",
  "interested",
  "not interested",
  "qualified",
  "enriched",
  "invited",
  "messaged",
  "renewed",
] as const

export type LeadStatusEnum = (typeof LEAD_STATUS_ENUM)[number]

function toLeadStatus(value: string | null | undefined): LeadStatusEnum {
  if (value == null || value === "") return "new"
  const normalized = String(value).trim().toLowerCase()
  const found = LEAD_STATUS_ENUM.find((s) => s === normalized)
  return found ?? "new"
}

function toIntOrUndefined(v: number | null | undefined): number | undefined {
  if (v == null) return undefined
  const n = typeof v === "number" ? v : parseInt(String(v), 10)
  return Number.isNaN(n) ? undefined : Math.floor(n)
}

/** Strip bullet (•), hyphens, dots used as list markers, and collapse whitespace for cleaner lead text. */
export function cleanLeadText(value: string | null | undefined): string | null {
  if (value == null || typeof value !== "string") return null
  let s = value.trim()
  if (!s) return null
  s = s.replace(/^[\s•\-.]+\s*/gm, "").replace(/\s*[\s•\-.]+\s*$/gm, " ")
  s = s.replace(/\s*[•\-.]\s*/g, " ").replace(/\s+/g, " ").trim()
  return s || null
}

export type NormalizedLead = {
  full_name: string | null
  profile_url: string | null
  email: string | null
  title: string | null
  company_name: string | null
  location: string | null
  phone: string | null
  tier: string | null
  score: number | null
  status: string | null
  description: string | null
  about_summary: string | null
  expertise: string | null
  followers_count: number | null
  connections_count: number | null
}

export function normalizeCsvRow(row: Record<string, unknown>): NormalizedLead {
  const get = (k: keyof typeof FIELD_MAPPINGS) => findValue(row, FIELD_MAPPINGS[k])
  const rawName = get("full_name") != null ? String(get("full_name")) : null
  const rawTitle = get("title") != null ? String(get("title")) : null
  const rawCompany = get("company_name") != null ? String(get("company_name")) : null
  const rawDesc = get("description") != null ? String(get("description")) : null
  const rawAbout = get("about_summary") != null ? String(get("about_summary")) : null
  const rawExpertise = get("expertise") != null ? String(get("expertise")) : null
  return {
    full_name: cleanLeadText(rawName) ?? (rawName?.trim() || null),
    profile_url: get("profile_url") != null ? String(get("profile_url")).trim() : null,
    email: get("email") != null ? String(get("email")).trim() : null,
    title: cleanLeadText(rawTitle) ?? (rawTitle?.trim() || null),
    company_name: cleanLeadText(rawCompany) ?? (rawCompany?.trim() || null),
    location: get("location") != null ? String(get("location")).trim() : null,
    phone: get("phone") != null ? String(get("phone")).trim() : null,
    tier: get("tier") != null ? String(get("tier")).trim() : null,
    score: toNum(get("score")),
    status: get("status") != null ? String(get("status")).trim() : null,
    description: cleanLeadText(rawDesc) ?? (rawDesc?.trim() || null),
    about_summary: cleanLeadText(rawAbout) ?? (rawAbout?.trim() || null),
    expertise: cleanLeadText(rawExpertise) ?? (rawExpertise?.trim() || null),
    followers_count: toNum(get("followers_count")),
    connections_count: toNum(get("connections_count")),
  }
}

/** Split CSV text into logical rows. Newlines inside double-quoted fields are not row separators. */
function splitCsvIntoLogicalRows(csvText: string): string[] {
  const rows: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < csvText.length; i++) {
    const c = csvText[i]
    if (c === '"') {
      const next = csvText[i + 1]
      if (inQuotes && next === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
        cur += c
      }
    } else if ((c === "\n" || (c === "\r" && csvText[i + 1] === "\n")) && !inQuotes) {
      if (c === "\r") i++
      rows.push(cur)
      cur = ""
    } else if (c !== "\r" || inQuotes) {
      cur += c
    }
  }
  if (cur.length > 0) rows.push(cur)
  return rows
}

export function parseCsvToNormalizedRows(csvText: string): NormalizedLead[] {
  const lines = splitCsvIntoLogicalRows(csvText).filter((l) => l.trim())
  if (lines.length < 2) return []
  const header = lines[0]
  const sep = header.includes(";") ? ";" : ","
  const keys = parseCsvLine(header, sep)
  const out: NormalizedLead[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], sep)
    const row: Record<string, unknown> = {}
    keys.forEach((k, j) => {
      row[k] = values[j] ?? ""
    })
    const n = normalizeCsvRow(row)
    if (n.full_name != null && String(n.full_name).toLowerCase() !== "nan") {
      out.push(n)
    }
  }
  return out
}

function parseCsvLine(line: string, sep: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
        // do not add the quote to the field value
      }
    } else if (!inQuotes && c === sep) {
      out.push(cur.trim())
      cur = ""
    } else {
      cur += c
    }
  }
  out.push(cur.trim())
  return out
}

export function generateCampaignId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function buildCampaignName(params: {
  campaignName: string
  managedBy: string
  category: string
  date: string
  campaignId: string
}): string {
  return `${params.campaignName}-${params.managedBy}-${params.category}-${params.date}-${params.campaignId}`
}

/** Schema result for display (column name + type). */
export type AirtableSchemaField = { name: string; type: string }

/**
 * Airtable API – what we can replicate:
 * - Single line / Long text / Number / Date etc.: create + write any value.
 * - Button: cannot create via API (we skip when creating tables); add manually in Airtable.
 * - Single select: we create the field with fixed choices, but when writing records the value
 *   must be one of those choices; otherwise Airtable returns INVALID_MULTIPLE_CHOICE_OPTIONS.
 *   So we only include single-select fields in appended records when the value is allowed.
 */
/** Built-in Hitlist table fields (includes Message/Tempo 1–3 and status dropdown). */
export const HITLIST_TABLE_FIELDS: Array<{ name: string; type: string; options?: Record<string, unknown> }> = [
  { name: "Enrich_person", type: "multilineText" },
  { name: "Email", type: "singleLineText" },
  { name: "LinkedIn", type: "singleLineText" },
  { name: "campaign_id", type: "singleLineText" },
  { name: "Name", type: "singleLineText" },
  { name: "Title", type: "singleLineText" },
  { name: "Org", type: "multilineText" },
  { name: "Headline", type: "multilineText" },
  { name: "Summary", type: "multilineText" },
  { name: "Title_Experience", type: "multilineText" },
  { name: "Company_Experience", type: "multilineText" },
  { name: "Company_Domain", type: "multilineText" },
  { name: "Summary_Experience", type: "multilineText" },
  { name: "Location_Name", type: "singleLineText" },
  { name: "Last_Name", type: "singleLineText" },
  { name: "First_Name", type: "singleLineText" },
  { name: "Work_Email", type: "singleLineText" },
  { name: "Email_Final", type: "singleLineText" },
  { name: "Num_Followers", type: "number", options: { precision: 0 } },
  {
    name: "Lead_Scoring",
    type: "singleSelect",
    options: { choices: [{ name: "Hot" }, { name: "Warm" }, { name: "Cold" }, { name: "None" }] },
  },
  {
    name: "Tier",
    type: "singleSelect",
    options: { choices: [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "None" }] },
  },
  { name: "Score", type: "number", options: { precision: 0 } },
  { name: "Reasoning", type: "multilineText" },
  { name: "Mobile_Phone_EMEA", type: "multilineText" },
  { name: "Message_1", type: "multilineText" },
  { name: "Tempo_1", type: "singleLineText" },
  { name: "Message_2", type: "multilineText" },
  { name: "Tempo_2", type: "singleLineText" },
  { name: "Message_3", type: "multilineText" },
  { name: "Tempo_3", type: "singleLineText" },
  {
    name: "status",
    type: "singleSelect",
    options: {
      choices: [
        { name: "fresh" },
        { name: "messaged" },
        { name: "invited" },
      ],
    },
  },
]

/** Build Select_Poster singleSelect field with choices from Supabase unipile_accounts (usernames) + None. */
function buildSelectPosterField(usernames: string[]): { name: string; type: string; options: { choices: Array<{ name: string }> } } {
  const choices = [...usernames.map((name) => ({ name })), { name: "None" }]
  return {
    name: "Select_Poster",
    type: "singleSelect",
    options: { choices },
  }
}

/** Auto Like / Auto Comment table fields (different schema: post/comment/reaction fields). */
export const AUTO_LIKE_TABLE_FIELDS: Array<{ name: string; type: string; options?: Record<string, unknown> }> = [
  { name: "lead_name", type: "singleLineText" },
  { name: "lead_profile", type: "singleLineText" },
  { name: "tier", type: "singleLineText" },
  { name: "score", type: "number", options: { precision: 0 } },
  { name: "campaign_id", type: "singleLineText" },
  { name: "post_content", type: "multilineText" },
  { name: "commentators(json)", type: "multilineText" },
  { name: "reactioners(json)", type: "multilineText" },
  { name: "commentators_count", type: "number", options: { precision: 0 } },
  { name: "reactioners_count", type: "number", options: { precision: 0 } },
  { name: "comment_a", type: "multilineText" },
  { name: "comment_b", type: "multilineText" },
  { name: "comment_c", type: "multilineText" },
  { name: "comment_d", type: "multilineText" },
  {
    name: "Reaction",
    type: "singleSelect",
    options: {
      choices: [{ name: "love" }, { name: "celebrate" }, { name: "support" }, { name: "like" }, { name: "funny" }, { name: "None" }],
    },
  },
  {
    name: "Final_Comment",
    type: "singleSelect",
    options: { choices: [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }, { name: "Custom" }, { name: "None" }] },
  },
  {
    name: "Confirm_Column",
    type: "singleSelect",
    options: { choices: [{ name: "Yes" }, { name: "No" }, { name: "None" }] },
  },
  {
    name: "Select_Poster",
    type: "singleSelect",
    options: { choices: [{ name: "Yves" }, { name: "Anna" }, { name: "Shawn" }, { name: "None" }] },
  },
  { name: "post_id", type: "multilineText" },
  { name: "post_url", type: "multilineText" },
  { name: "Custom_Comment_Data", type: "multilineText" },
  { name: "title", type: "singleLineText" },
  { name: "location", type: "singleLineText" },
  { name: "expertise", type: "multilineText" },
  { name: "Tags", type: "multilineText" },
  {
    name: "Confirmation_status",
    type: "singleSelect",
    options: { choices: [{ name: "success" }, { name: "failed" }, { name: "retry_later" }, { name: "None" }] },
  },
]

export type CreateCampaignParams = {
  project: SupabaseProject
  campaignId: string
  campaignName: string
  description?: string
  category: string
  managedBy: string
  clientId: string
}

export async function createCampaignRow(params: CreateCampaignParams): Promise<void> {
  const supabase = createClient(params.project)
  const { error } = await supabase.from("campaigns").insert({
    id: params.campaignId,
    name: `${params.campaignName}-${params.category}-${params.managedBy}`,
    description: params.description ?? "",
    status: "new",
    campaign_type: params.category,
    assigned_to: params.managedBy,
    client_id: params.clientId || null,
  } as Record<string, unknown>)
  if (error) throw new Error(`campaigns insert: ${error.message}`)
}

export type UpsertLeadsResult = { inserted: number; updated: number; leadIdsByProfileUrl: Map<string, string> }

/**
 * Upsert leads into Supabase and link them to the campaign via lead_campaigns.
 * - If the lead already exists (matched by profile_url): do not change leads table data,
 *   only set is_campaigned to "true" (and add/upsert lead_campaigns).
 * - If the lead is new: insert into leads with full data and is_campaigned "true".
 * Rows are normalized to the leads table schema; rows without profile_url are skipped.
 */
export async function upsertLeadsAndFillLeadCampaigns(
  project: SupabaseProject,
  normalized: NormalizedLead[],
  campaignId: string,
  clientId: string
): Promise<UpsertLeadsResult> {
  const supabase = createClient(project)
  const leadIdsByProfileUrl = new Map<string, string>()
  let inserted = 0
  let updated = 0
  const now = new Date().toISOString()

  for (const row of normalized) {
    const profileUrl = (row.profile_url ?? "").trim()
    if (!profileUrl) continue

    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("profile_url", profileUrl)
      .maybeSingle()

    if (existing?.id) {
      await supabase
        .from("leads")
        .update({ is_campaigned: "true", updated_at: now })
        .eq("id", existing.id)
      updated++
      leadIdsByProfileUrl.set(profileUrl, existing.id)
    } else {
      const leadRow = {
        full_name: row.full_name ?? undefined,
        profile_url: profileUrl,
        email: row.email ?? undefined,
        title: row.title ?? undefined,
        company_name: row.company_name ?? undefined,
        location: row.location ?? undefined,
        phone: row.phone ?? undefined,
        tier: row.tier ?? undefined,
        score: toIntOrUndefined(row.score),
        status: toLeadStatus(row.status),
        description: row.description ?? undefined,
        about_summary: row.about_summary ?? undefined,
        expertise: row.expertise ?? undefined,
        followers_count: toIntOrUndefined(row.followers_count),
        connections_count: toIntOrUndefined(row.connections_count),
        is_campaigned: "true",
        created_at: now,
        updated_at: now,
      } as Record<string, unknown>
      const { data: insertedRow, error } = await supabase
        .from("leads")
        .insert(leadRow)
        .select("id")
        .single()
      if (error) throw new Error(`leads insert: ${error.message}`)
      inserted++
      if (insertedRow?.id) leadIdsByProfileUrl.set(profileUrl, insertedRow.id)
    }
  }

  for (const [, leadId] of leadIdsByProfileUrl) {
    await supabase.from("lead_campaigns").upsert(
      {
        lead_id: leadId,
        campaign_id: campaignId,
        client_id: clientId || null,
        status: "new",
        joined_at: now,
      },
      { onConflict: "lead_id,client_id" }
    )
  }

  return { inserted, updated, leadIdsByProfileUrl }
}

/** URLs for on-demand enrichment webhook (both called with the same payload). */
const ON_DEMAND_ENRICHMENT_WEBHOOK_URLS = [
  "https://n8n.srv1123126.hstgr.cloud/webhook-test/on-demand-enrichment",
  "https://n8n.srv1123126.hstgr.cloud/webhook/on-demand-enrichment",
] as const

export type OnDemandEnrichmentResult = { sent: boolean; errors: string[] }

/**
 * Send leads to both on-demand enrichment webhooks. Does not throw; returns errors so the flow can continue.
 */
export async function triggerOnDemandEnrichment(
  campaignId: string,
  clientId: string,
  normalized: NormalizedLead[],
  leadIdsByProfileUrl: Map<string, string>
): Promise<OnDemandEnrichmentResult> {
  const leads = normalized
    .filter((row) => (row.profile_url ?? "").trim())
    .map((row) => {
      const profileUrl = (row.profile_url ?? "").trim()
      return {
        lead_id: leadIdsByProfileUrl.get(profileUrl) ?? null,
        profile_url: profileUrl,
        email: row.email ?? null,
        full_name: row.full_name ?? null,
        title: row.title ?? null,
        company_name: row.company_name ?? null,
        location: row.location ?? null,
      }
    })
  const payload = { campaignId, clientId, leads }
  const errors: string[] = []
  for (const url of ON_DEMAND_ENRICHMENT_WEBHOOK_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const t = await res.text()
        errors.push(`${url}: ${res.status} ${t}`)
      }
    } catch (e) {
      errors.push(`${url}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { sent: errors.length === 0, errors }
}

export async function createAirtableTable(
  baseId: string,
  token: string,
  tableName: string,
  fields: Array<{ name: string; type: string; options?: Record<string, unknown> }>
): Promise<{ tableId: string; url: string }> {
  // Airtable API does not support creating button fields; skip them (user adds manually)
  const createFields = fields.filter((f) => f.type !== "button")
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: tableName, fields: createFields }),
  })
  if (!res.ok) {
    const t = await res.text()
    const msg =
      res.status === 403
        ? `Airtable create table: 403 — token may lack schema.bases:write or base may be in a workspace where you're not owner. See docs/CAMPAIGN-MANAGER-AIRTABLE-ENV.md. Raw: ${t.slice(0, 200)}`
        : `Airtable create table: ${res.status} ${t}`
    if (res.status === 404) {
      console.error("[Airtable] 404 NOT_FOUND creating table. Check AIRTABLE_BASE_ID: base may not exist, be deleted, or you may not have access.", { baseId: baseId.slice(0, 6) + "…", tableName, status: res.status, body: t })
    } else if (res.status === 403) {
      console.error("[Airtable] 403 creating table. Check token scope (schema.bases:read, schema.bases:write) and workspace role (owner/creator).", { baseId: baseId.slice(0, 6) + "…", tableName })
    } else {
      console.error("[Airtable] create table failed", { baseId: baseId.slice(0, 6) + "…", tableName, status: res.status, body: t })
    }
    throw new Error(msg)
  }
  const data = (await res.json()) as { id?: string }
  const tableId = data.id ?? ""
  const url = `https://airtable.com/${baseId}/${tableId}`
  return { tableId, url }
}

/** Fetch table schema from Airtable base meta (GET). Returns 403 error when base schema read is not allowed. */
export async function fetchAirtableTableSchema(
  baseId: string,
  token: string,
  tableId: string
): Promise<
  | { error: null; fields: Array<{ name: string; type: string; options?: Record<string, unknown> }> }
  | { error: string; message: string; fields: null }
> {
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await res.text()
  if (res.status === 403) {
    return { error: "403", message: body || "Airtable base schema read not allowed (403)", fields: null }
  }
  if (!res.ok) {
    return { error: String(res.status), message: body || res.statusText, fields: null }
  }
  let data: { tables?: Array<{ id?: string; name?: string; fields?: Array<{ id?: string; name?: string; type?: string; options?: Record<string, unknown> }> }> }
  try {
    data = JSON.parse(body) as typeof data
  } catch {
    return { error: "parse", message: "Invalid JSON from Airtable meta", fields: null }
  }
  const tables = data.tables ?? []
  const table = tables.find((t) => t.id === tableId)
  if (!table?.fields?.length) {
    return { error: "not_found", message: `Table ${tableId} not found or has no fields`, fields: null }
  }
  const fields = table.fields.map((f) => ({
    name: f.name ?? "Unknown",
    type: f.type ?? "singleLineText",
    ...(f.options && Object.keys(f.options).length > 0 ? { options: f.options } : {}),
  }))
  return { error: null, fields }
}

export type ResolvedSchema = {
  schemaSource: "airtable" | "static"
  schemaError?: string
  fields: Array<{ name: string; type: string; options?: Record<string, unknown> }>
}

export async function resolveHitlistSchema(
  baseId: string,
  token: string,
  project: SupabaseProject
): Promise<ResolvedSchema> {
  const templateId = getAirtableTemplateHitlistTableId()
  const accounts = await getUnipileAccounts(project)
  const usernames = accounts.map((a) => a.username).filter(Boolean)
  const selectPosterField = buildSelectPosterField(usernames)

  if (!templateId) {
    return { schemaSource: "static", fields: [...HITLIST_TABLE_FIELDS, selectPosterField] }
  }
  const result = await fetchAirtableTableSchema(baseId, token, templateId)
  if (result.error) {
    return {
      schemaSource: "static",
      schemaError: result.message,
      fields: [...HITLIST_TABLE_FIELDS, selectPosterField],
    }
  }
  const fields = [...(result.fields ?? [])]
  const posterIdx = fields.findIndex((f) => f.name === "Select_Poster")
  if (posterIdx >= 0) {
    fields[posterIdx] = selectPosterField
  } else {
    fields.push(selectPosterField)
  }
  if (fields.every((f) => f.name !== "campaign_id")) {
    fields.push({ name: "campaign_id", type: "singleLineText" })
  }
  return { schemaSource: "airtable", fields }
}

export async function resolveAutoLikeSchema(
  baseId: string,
  token: string,
  project: SupabaseProject
): Promise<ResolvedSchema> {
  const templateId = getAirtableTemplateAutoLikeTableId()
  const accounts = await getUnipileAccounts(project)
  const usernames = accounts.map((a) => a.username).filter(Boolean)
  const selectPosterField = buildSelectPosterField(usernames)

  if (!templateId) {
    const fields = AUTO_LIKE_TABLE_FIELDS.map((f) =>
      f.name === "Select_Poster" ? selectPosterField : f
    )
    return { schemaSource: "static", fields }
  }
  const result = await fetchAirtableTableSchema(baseId, token, templateId)
  if (result.error) {
    const fields = AUTO_LIKE_TABLE_FIELDS.map((f) =>
      f.name === "Select_Poster" ? selectPosterField : f
    )
    return {
      schemaSource: "static",
      schemaError: result.message,
      fields,
    }
  }
  const fields = [...(result.fields ?? [])]
  const posterIdx = fields.findIndex((f) => f.name === "Select_Poster")
  if (posterIdx >= 0) {
    fields[posterIdx] = selectPosterField
  } else {
    fields.push(selectPosterField)
  }
  return { schemaSource: "airtable", fields }
}

export async function appendAirtableRecords(
  baseId: string,
  token: string,
  tableId: string,
  records: Record<string, unknown>[]
): Promise<void> {
  if (records.length === 0) return
  const batchSize = 10 // Airtable limit: max 10 records per request
  for (let i = 0; i < records.length; i += batchSize) {
    const slice = records.slice(i, i + batchSize)
    const res = await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        records: slice.map((fields) => ({ fields })),
      }),
    })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(`Airtable append: ${res.status} ${t}`)
    }
  }
}

export type AirtableRecord = { id: string; fields: Record<string, unknown> }

/** List Airtable records with optional filter. Paginates until all matching records are returned. */
export async function listAirtableRecords(
  baseId: string,
  token: string,
  tableId: string,
  options?: { filterByFormula?: string; pageSize?: number }
): Promise<AirtableRecord[]> {
  const pageSize = options?.pageSize ?? 100
  const out: AirtableRecord[] = []
  let offset: string | undefined
  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`)
    url.searchParams.set("pageSize", String(pageSize))
    if (options?.filterByFormula) url.searchParams.set("filterByFormula", options.filterByFormula)
    if (offset) url.searchParams.set("offset", offset)
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(`Airtable list: ${res.status} ${t}`)
    }
    const data = (await res.json()) as { records?: AirtableRecord[]; offset?: string }
    const records = data.records ?? []
    for (const r of records) {
      if (r.id && r.fields) out.push({ id: r.id, fields: r.fields })
    }
    offset = data.offset
  } while (offset)
  return out
}

/** Delete up to 10 Airtable records by id. */
export async function deleteAirtableRecords(
  baseId: string,
  token: string,
  tableId: string,
  recordIds: string[]
): Promise<void> {
  if (recordIds.length === 0) return
  const ids = recordIds.slice(0, 10)
  const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`)
  ids.forEach((id) => url.searchParams.append("records[]", id))
  const res = await fetch(url.toString(), { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Airtable delete: ${res.status} ${t}`)
  }
}

/** Update one Airtable record by id (partial fields update). */
export async function updateAirtableRecord(
  baseId: string,
  token: string,
  tableId: string,
  recordId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const res = await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}/${recordId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Airtable update: ${res.status} ${t}`)
  }
}

/**
 * Build Airtable record for Hitlist append.
 * - Lead_Scoring: Hot/Warm/Cold, or None when score is missing.
 * - Tier: A/B/C, or None when missing/unknown (static schema includes \"None\" option).
 * - status: single-select \"fresh\" | \"messaged\" | \"invited\"; new leads get \"fresh\".
 * - campaign_id: Supabase campaign id for this hitlist.
 */
function leadToAirtableHitlistFields(lead: NormalizedLead, campaignId: string): Record<string, unknown> {
  const nameParts = (lead.full_name ?? "").split(" ")
  const firstName = nameParts[0] ?? ""
  const lastName = nameParts.slice(1).join(" ") ?? ""
  const rawScore = lead.score
  const score = rawScore ?? 0
  const leadScoring = rawScore == null ? "None" : score >= 70 ? "Hot" : score >= 50 ? "Warm" : "Cold"
  const allowedTiers = ["A", "B", "C", "None"]
  const tier = lead.tier != null && lead.tier !== "" ? String(lead.tier).trim() : null
  const tierValue = tier && allowedTiers.includes(tier) ? tier : (tier === null ? "None" : "None")
  const rawStatus = (lead.status ?? "new").trim().toLowerCase()
  const statusValue =
    rawStatus === "invited" ? "invited" : rawStatus === "messaged" ? "messaged" : "fresh"

  const record: Record<string, unknown> = {
    Enrich_person: lead.full_name ?? "",
    Email: lead.email ?? "",
    LinkedIn: lead.profile_url ?? "",
    campaign_id: campaignId,
    Name: lead.full_name ?? "",
    Title: lead.title ?? "",
    Org: lead.company_name ?? "",
    Headline: lead.expertise ?? "",
    Summary: lead.about_summary ?? "",
    Title_Experience: lead.title ?? "",
    Company_Experience: lead.company_name ?? "",
    Company_Domain: lead.email ? lead.email.split("@")[1] : "",
    Summary_Experience: lead.about_summary ?? "",
    Location_Name: lead.location ?? "",
    Last_Name: lastName,
    First_Name: firstName,
    Work_Email: lead.email ?? "",
    Email_Final: lead.email ?? "",
    Num_Followers: lead.followers_count ?? 0,
    Lead_Scoring: leadScoring,
    Score: score,
    Reasoning: lead.expertise ?? "",
    Mobile_Phone_EMEA: lead.phone ?? "",
    Message_1: "",
    Tempo_1: "",
    Message_2: "",
    Tempo_2: "",
    Message_3: "",
    Tempo_3: "",
    status: statusValue,
  }
  if (tierValue !== undefined) record.Tier = tierValue
  return record
}

export type CreateTableResult = {
  tableId: string
  url: string
  schemaSource: "airtable" | "static"
  schemaError?: string
  fields: AirtableSchemaField[]
}

export async function createHitlistTableAndAppendLeads(
  baseId: string,
  token: string,
  tableName: string,
  leads: NormalizedLead[],
  project: SupabaseProject,
  campaignId: string
): Promise<CreateTableResult> {
  const resolved = await resolveHitlistSchema(baseId, token, project)
  const { tableId, url } = await createAirtableTable(baseId, token, tableName, resolved.fields)
  const records = leads.map((lead) => leadToAirtableHitlistFields(lead, campaignId))
  await appendAirtableRecords(baseId, token, tableId, records)
  const displayFields: AirtableSchemaField[] = resolved.fields.map((f) => ({ name: f.name, type: f.type }))
  return {
    tableId,
    url,
    schemaSource: resolved.schemaSource,
    schemaError: resolved.schemaError,
    fields: displayFields,
  }
}

export async function createAutoLikeTable(
  baseId: string,
  token: string,
  tableName: string,
  project: SupabaseProject
): Promise<CreateTableResult> {
  const resolved = await resolveAutoLikeSchema(baseId, token, project)
  const { tableId, url } = await createAirtableTable(baseId, token, tableName, resolved.fields)
  const displayFields: AirtableSchemaField[] = resolved.fields.map((f) => ({ name: f.name, type: f.type }))
  return {
    tableId,
    url,
    schemaSource: resolved.schemaSource,
    schemaError: resolved.schemaError,
    fields: displayFields,
  }
}

/** Build Auto Like table records from lead_posts for a campaign; then append to the given table. */
export async function appendAutoLikeRecordsFromLeadPosts(
  project: SupabaseProject,
  campaignId: string,
  baseId: string,
  token: string,
  tableId: string
): Promise<{ appended: number; removedEmptyRow: boolean }> {
  const supabase = createClient(project)
  const { data: lcRows } = await supabase
    .from("lead_campaigns")
    .select("lead_id")
    .eq("campaign_id", campaignId)
  const leadIds = (lcRows ?? []).map((r) => (r as { lead_id: string }).lead_id).filter(Boolean)
  if (leadIds.length === 0) return { appended: 0, removedEmptyRow: false }

  const { data: posts } = await supabase
    .from("lead_posts")
    .select("id, lead_id, linkedin_post_id, content, comments, reactions, post_url, commentators, reactioners, lead_name, lead_company")
    .in("lead_id", leadIds)
    .order("created_at", { ascending: false })
  if (!posts?.length) return { appended: 0, removedEmptyRow: false }

  const leadIdsSet = new Set(leadIds)
  const { data: leads } = await supabase
    .from("leads")
    .select("id, profile_url, full_name")
    .in("id", leadIds)
  const profileByLeadId = new Map<string | null, string>()
  const nameByLeadId = new Map<string | null, string>()
  for (const l of leads ?? []) {
    const id = (l as { id: string }).id
    profileByLeadId.set(id, String((l as { profile_url?: string }).profile_url ?? "").trim())
    nameByLeadId.set(id, String((l as { full_name?: string }).full_name ?? "").trim())
  }

  const records: Record<string, unknown>[] = []
  for (const p of posts as Array<{
    lead_id: string
    linkedin_post_id?: string
    content?: string
    comments?: number
    reactions?: number
    post_url?: string
    commentators?: unknown
    reactioners?: unknown
    lead_name?: string
    lead_company?: string
  }>) {
    const leadProfile = profileByLeadId.get(p.lead_id) ?? ""
    const leadName = (p.lead_name ?? nameByLeadId.get(p.lead_id) ?? "").trim() || "—"
    const commentators = p.commentators
    const reactioners = p.reactioners
    const commentatorsCount = Array.isArray(commentators) ? commentators.length : (typeof p.comments === "number" ? p.comments : 0)
    const reactionersCount = Array.isArray(reactioners) ? reactioners.length : (typeof p.reactions === "number" ? p.reactions : 0)
    records.push({
      lead_name: leadName,
      lead_profile: leadProfile || "—",
      tier: "None",
      score: 0,
      campaign_id: campaignId,
      post_content: (p.content ?? "").trim() || "—",
      "commentators(json)": commentators != null ? JSON.stringify(commentators) : "",
      "reactioners(json)": reactioners != null ? JSON.stringify(reactioners) : "",
      commentators_count: commentatorsCount,
      reactioners_count: reactionersCount,
      comment_a: "",
      comment_b: "",
      comment_c: "",
      comment_d: "",
      Reaction: "None",
      Final_Comment: "None",
      Confirm_Column: "None",
      Select_Poster: "None",
      post_id: (p.linkedin_post_id ?? "").trim() || "—",
      post_url: (p.post_url ?? "").trim() || "—",
      Custom_Comment_Data: "",
      title: "",
      location: "",
      expertise: (p.lead_company ?? "").trim() || "",
      Tags: "",
      Confirmation_status: "None",
    })
  }

  await appendAirtableRecords(baseId, token, tableId, records)
  const appended = records.length
  let removedEmptyRow = false
  // When no rows were appended (e.g. lead_posts empty because enrichment is on-demand), remove Airtable's default empty row so the table doesn't show one blank row.
  if (appended === 0) {
    try {
      const existing = await listAirtableRecords(baseId, token, tableId, { pageSize: 1 })
      if (existing.length === 1) {
        const fields = existing[0].fields as Record<string, unknown>
        const hasAnyValue = Object.values(fields).some(
          (v) => v != null && String(v).trim() !== ""
        )
        if (!hasAnyValue) {
          await deleteAirtableRecords(baseId, token, tableId, [existing[0].id])
          removedEmptyRow = true
        }
      }
    } catch {
      // Non-fatal: leave the empty row if delete fails (e.g. permissions)
    }
  }
  return { appended, removedEmptyRow }
}

export async function updateCampaignAirtableUrls(
  project: SupabaseProject,
  campaignId: string,
  urls: { airtableHitlistUrl?: string; airtableAutoLikeCommentUrl?: string }
): Promise<void> {
  const supabase = createClient(project)
  const patch: Record<string, unknown> = {}
  if (urls.airtableHitlistUrl) patch.airtable_hitlist_url = urls.airtableHitlistUrl
  if (urls.airtableAutoLikeCommentUrl) patch.airtable_auto_like_comment_url = urls.airtableAutoLikeCommentUrl
  if (Object.keys(patch).length === 0) return
  const { error } = await supabase.from("campaigns").update(patch).eq("id", campaignId)
  if (error) throw new Error(`campaigns update airtable urls: ${error.message}`)
}

/** Set campaigns.total_leads to the number of leads linked to the campaign. */
export async function updateCampaignLeadCount(
  project: SupabaseProject,
  campaignId: string,
  totalLeads: number
): Promise<void> {
  const supabase = createClient(project)
  const { error } = await supabase
    .from("campaigns")
    .update({ total_leads: totalLeads, updated_at: new Date().toISOString() })
    .eq("id", campaignId)
  if (error) throw new Error(`campaigns update total_leads: ${error.message}`)
}

/** Create in_app_campaign_automations row for hitlist automation (run daily, config + metrics + logs). */
export async function createCampaignAutomationRow(
  project: SupabaseProject,
  campaignId: string,
  airtableBaseId: string,
  airtableTableId: string
): Promise<void> {
  const supabase = createClient(project)
  const { error } = await supabase.from("in_app_campaign_automations").insert({
    campaign_id: campaignId,
    airtable_base_id: airtableBaseId,
    airtable_table_id: airtableTableId,
    is_active: true,
  })
  if (error) throw new Error(`in_app_campaign_automations insert: ${error.message}`)
}

/** Create in_app_auto_comment_automations row when Auto Like table is created (generate 4 comments per post). */
export async function createAutoCommentAutomationRow(
  project: SupabaseProject,
  campaignId: string,
  airtableBaseId: string,
  airtableTableId: string
): Promise<void> {
  const supabase = createClient(project)
  const { error } = await supabase.from("in_app_auto_comment_automations").insert({
    campaign_id: campaignId,
    airtable_base_id: airtableBaseId,
    airtable_table_id: airtableTableId,
    is_active: true,
  })
  if (error) throw new Error(`in_app_auto_comment_automations insert: ${error.message}`)
}

export async function duplicateN8nWorkflow(
  workflowId: string,
  newName: string
): Promise<{ id: string }> {
  const baseUrl = getN8nApiUrl()
  const apiKey = getN8nApiKey()
  if (!baseUrl || !apiKey) throw new Error("N8N_API_URL or N8N_API_KEY not set")

  const getRes = await fetch(`${baseUrl}/api/v1/workflows/${workflowId}`, {
    headers: { "X-N8N-API-KEY": apiKey },
  })
  if (!getRes.ok) throw new Error(`n8n get workflow: ${getRes.status}`)
  const raw = (await getRes.json()) as Record<string, unknown>
  const wf = (raw.data ?? raw) as Record<string, unknown>
  const toDelete = ["id", "createdAt", "updatedAt", "versionId", "meta", "pinData", "activeVersionId", "versionCounter", "triggerCount", "shared", "activeVersion", "active"]
  toDelete.forEach((k) => delete wf[k])
  const body = {
    name: newName,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings ?? {},
    staticData: wf.staticData ?? null,
  }
  const createRes = await fetch(`${baseUrl}/api/v1/workflows`, {
    method: "POST",
    headers: { "X-N8N-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!createRes.ok) {
    const t = await createRes.text()
    throw new Error(`n8n create workflow: ${createRes.status} ${t}`)
  }
  const created = (await createRes.json()) as { data?: { id?: string }; id?: string }
  const id = created.data?.id ?? created.id
  if (!id) throw new Error("n8n workflow create returned no id")
  const activateRes = await fetch(`${baseUrl}/api/v1/workflows/${id}/activate`, {
    method: "POST",
    headers: { "X-N8N-API-KEY": apiKey },
  })
  if (!activateRes.ok) {
    // non-fatal
  }
  return { id }
}

/** Delete an Airtable table (Meta API). */
export async function deleteAirtableTable(
  baseId: string,
  token: string,
  tableId: string
): Promise<void> {
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables/${tableId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Airtable delete table: ${res.status} ${t}`)
  }
}

/** Delete an n8n workflow. */
export async function deleteN8nWorkflow(workflowId: string): Promise<void> {
  const baseUrl = getN8nApiUrl()
  const apiKey = getN8nApiKey()
  if (!baseUrl || !apiKey) throw new Error("N8N_API_URL or N8N_API_KEY not set")
  const res = await fetch(`${baseUrl}/api/v1/workflows/${workflowId}`, {
    method: "DELETE",
    headers: { "X-N8N-API-KEY": apiKey },
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`n8n delete workflow: ${res.status} ${t}`)
  }
}
