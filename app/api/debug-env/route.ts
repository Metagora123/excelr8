import { NextResponse } from "next/server"
import { getSupabaseUrl, getSupabaseServiceRoleKey } from "@/lib/env"

/**
 * GET /api/debug-env — confirm VITE_SUPABASE_* are read on the server.
 * Returns only booleans (no secrets). Use to debug 500 on /api/dashboard.
 */
export async function GET() {
  const url = getSupabaseUrl()
  const serviceKey = getSupabaseServiceRoleKey()
  const urlSet = url.length > 0
  const serviceRoleKeySet = serviceKey.length > 0
  return NextResponse.json({
    urlSet,
    serviceRoleKeySet,
    ready: urlSet && serviceRoleKeySet,
    message: urlSet && serviceRoleKeySet
      ? "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set. Dashboard/dossiers should load."
      : !urlSet
        ? "Missing SUPABASE_URL in .env"
        : "Missing SUPABASE_SERVICE_ROLE_KEY in .env",
  })
}
