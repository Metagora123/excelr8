import { NextResponse } from "next/server"
import { getKpiTotals, getAllCampaigns } from "@/lib/campaignQueries"

export async function GET() {
  try {
    const [totals, campaigns] = await Promise.all([getKpiTotals(), getAllCampaigns()])
    return NextResponse.json({ totals, campaigns: campaigns.slice(0, 12) })
  } catch (err) {
    console.error("KPI API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load KPI data" },
      { status: 500 }
    )
  }
}
