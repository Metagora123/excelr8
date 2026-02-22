/** n8n webhook URL and endpoints. Reads N8N_* or VITE_N8N_* from .env */
function getEnv(key: string): string {
  const raw = process.env[key] ?? ""
  const s = String(raw).trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1).trim()
  return s
}

export function getN8nWebhookUrl(): string {
  return getEnv("N8N_WEBHOOK_URL") || getEnv("VITE_N8N_WEBHOOK_URL") || ""
}

export function getN8nSupabaseTestEndpoint(): string {
  return getEnv("N8N_SUPABASE_TEST_ENDPOINT") || getEnv("VITE_N8N_SUPABASE_TEST_ENDPOINT") || "webhook-test/clay"
}
export function getN8nSupabaseProdEndpoint(): string {
  return getEnv("N8N_SUPABASE_PROD_ENDPOINT") || getEnv("VITE_N8N_SUPABASE_PROD_ENDPOINT") || "webhook/clay"
}
export function getN8nCampaignTestEndpoint(): string {
  return getEnv("N8N_CAMPAIGN_TEST_ENDPOINT") || getEnv("VITE_N8N_CAMPAIGN_TEST_ENDPOINT") || "webhook-test/campaign-manager"
}
export function getN8nCampaignProdEndpoint(): string {
  return getEnv("N8N_CAMPAIGN_PROD_ENDPOINT") || getEnv("VITE_N8N_CAMPAIGN_PROD_ENDPOINT") || "webhook/campaign-manager"
}
export function getN8nNewsletterTestEndpoint(): string {
  return getEnv("N8N_NEWSLETTER_TEST_ENDPOINT") || getEnv("VITE_N8N_NEWSLETTER_TEST_ENDPOINT") || "webhook-test/newsletter"
}
export function getN8nNewsletterProdEndpoint(): string {
  return getEnv("N8N_NEWSLETTER_PROD_ENDPOINT") || getEnv("VITE_N8N_NEWSLETTER_PROD_ENDPOINT") || "webhook/newsletter"
}
