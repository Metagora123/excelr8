import { NextResponse } from "next/server"
import {
  getSupabaseUrl,
  getSupabaseServiceRoleKey,
  getAirtableApiKey,
  getAirtableBaseId,
  getN8nApiUrl,
  getN8nApiKey,
  getN8nAutoLikeWorkflowId,
  getN8nHitlistWorkflowId,
  getHubSpotAccessToken,
  getHubSpotApiBase,
  getSendGridApiKey,
} from "@/lib/env"

/** Env keys we care about, with label and group. Never expose values to client — only set/not set and safe hint. */
const ENV_SPEC: Array<{ key: string; label: string; group: string }> = [
  { key: "SUPABASE_URL", label: "Supabase URL", group: "Supabase" },
  { key: "SUPABASE_ANON_KEY", label: "Supabase anon key", group: "Supabase" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Supabase service role key", group: "Supabase" },
  { key: "SUPABASE_URL_PROD2K26", label: "Supabase URL (prod2k26)", group: "Supabase" },
  { key: "SUPABASE_SERVICE_ROLE_KEY_PROD2K26", label: "Supabase service role key (prod2k26)", group: "Supabase" },
  { key: "AIRTABLE_API_KEY", label: "Airtable API key / PAT", group: "Airtable" },
  { key: "AIRTABLE_BASE_ID", label: "Airtable base ID", group: "Airtable" },
  { key: "AIRTABLE_BASE_URL_YVES", label: "Airtable base URL (Yves)", group: "Airtable" },
  { key: "AIRTABLE_BASE_URL_ANNA", label: "Airtable base URL (Anna)", group: "Airtable" },
  { key: "AIRTABLE_BASE_URL_HIBAT", label: "Airtable base URL (Hibat)", group: "Airtable" },
  { key: "AIRTABLE_TEMPLATE_AUTO_LIKE_TABLE_ID", label: "Airtable template Auto Like table ID", group: "Airtable" },
  { key: "AIRTABLE_TEMPLATE_HITLIST_TABLE_ID", label: "Airtable template Hitlist table ID", group: "Airtable" },
  { key: "AIRTABLE_TABLE_NAME", label: "Airtable table name (Leads)", group: "Airtable" },
  { key: "N8N_WEBHOOK_URL", label: "n8n webhook base URL", group: "n8n" },
  { key: "N8N_API_URL", label: "n8n API URL", group: "n8n" },
  { key: "N8N_API_KEY", label: "n8n API key", group: "n8n" },
  { key: "N8N_AUTO_LIKE_WORKFLOW_ID", label: "n8n Auto Like workflow ID", group: "n8n" },
  { key: "N8N_HITLIST_WORKFLOW_ID", label: "n8n Hitlist workflow ID", group: "n8n" },
  { key: "N8N_CAMPAIGN_TEST_ENDPOINT", label: "n8n campaign test endpoint", group: "n8n" },
  { key: "N8N_CAMPAIGN_PROD_ENDPOINT", label: "n8n campaign prod endpoint", group: "n8n" },
  { key: "UNIPILE_API_KEY", label: "Unipile API key", group: "Unipile" },
  { key: "UNIPILE_ACCOUNT_ID", label: "Unipile account ID", group: "Unipile" },
  { key: "UNIPILE_API_BASE", label: "Unipile API base URL", group: "Unipile" },
  { key: "HUBSPOT_PERSONAL_ACCESS_KEY", label: "HubSpot personal access key", group: "HubSpot" },
  { key: "HUBSPOT_ACCESS_TOKEN", label: "HubSpot access token", group: "HubSpot" },
  { key: "SENDGRID_API_KEY", label: "SendGrid API key", group: "SendGrid" },
  { key: "SENDGRID_FROM_EMAIL", label: "SendGrid from email", group: "SendGrid" },
  { key: "SENDGRID_FROM_NAME", label: "SendGrid from name", group: "SendGrid" },
  { key: "OPENAI_API_KEY", label: "OpenAI API key", group: "AI" },
  { key: "GEMINI_API_KEY", label: "Gemini API key", group: "AI" },
  { key: "CLOUDFLARE_R2_ACCOUNT_ID", label: "R2 account ID", group: "Cloudflare R2" },
  { key: "CLOUDFLARE_R2_ACCESS_KEY_ID", label: "R2 access key ID", group: "Cloudflare R2" },
  { key: "CLOUDFLARE_R2_SECRET_ACCESS_KEY", label: "R2 secret access key", group: "Cloudflare R2" },
  { key: "CLOUDFLARE_R2_BUCKET_NAME", label: "R2 bucket name", group: "Cloudflare R2" },
  { key: "CLOUDFLARE_R2_ENDPOINT", label: "R2 endpoint", group: "Cloudflare R2" },
  { key: "ADMIN_USERNAME", label: "Admin username", group: "Auth" },
  { key: "ADMIN_PASSWORD_HASH", label: "Admin password hash", group: "Auth" },
  { key: "CRON_SECRET", label: "Cron secret (Vercel)", group: "Cron" },
  { key: "NEXT_PUBLIC_DASHBOARD_URL", label: "Public dashboard base URL (Airtable in-app button origin)", group: "Dashboard" },
]

function getEnv(key: string): string {
  const raw = process.env[key]
  if (raw == null) return ""
  const s = String(raw).trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1).trim()
  }
  return s
}

function isSecretKey(key: string): boolean {
  return /KEY|TOKEN|SECRET|PASSWORD|HASH/i.test(key)
}

function buildVars(): Array<{ key: string; label: string; group: string; set: boolean; hint?: string }> {
  return ENV_SPEC.map(({ key, label, group }) => {
    const value = getEnv(key)
    const set = value.length > 0
    let hint: string | undefined
    if (set && isSecretKey(key)) hint = "•••"
    else if (set && value.length > 40) hint = value.slice(0, 6) + "…"
    else if (set && (key.includes("URL") || key.includes("ENDPOINT"))) hint = value.slice(0, 40) + (value.length > 40 ? "…" : "")
    return { key, label, group, set, hint }
  })
}

type PingResult = { name: string; ok: boolean; detail: string }

function parseAirtableBaseIdFromUrl(url: string): string {
  const m = String(url ?? "").trim().match(/airtable\.com\/(app[a-zA-Z0-9]+)/i)
  return m?.[1] ?? ""
}

async function runPings(): Promise<PingResult[]> {
  const results: PingResult[] = []
  const supabaseUrl = getSupabaseUrl()
  const supabaseKey = getSupabaseServiceRoleKey()
  const airtableBaseId = getAirtableBaseId()
  const airtableKey = getAirtableApiKey()
  const n8nApiUrl = getN8nApiUrl()
  const n8nApiKey = getN8nApiKey()
  const autoLikeId = getN8nAutoLikeWorkflowId()
  const hitlistId = getN8nHitlistWorkflowId()
  const hubspotToken = getHubSpotAccessToken()
  const hubspotBase = getHubSpotApiBase()
  const sendgridKey = getSendGridApiKey()
  const accountBaseUrls = [
    { account: "Yves", key: "AIRTABLE_BASE_URL_YVES" },
    { account: "Anna", key: "AIRTABLE_BASE_URL_ANNA" },
    { account: "Hibat", key: "AIRTABLE_BASE_URL_HIBAT" },
  ] as const

  // Supabase
  if (supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/`, { method: "HEAD", headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } })
      results.push({ name: "Supabase", ok: res.status === 200 || res.status === 404, detail: res.status === 200 ? "OK" : `HTTP ${res.status}` })
    } catch (e) {
      results.push({ name: "Supabase", ok: false, detail: e instanceof Error ? e.message : String(e) })
    }
  } else {
    results.push({ name: "Supabase", ok: false, detail: "Missing URL or service role key" })
  }

  // Airtable: list bases then get base schema
  if (airtableBaseId && airtableKey) {
    try {
      const listRes = await fetch("https://api.airtable.com/v0/meta/bases", { headers: { Authorization: `Bearer ${airtableKey}` } })
      if (!listRes.ok) {
        results.push({ name: "Airtable", ok: false, detail: listRes.status === 403 ? "403 – token may lack schema access or base not in list" : `List bases: HTTP ${listRes.status}` })
      } else {
        const listData = (await listRes.json()) as { bases?: Array<{ id: string; name?: string }> }
        const bases = listData.bases ?? []
        const ourBase = bases.find((b) => b.id === airtableBaseId)
        if (!ourBase) {
          results.push({ name: "Airtable", ok: false, detail: `Base ${airtableBaseId.slice(0, 8)}… not in token's base list` })
        } else {
          const schemaRes = await fetch(`https://api.airtable.com/v0/meta/bases/${airtableBaseId}`, { headers: { Authorization: `Bearer ${airtableKey}` } })
          if (schemaRes.ok) {
            const schemaData = (await schemaRes.json()) as { tables?: unknown[] }
            results.push({ name: "Airtable", ok: true, detail: `OK (${(schemaData.tables ?? []).length} tables)` })
          } else {
            results.push({ name: "Airtable", ok: false, detail: `Schema: HTTP ${schemaRes.status}` })
          }
        }
      }
    } catch (e) {
      results.push({ name: "Airtable", ok: false, detail: e instanceof Error ? e.message : String(e) })
    }
  } else {
    results.push({ name: "Airtable", ok: false, detail: "Missing base ID or API key" })
  }

  // Airtable account-specific base URL checks (optional, but required for account-routed campaign tables)
  for (const entry of accountBaseUrls) {
    const url = getEnv(entry.key)
    if (!url) {
      results.push({ name: `Airtable ${entry.account} base URL`, ok: false, detail: `Missing ${entry.key}` })
      continue
    }
    const parsed = parseAirtableBaseIdFromUrl(url)
    if (!parsed) {
      results.push({ name: `Airtable ${entry.account} base URL`, ok: false, detail: `${entry.key} does not contain a valid app... base ID` })
      continue
    }
    if (!airtableKey) {
      results.push({ name: `Airtable ${entry.account} base URL`, ok: true, detail: `Parsed base ${parsed} (Airtable API key missing, skipped API check)` })
      continue
    }
    try {
      const schemaRes = await fetch(`https://api.airtable.com/v0/meta/bases/${parsed}`, { headers: { Authorization: `Bearer ${airtableKey}` } })
      results.push({
        name: `Airtable ${entry.account} base URL`,
        ok: schemaRes.ok || schemaRes.status === 403,
        detail: schemaRes.ok ? `OK (${parsed})` : `HTTP ${schemaRes.status} (${parsed})`,
      })
    } catch (e) {
      results.push({ name: `Airtable ${entry.account} base URL`, ok: false, detail: e instanceof Error ? e.message : String(e) })
    }
  }

  // n8n workflows
  if (n8nApiUrl && n8nApiKey) {
    for (const [label, id] of [["n8n Auto Like workflow", autoLikeId], ["n8n Hitlist workflow", hitlistId]] as const) {
      if (!id) {
        results.push({ name: label, ok: false, detail: "Missing workflow ID" })
        continue
      }
      try {
        const res = await fetch(`${n8nApiUrl}/api/v1/workflows/${id}`, { headers: { "X-N8N-API-KEY": n8nApiKey } })
        const ok = res.ok
        let detail = `HTTP ${res.status}`
        if (ok) detail = "OK"
        else if (res.status === 401) detail = "Invalid API key"
        else if (res.status === 404) detail = "Workflow not found"
        results.push({ name: label, ok, detail })
      } catch (e) {
        results.push({ name: label, ok: false, detail: e instanceof Error ? e.message : String(e) })
      }
    }
  } else {
    results.push({ name: "n8n Auto Like workflow", ok: false, detail: "Missing N8N_API_URL or N8N_API_KEY" })
    results.push({ name: "n8n Hitlist workflow", ok: false, detail: "Missing N8N_API_URL or N8N_API_KEY" })
  }

  // HubSpot (simple ping: GET /crm/v3/objects/contacts?limit=1)
  if (hubspotToken && hubspotBase) {
    try {
      const res = await fetch(`${hubspotBase}/crm/v3/objects/contacts?limit=1`, { headers: { Authorization: `Bearer ${hubspotToken}` } })
      const ok = res.ok || res.status === 404
      results.push({ name: "HubSpot", ok, detail: ok ? "OK" : `HTTP ${res.status}` })
    } catch (e) {
      results.push({ name: "HubSpot", ok: false, detail: e instanceof Error ? e.message : String(e) })
    }
  } else {
    results.push({ name: "HubSpot", ok: false, detail: "Missing token or API base" })
  }

  // SendGrid (validate API key)
  if (sendgridKey) {
    try {
      const res = await fetch("https://api.sendgrid.com/v3/user/email", { method: "GET", headers: { Authorization: `Bearer ${sendgridKey}` } })
      const ok = res.ok || res.status === 403 // 403 can still mean valid key, wrong scope
      results.push({ name: "SendGrid", ok, detail: ok ? "OK" : `HTTP ${res.status}` })
    } catch (e) {
      results.push({ name: "SendGrid", ok: false, detail: e instanceof Error ? e.message : String(e) })
    }
  } else {
    results.push({ name: "SendGrid", ok: false, detail: "Missing API key" })
  }

  return results
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ping = searchParams.get("ping") === "1" || searchParams.get("ping") === "true"

  const vars = buildVars()
  let pings: PingResult[] | undefined
  if (ping) {
    pings = await runPings()
  }

  return NextResponse.json({ vars, pings })
}