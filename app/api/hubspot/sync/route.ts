import { NextResponse } from "next/server"
import type { SupabaseProject } from "@/lib/supabase"
import { getHubSpotAccessToken } from "@/lib/env"
import { runHubSpotSync } from "@/lib/hubspotSync"

function parseProject(v: string | null): SupabaseProject {
  return v === "prod2k26" ? "prod2k26" : "sales2k25"
}

export async function POST(req: Request) {
  try {
    if (!getHubSpotAccessToken()) {
      return NextResponse.json(
        { error: "HUBSPOT_ACCESS_TOKEN is not set. Add it in .env or app settings." },
        { status: 400 }
      )
    }
    const { searchParams } = new URL(req.url)
    const project = parseProject(searchParams.get("project"))
    const result = await runHubSpotSync(project, "manual")
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : "HubSpot sync failed"
    console.error("HubSpot sync error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
