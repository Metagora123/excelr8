import { NextResponse } from "next/server"
import { getKpiTotals, getAllCampaigns } from "@/lib/campaignQueries"

function parseProject(v: string | null): "sales2k25" | "prod2k26" {
  return v === "prod2k26" ? "prod2k26" : "sales2k25"
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const project = parseProject(searchParams.get("project"))
    const [totals, campaigns] = await Promise.all([getKpiTotals(project), getAllCampaigns(project)])
    return NextResponse.json({ totals, campaigns: campaigns.slice(0, 12) })
  } catch (err) {
    console.error("KPI API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load KPI data" },
      { status: 500 }
    )
  }
}
