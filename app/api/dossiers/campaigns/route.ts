import { NextResponse } from "next/server"
import { getAllCampaigns } from "@/lib/campaignQueries"

function parseProject(v: string | null): "sales2k25" | "prod2k26" {
  return v === "prod2k26" ? "prod2k26" : "sales2k25"
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const project = parseProject(searchParams.get("project"))
    const campaigns = await getAllCampaigns(project)
    const options = campaigns
      .map((c) => ({
        id: c.id,
        name: (c.name ?? "").trim(),
      }))
      .filter((c) => c.name.length > 0)
    return NextResponse.json(options)
  } catch (err) {
    console.error("Dossiers campaigns API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load campaigns" },
      { status: 500 }
    )
  }
}
