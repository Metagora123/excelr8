"use client"

import * as React from "react"
import { AppShell } from "@/components/app-shell"
import { DashboardStatCards } from "@/components/dashboard-stat-cards"
import {
  LeadsByStatusChart,
  LeadsByTierChart,
  LeadGrowthTimeline,
} from "@/components/dashboard-charts"
import { RecentLeadsTable } from "@/components/recent-leads-table"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { mockStats, mockLeads, mockTimelineData } from "./excelr8-data"

type DashboardData = {
  stats: {
    total: number
    withDossiers: number
    dossierPct: number
    averageScore: number
    byStatus: { status: string; value: number }[]
    byTier: { tier: string; value: number }[]
  }
  timeline: { date: string; score: number }[]
  recentLeads: { id: string; name: string; company: string; status: string; tier: string; score: number; dossierUrl: string }[]
}

async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch("/api/dashboard")
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string; cause?: string }
    const msg = err.error || res.statusText || "Failed to load dashboard"
    throw new Error(err.cause ? `${msg}: ${err.cause}` : msg)
  }
  return res.json()
}

export default function DashboardPage() {
  const [data, setData] = React.useState<DashboardData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await fetchDashboard()
      setData(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  const handleRefresh = React.useCallback(() => {
    load()
  }, [load])

  const stats = data?.stats ?? mockStats
  const dossierPct = data?.stats?.dossierPct ?? (mockStats.total ? (mockStats.withDossiers / mockStats.total) * 100 : 0)
  const timeline = data?.timeline ?? mockTimelineData
  const recentLeads = data?.recentLeads ?? mockLeads

  return (
    <AppShell title="Dashboard" onRefresh={handleRefresh}>
      <div className="px-4 lg:px-6">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <p className="text-muted-foreground text-sm">
          Lead stats, charts, and recent leads. Data from Supabase (.env).
        </p>
        {error && (
          <p className="text-destructive mt-1 text-sm">
            {error} — showing fallback data.
          </p>
        )}
      </div>
      <Separator className="px-4 lg:px-6" />

      {loading ? (
        <div className="space-y-6 px-4 lg:px-6">
          <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[250px] rounded-xl" />
          <Skeleton className="h-[250px] rounded-xl" />
        </div>
      ) : (
        <>
          <DashboardStatCards
            total={stats.total}
            withDossiers={stats.withDossiers}
            dossierPct={dossierPct}
            averageScore={stats.averageScore}
          />

          <div className="grid grid-cols-1 gap-4 px-4 @xl/main:grid-cols-2 lg:px-6">
            <LeadsByStatusChart data={stats.byStatus} />
            <LeadsByTierChart data={stats.byTier} />
          </div>

          <div className="px-4 lg:px-6">
            <LeadGrowthTimeline data={timeline} />
          </div>

          <div className="px-4 lg:px-6">
            <RecentLeadsTable leads={recentLeads} />
          </div>
        </>
      )}
    </AppShell>
  )
}
