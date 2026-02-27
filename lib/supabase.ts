import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseUrl, getSupabaseServiceRoleKey, getSupabaseUrlProd2k26, getSupabaseServiceRoleKeyProd2k26 } from "./env"

export type SupabaseProject = "sales2k25" | "prod2k26"

const clients: Record<SupabaseProject, SupabaseClient | null> = {
  sales2k25: null,
  prod2k26: null,
}

function createClientForProject(project: SupabaseProject): SupabaseClient {
  const url = project === "prod2k26" ? getSupabaseUrlProd2k26() : getSupabaseUrl()
  const key = project === "prod2k26" ? getSupabaseServiceRoleKeyProd2k26() : getSupabaseServiceRoleKey()
  if (!url?.trim() || !key) {
    throw new Error(
      `Missing Supabase env for ${project}. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (sales2k25) or SUPABASE_URL_PROD2K26 and SUPABASE_SERVICE_ROLE_KEY_PROD2K26 (prod2k26) in .env.`
    )
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Supabase client using SERVICE ROLE KEY (bypasses RLS).
 * Use this for server-side dashboard/API — anon key is useless with RLS.
 */
export function createClient(project: SupabaseProject = "sales2k25"): SupabaseClient {
  if (!clients[project]) clients[project] = createClientForProject(project)
  return clients[project]
}

export function getSupabase(project: SupabaseProject = "sales2k25"): SupabaseClient {
  return createClient(project)
}
