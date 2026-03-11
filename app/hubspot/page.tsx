"use client"

import * as React from "react"
import { AppShell } from "@/components/app-shell"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useSupabaseProject } from "@/lib/supabase-project-context"
import { RefreshCwIcon, CheckCircleIcon, XCircleIcon } from "lucide-react"

type SyncResult = {
  ok: boolean
  contacts?: number
  deals?: number
  associations?: number
  stats?: {
    project: string
    apiBase: string
    leads: number
    campaigns: number
    leadCampaigns: number
    leadsWithPosts: number
    dossierNotes: number
    postNotes: number
  }
  logs?: string[]
  preview?: {
    campaigns: {
      id: string
      name: string
      status: string | null
      leadCount: number
    }[]
    leads: {
      id: string
      name: string
      email: string
      company: string
      status: string
    }[]
  }
  contactIds?: string[]
}

export default function HubSpotPage() {
  const { project } = useSupabaseProject()
  const [syncing, setSyncing] = React.useState(false)
  const [result, setResult] = React.useState<SyncResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [phase, setPhase] = React.useState<string | null>(null)
  const timeoutsRef = React.useRef<number[]>([])
  const [lastContactIds, setLastContactIds] = React.useState<string[]>([])
  const [deleting, setDeleting] = React.useState(false)
  const [deleteStatus, setDeleteStatus] = React.useState<string | null>(null)

  const runSync = React.useCallback(async () => {
    setSyncing(true)
    setResult(null)
    setError(null)
    setPhase("Starting sync…")
    // Simple client-side phase progression so the user sees that work is happening.
    // These are approximate and cleared when the request finishes.
    timeoutsRef.current.forEach((id) => window.clearTimeout(id))
    timeoutsRef.current = []
    timeoutsRef.current.push(
      window.setTimeout(() => setPhase("Syncing contacts…"), 3000),
      window.setTimeout(() => setPhase("Syncing campaigns…"), 15000),
      window.setTimeout(() => setPhase("Linking contacts to campaigns…"), 30000),
      window.setTimeout(() => setPhase("Creating notes (dossiers & posts)…"), 45000)
    )
    try {
      const res = await fetch(`/api/hubspot/sync?project=${encodeURIComponent(project)}`, {
        method: "POST",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? res.statusText ?? "Sync failed")
        return
      }
      setResult(data)
      setLastContactIds(Array.isArray(data.contactIds) ? data.contactIds : [])
      setDeleteStatus(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed")
    } finally {
      timeoutsRef.current.forEach((id) => window.clearTimeout(id))
      timeoutsRef.current = []
      setPhase(null)
      setSyncing(false)
    }
  }, [project])

  const deleteLastRun = React.useCallback(async () => {
    if (!lastContactIds.length) return
    setDeleting(true)
    setDeleteStatus(null)
    try {
      const res = await fetch("/api/hubspot/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "run", contactIds: lastContactIds }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? res.statusText ?? "Delete failed")
        return
      }
      setDeleteStatus(
        `Deleted ${data.deleted ?? 0} of ${data.requested ?? 0} contacts from last sync (failed: ${
          data.failed ?? 0
        }).`
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete request failed")
    } finally {
      setDeleting(false)
    }
  }, [lastContactIds])

  const deleteLast24h = React.useCallback(async () => {
    setDeleting(true)
    setDeleteStatus(null)
    try {
      const res = await fetch("/api/hubspot/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "24h" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? res.statusText ?? "Delete failed")
        return
      }
      setDeleteStatus(
        `Deleted ${data.deleted ?? 0} of ${data.requested ?? 0} contacts created in last 24 hours (failed: ${
          data.failed ?? 0
        }).`
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete request failed")
    } finally {
      setDeleting(false)
    }
  }, [])

  return (
    <AppShell title="HubSpot Export">
      <div className="px-4 lg:px-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">HubSpot sync</h2>
          <p className="text-muted-foreground text-sm">
            Push leads, campaigns, lead–campaign links, dossiers, and LinkedIn posts to HubSpot (one portal). Token from .env.
          </p>
        </div>

        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Sync to HubSpot</CardTitle>
            <CardDescription>
              Uses current datasource ({project}). Set HUBSPOT_ACCESS_TOKEN in .env and run sync.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={runSync}
                disabled={syncing || deleting}
                className="w-fit"
              >
                {syncing ? (
                  <>
                    <RefreshCwIcon className="animate-spin" />
                    {phase ?? "Syncing…"}
                  </>
                ) : (
                  <>
                    <RefreshCwIcon />
                    Sync to HubSpot
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={deleteLastRun}
                disabled={syncing || deleting || lastContactIds.length === 0}
              >
                Delete contacts from last sync
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={deleteLast24h}
                disabled={syncing || deleting}
              >
                Delete contacts from last 24h
              </Button>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <XCircleIcon className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {syncing && phase && !error && (
              <p className="text-xs text-muted-foreground">{phase}</p>
            )}

            {deleteStatus && !syncing && (
              <p className="text-xs text-muted-foreground">{deleteStatus}</p>
            )}

            {result?.ok && (
              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 text-foreground">
                  <CheckCircleIcon className="size-4 text-green-600 dark:text-green-500" />
                  <span>Sync complete</span>
                </div>
                <ul className="list-disc list-inside pl-2 space-y-0.5">
                  <li>Contacts (HubSpot): {result.contacts ?? 0}</li>
                  <li>Deals (HubSpot): {result.deals ?? 0}</li>
                  <li>Contact–Deal links: {result.associations ?? 0}</li>
                  {result.stats && (
                    <>
                      <li>Supabase leads: {result.stats.leads}</li>
                      <li>Supabase campaigns: {result.stats.campaigns}</li>
                      <li>Leads with posts: {result.stats.leadsWithPosts}</li>
                      <li>Dossier notes: {result.stats.dossierNotes}</li>
                      <li>Post notes: {result.stats.postNotes}</li>
                      <li className="text-xs text-muted-foreground">
                        API base: {result.stats.apiBase}
                      </li>
                    </>
                  )}
                </ul>

                {result.logs && result.logs.length > 0 && (
                  <div className="mt-2 border-t pt-2 text-xs text-muted-foreground space-y-1">
                    <div className="font-medium text-foreground">Details</div>
                    {result.logs.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {result?.ok && result.preview && (
          <Card>
            <CardHeader>
              <CardTitle>HubSpot CRM preview</CardTitle>
              <CardDescription>
                Snapshot of what this sync represents — based on Supabase data used to create contacts and deals.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2 text-sm">
              <div className="space-y-2">
                <h3 className="font-medium">Campaigns → Deals</h3>
                {result.preview.campaigns.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No campaigns found in Supabase.</p>
                ) : (
                  <ul className="space-y-1">
                    {result.preview.campaigns.map((c) => (
                      <li key={c.id} className="border rounded-md px-2 py-1">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Leads in campaign: {c.leadCount}{" "}
                          {c.status ? `• Status: ${c.status}` : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">Leads → Contacts</h3>
                {result.preview.leads.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No leads found in Supabase.</p>
                ) : (
                  <ul className="space-y-1">
                    {result.preview.leads.map((l) => (
                      <li key={l.id} className="border rounded-md px-2 py-1">
                        <div className="font-medium">
                          {l.name || "(no name)"}{" "}
                          {l.company ? <span className="text-xs text-muted-foreground">• {l.company}</span> : null}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {l.email || "(no email)"}{" "}
                          {l.status ? `• Status: ${l.status}` : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
