import { NextResponse } from "next/server"
import type { SupabaseProject } from "@/lib/supabase"
import { getCronSecret, getHubSpotAccessToken } from "@/lib/env"
import { runHubSpotSync } from "@/lib/hubspotSync"

export const maxDuration = 300

const PROJECTS: SupabaseProject[] = ["sales2k25", "prod2k26"]

/**
 * GET (or POST) /api/hubspot/sync-scheduled
 * Called by Vercel Cron once per day. Runs the full HubSpot sync for each project and
 * records a row in hubspot_sync_runs. Secured by CRON_SECRET (Bearer token).
 */
export async function GET(req: Request) {
  const secret = getCronSecret()
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 })
  }
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!getHubSpotAccessToken()) {
    return NextResponse.json({ error: "HUBSPOT_ACCESS_TOKEN is not set" }, { status: 400 })
  }

  console.log("[hubspot/sync-scheduled] triggered at", new Date().toISOString())

  const results: { project: string; status: string; contacts?: number; deals?: number; error?: string }[] = []
  for (const project of PROJECTS) {
    try {
      const r = await runHubSpotSync(project, "scheduled")
      results.push({ project, status: "ok", contacts: r.contacts, deals: r.deals })
    } catch (e) {
      results.push({ project, status: "error", error: e instanceof Error ? e.message : String(e) })
    }
  }

  return NextResponse.json({ ran: results.length, results })
}

export async function POST(req: Request) {
  return GET(req)
}
