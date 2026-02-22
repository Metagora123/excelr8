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

/** Unipile API key for Post Radar. */
export function getUnipileApiKey(): string {
  return (
    getEnv("UNIPILE_API_KEY") ??
    getEnv("VITE_UNIPILE_API_KEY") ??
    ""
  ).trim()
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
