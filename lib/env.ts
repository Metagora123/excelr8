/**
 * Env vars for Supabase. Supports both:
 * - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (your current .env)
 * - VITE_SUPABASE_*, NEXT_PUBLIC_* (alternatives)
 */
function getEnv(key: string): string | undefined {
  if (typeof window !== "undefined") {
    return (process.env as Record<string, string | undefined>)[key]
  }
  const raw = process.env[key] ?? (process.env as Record<string, string | undefined>)[key]
  if (raw == null) return undefined
  // Strip surrounding quotes (e.g. from .env "value")
  const s = String(raw).trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1).trim()
  }
  return s
}

export function getSupabaseUrl(): string {
  return (
    getEnv("SUPABASE_URL") ??
    getEnv("VITE_SUPABASE_URL") ??
    getEnv("NEXT_PUBLIC_SUPABASE_URL") ??
    ""
  ).trim()
}

export function getSupabaseAnonKey(): string {
  return (
    getEnv("SUPABASE_ANON_KEY") ??
    getEnv("VITE_SUPABASE_ANON_KEY") ??
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
    ""
  )
}

/** Service role key (bypasses RLS). Reads SUPABASE_SERVICE_ROLE_KEY or VITE_* from .env. */
export function getSupabaseServiceRoleKey(): string {
  return (
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ??
    getEnv("VITE_SUPABASE_SERVICE_ROLE_KEY") ??
    getEnv("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY") ??
    ""
  ).trim()
}

/** Prod 2k26 project (excelr8 prod 2k26). */
export function getSupabaseUrlProd2k26(): string {
  return (getEnv("SUPABASE_URL_PROD2K26") ?? "").trim()
}
export function getSupabaseServiceRoleKeyProd2k26(): string {
  return (getEnv("SUPABASE_SERVICE_ROLE_KEY_PROD2K26") ?? "").trim()
}

/** Unipile API key for Post Radar. */
export function getUnipileApiKey(): string {
  return (
    getEnv("UNIPILE_API_KEY") ??
    getEnv("VITE_UNIPILE_API_KEY") ??
    ""
  ).trim()
}

/** Unipile API base URL (e.g. for enrichment: api17.unipile.com:14713). Default from n8n workflow. */
export function getUnipileApiBase(): string {
  return (getEnv("UNIPILE_API_BASE") ?? "https://api17.unipile.com:14713").replace(/\/$/, "")
}

/** Unipile account ID for Post Radar. */
export function getUnipileAccountId(): string {
  return (
    getEnv("UNIPILE_ACCOUNT_ID") ??
    getEnv("VITE_UNIPILE_ACCOUNT_ID") ??
    ""
  ).trim()
}

/** OpenAI API key for Post Radar ICP filtering. */
export function getOpenAiApiKey(): string {
  return (
    getEnv("OPENAI_API_KEY") ??
    getEnv("VITE_OPENAI_API_KEY") ??
    ""
  ).trim()
}

/** Gemini / Google AI Studio API key for image generation (newsletter images). */
export function getGeminiApiKey(): string {
  return (getEnv("GEMINI_API_KEY") ?? "").trim()
}

/** Cloudflare R2 (S3-compatible). */
export function getR2AccountId(): string {
  return (getEnv("CLOUDFLARE_R2_ACCOUNT_ID") ?? "").trim()
}
export function getR2AccessKeyId(): string {
  return (getEnv("CLOUDFLARE_R2_ACCESS_KEY_ID") ?? "").trim()
}
export function getR2SecretAccessKey(): string {
  return (getEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY") ?? "").trim()
}
export function getR2BucketName(): string {
  return (getEnv("CLOUDFLARE_R2_BUCKET_NAME") ?? "newsletter").trim()
}
export function getR2Endpoint(): string {
  return (getEnv("CLOUDFLARE_R2_ENDPOINT") ?? "").trim()
}

/** HubSpot Private App access token for CRM sync (contacts, deals, associations). */
export function getHubSpotAccessToken(): string {
  return (
    getEnv("HUBSPOT_ACCESS_TOKEN") ??
    getEnv("HUBSPOT_PRIVATE_APP_ACCESS_TOKEN") ??
    getEnv("HUBSPOT_PERSONAL_ACCESS_KEY") ??
    ""
  ).trim()
}

/** HubSpot API base URL. Use HUBSPOT_API_BASE or set HUBSPOT_EU=true for EU (api-eu1), or HUBSPOT_NA=true for NA (api-na1). Default api.hubapi.com routes automatically. */
export function getHubSpotApiBase(): string {
  const custom = (getEnv("HUBSPOT_API_BASE") ?? "").trim()
  if (custom) return custom.replace(/\/$/, "")
  if (getEnv("HUBSPOT_EU") === "true" || getEnv("HUBSPOT_EU") === "1") {
    return "https://api-eu1.hubapi.com"
  }
  if (getEnv("HUBSPOT_NA") === "true" || getEnv("HUBSPOT_NA") === "1") {
    return "https://api-na1.hubapi.com"
  }
  return "https://api.hubapi.com"
}

/** Airtable PAT for Campaign Manager (create tables, write records). */
export function getAirtableApiKey(): string {
  return (getEnv("AIRTABLE_API_KEY") ?? "").trim()
}

/** Airtable base ID where campaign tables are created. */
export function getAirtableBaseId(): string {
  return (getEnv("AIRTABLE_BASE_ID") ?? "").trim()
}

/** Optional: template table ID to clone schema for Auto Like / Comment table (same base). */
export function getAirtableTemplateAutoLikeTableId(): string {
  return (getEnv("AIRTABLE_TEMPLATE_AUTO_LIKE_TABLE_ID") ?? "").trim()
}

/** Optional: template table ID to clone schema for Hitlist table (same base). */
export function getAirtableTemplateHitlistTableId(): string {
  return (getEnv("AIRTABLE_TEMPLATE_HITLIST_TABLE_ID") ?? "").trim()
}

/** n8n REST API for duplicating workflows (Campaign Manager in-app). */
export function getN8nApiUrl(): string {
  return (getEnv("N8N_API_URL") ?? getEnv("N8N_WEBHOOK_URL") ?? "").replace(/\/$/, "")
}
export function getN8nApiKey(): string {
  return (getEnv("N8N_API_KEY") ?? "").trim()
}
export function getN8nAutoLikeWorkflowId(): string {
  return (getEnv("N8N_AUTO_LIKE_WORKFLOW_ID") ?? "").trim()
}
export function getN8nHitlistWorkflowId(): string {
  return (getEnv("N8N_HITLIST_WORKFLOW_ID") ?? "").trim()
}
/** SendGrid for newsletter email. */
export function getSendGridApiKey(): string {
  return (getEnv("SENDGRID_API_KEY") ?? "").trim()
}
export function getSendGridFromEmail(): string {
  return (getEnv("SENDGRID_FROM_EMAIL") ?? "info@excelr8today.com").trim()
}
export function getSendGridFromName(): string {
  return (getEnv("SENDGRID_FROM_NAME") ?? "Newsletter").trim()
}

/** Secret for authenticating Vercel Cron (or other cron) calls to run-scheduled automations. */
export function getCronSecret(): string {
  return (getEnv("CRON_SECRET") ?? "").trim()
}
