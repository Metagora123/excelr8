import { NextResponse } from "next/server"
import { getWithDossiers } from "@/lib/leadQueries"

function parseProject(v: string | null): "sales2k25" | "prod2k26" {
  return v === "prod2k26" ? "prod2k26" : "sales2k25"
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const project = parseProject(searchParams.get("project"))
    const campaignId = searchParams.get("campaignId")?.trim() || undefined
    const limitRaw = Number(searchParams.get("limit"))
    const offsetRaw = Number(searchParams.get("offset"))
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : undefined
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0

    const items = await getWithDossiers(project, campaignId, { limit, offset })
    const hasMore = typeof limit === "number" ? items.length === limit : false
    return NextResponse.json({ items, hasMore })
  } catch (err) {
    console.error("Dossiers API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load dossiers" },
      { status: 500 }
    )
  }
}
