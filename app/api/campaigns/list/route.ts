import { NextResponse } from "next/server"
import { getAllCampaigns } from "@/lib/campaignQueries"
import type { SupabaseProject } from "@/lib/supabase"

function parseProject(v: string | null): SupabaseProject {
  return v === "prod2k26" ? "prod2k26" : "sales2k25"
}

/** Minimal campaign list (id + name) for picker dropdowns. */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const project = parseProject(url.searchParams.get("project"))
  try {
    const campaigns = await getAllCampaigns(project)
    return NextResponse.json(
      campaigns.map((c) => ({ id: c.id, name: c.name }))
    )
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load campaigns" },
      { status: 500 }
    )
  }
}
