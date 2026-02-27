/** n8n webhook URL and endpoints. Reads N8N_* or VITE_N8N_* from .env */
function getEnv(key: string): string {
  const raw = process.env[key] ?? ""
  const s = String(raw).trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1).trim()
  return s
}

export type SupabaseProject = "sales2k25" | "prod2k26"

export function getN8nWebhookUrl(): string {
  return getEnv("N8N_WEBHOOK_URL") || getEnv("VITE_N8N_WEBHOOK_URL") || ""
}

export function getN8nSupabaseTestEndpoint(project: SupabaseProject = "sales2k25"): string {
  if (project === "prod2k26") return getEnv("N8N_SUPABASE_TEST_ENDPOINT_PROD2K26") || "webhook-test/clay-prod2k26"
  return getEnv("N8N_SUPABASE_TEST_ENDPOINT") || getEnv("VITE_N8N_SUPABASE_TEST_ENDPOINT") || "webhook-test/clay"
}
export function getN8nSupabaseProdEndpoint(project: SupabaseProject = "sales2k25"): string {
  if (project === "prod2k26") return getEnv("N8N_SUPABASE_PROD_ENDPOINT_PROD2K26") || "webhook/clay-prod2k26"
  return getEnv("N8N_SUPABASE_PROD_ENDPOINT") || getEnv("VITE_N8N_SUPABASE_PROD_ENDPOINT") || "webhook/clay"
}
export function getN8nCampaignTestEndpoint(project: SupabaseProject = "sales2k25"): string {
  if (project === "prod2k26") return getEnv("N8N_CAMPAIGN_TEST_ENDPOINT_PROD2K26") || "webhook-test/campaign-manager-prod2k26"
  return getEnv("N8N_CAMPAIGN_TEST_ENDPOINT") || getEnv("VITE_N8N_CAMPAIGN_TEST_ENDPOINT") || "webhook-test/campaign-manager"
}
export function getN8nCampaignProdEndpoint(project: SupabaseProject = "sales2k25"): string {
  if (project === "prod2k26") return getEnv("N8N_CAMPAIGN_PROD_ENDPOINT_PROD2K26") || "webhook/campaign-manager-prod2k26"
  return getEnv("N8N_CAMPAIGN_PROD_ENDPOINT") || getEnv("VITE_N8N_CAMPAIGN_PROD_ENDPOINT") || "webhook/campaign-manager"
}
export function getN8nNewsletterTestEndpoint(): string {
  return getEnv("N8N_NEWSLETTER_TEST_ENDPOINT") || getEnv("VITE_N8N_NEWSLETTER_TEST_ENDPOINT") || "webhook-test/newsletter"
}
export function getN8nNewsletterProdEndpoint(): string {
  return getEnv("N8N_NEWSLETTER_PROD_ENDPOINT") || getEnv("VITE_N8N_NEWSLETTER_PROD_ENDPOINT") || "webhook/newsletter"
}
