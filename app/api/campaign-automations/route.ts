import { NextResponse } from "next/server"
import { getCampaignAutomations } from "@/lib/campaignAutomationQueries"
import type { SupabaseProject } from "@/lib/supabase"

// Campaign automations: two DBs (sales2k25, prod2k26). Same schema; data per project.
function parseProject(v: string | null): SupabaseProject {
  return v === "prod2k26" ? "prod2k26" : "sales2k25"
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const project = parseProject(url.searchParams.get("project"))

  try {
    const automations = await getCampaignAutomations(project)
    return NextResponse.json(automations)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load automations" },
      { status: 500 }
    )
  }
}
