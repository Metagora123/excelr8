import { NextResponse } from "next/server"
import { getStats, getTimelineData, getAllLeads } from "@/lib/leadQueries"
import { getLatestSyncRun } from "@/lib/syncRuns"

function parseProject(v: string | null): "sales2k25" | "prod2k26" {
  return v === "prod2k26" ? "prod2k26" : "sales2k25"
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const project = parseProject(searchParams.get("project"))
    const [stats, timeline, allLeads, latestSync] = await Promise.all([
      getStats(project),
      getTimelineData(project),
      getAllLeads(project),
      getLatestSyncRun(project),
    ])
    const recentLeads = allLeads.slice(0, 10).map((l) => ({
      id: l.id,
      name: l.name ?? "",
      company: l.company ?? "",
      status: l.status ?? "Unknown",
      tier: l.tier ?? "",
      score: typeof l.score === "number" ? l.score : 0,
      dossierUrl: l.dossier_url ?? "/dossiers",
    }))
    const hubspotSync = latestSync
      ? {
          lastSyncAt: latestSync.created_at,
          status: latestSync.status,
          trigger: latestSync.trigger,
          contacts: latestSync.contacts_synced,
        }
      : null
    return NextResponse.json({
      stats: {
        ...stats,
        dossierPct: stats.total ? (stats.withDossiers / stats.total) * 100 : 0,
      },
      timeline,
      recentLeads,
      hubspotSync,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load dashboard data"
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : undefined
    console.error("Dashboard API error:", err)
    return NextResponse.json(
      { error: message, ...(cause && { cause }) },
      { status: 500 }
    )
  }
}
