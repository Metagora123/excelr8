import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseUrl, getSupabaseServiceRoleKey } from "./env"

let serviceClient: SupabaseClient | null = null

/**
 * Supabase client using SERVICE ROLE KEY (bypasses RLS).
 * Use this for server-side dashboard/API — anon key is useless with RLS.
 */
export function createClient(): SupabaseClient {
  if (serviceClient) return serviceClient
  const url = getSupabaseUrl().trim()
  const serviceKey = getSupabaseServiceRoleKey()
  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase env. Set VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY) in .env so the dashboard can bypass RLS."
    )
  }
  serviceClient = createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return serviceClient
}

export function getSupabase(): SupabaseClient {
  return createClient()
}
