"use client"

import * as React from "react"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Trash2Icon, PlayIcon, ExternalLinkIcon, FileTextIcon } from "lucide-react"
import { useSupabaseProject } from "@/lib/supabase-project-context"

const SCHEDULE_OPTIONS: { value: string; label: string }[] = [
  { value: "0 6 * * *", label: "Daily (6:00)" },
  { value: "interval:24", label: "After 1 day" },
  { value: "interval:72", label: "After 3 days" },
  { value: "interval:168", label: "After 1 week" },
]

type RunLogEntry = {
  run_date?: string
  started_at?: string
  finished_at?: string
  status?: string
  invited_count?: number
  to_be_messaged_count?: number
  rejected_count?: number
  leads?: Array<{
    lead_id?: string
    airtable_record_id?: string
    linkedin_url?: string
    step?: string
    unipile_degree?: string
    decision?: string
    error?: string
    unipile_profile_status?: number
    unipile_profile_response?: string
    unipile_invite_status?: number
    unipile_invite_response?: string
    [k: string]: unknown
  }>
}

type AutomationRow = {
  id: string
  campaign_id: string
  campaign_name?: string | null
  airtable_base_id: string
  airtable_table_id: string
  schedule_cron: string
  is_active: boolean
  total_invites_sent: number
  invites_sent_today: number
  total_to_be_messaged: number
  total_rejected: number
  last_run_at: string | null
  last_run_status: string | null
  run_logs: RunLogEntry[]
  created_at: string
  campaign_invites_sent?: number | null
  campaign_messages_sent?: number | null
  campaign_comments_made?: number | null
  campaign_likes_reactions?: number | null
}

export default function CampaignAutomationsPage() {
  const [automations, setAutomations] = React.useState<AutomationRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [runningId, setRunningId] = React.useState<string | null>(null)
  const [updatingScheduleId, setUpdatingScheduleId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [runSuccessId, setRunSuccessId] = React.useState<string | null>(null)
  const { project } = useSupabaseProject()

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/campaign-automations?project=${encodeURIComponent(project)}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || res.statusText || "Failed to load")
        setAutomations([])
        return
      }
      const data = await res.json()
      setAutomations(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
      setAutomations([])
    } finally {
      setLoading(false)
    }
  }, [project])

  React.useEffect(() => {
    load()
  }, [load])

  const handleDelete = async (id: string, campaignName: string | null) => {
    if (!confirm(`Remove automation for "${campaignName ?? id}"? This cannot be undone.`)) return
    setDeletingId(id)
    setError(null)
    try {
      const res = await fetch(
        `/api/campaign-automations/${encodeURIComponent(id)}?project=${encodeURIComponent(project)}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || res.statusText || "Delete failed")
        return
      }
      setAutomations((prev) => prev.filter((a) => a.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed")
    } finally {
      setDeletingId(null)
    }
  }

  const handleRunNow = async (id: string) => {
    setRunningId(id)
    setError(null)
    setRunSuccessId(null)
    try {
      const res = await fetch(
        `/api/campaign-automations/${encodeURIComponent(id)}?project=${encodeURIComponent(project)}`,
        { method: "POST" }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || res.statusText || "Run failed")
        return
      }
      await load()
      setRunSuccessId(id)
      setTimeout(() => setRunSuccessId(null), 5000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed")
    } finally {
      setRunningId(null)
    }
  }

  const handleScheduleChange = async (id: string, scheduleCron: string) => {
    setUpdatingScheduleId(id)
    setError(null)
    try {
      const res = await fetch(
        `/api/campaign-automations/${encodeURIComponent(id)}?project=${encodeURIComponent(project)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schedule_cron: scheduleCron }),
        }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || res.statusText || "Update failed")
        return
      }
      setAutomations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, schedule_cron: scheduleCron } : a))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed")
    } finally {
      setUpdatingScheduleId(null)
    }
  }

  const formatDate = (s: string | null | undefined) =>
    s ? new Date(s).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "—"

  const airtableUrl = (baseId: string, tableId: string) =>
    `https://airtable.com/${baseId}/${tableId}`

  return (
    <AppShell title="Campaign Automations">
      <div className="px-4 lg:px-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Campaign Automations</h2>
          <p className="text-muted-foreground text-sm">
            Hitlist automations created from Campaign Manager. Run now, change schedule, or delete.
            Step-by-step run logs (per lead: fetch → invite / to_be_messaged / rejected) appear under <strong>Logs</strong> for each row.
            <strong>Run now</strong> updates <code className="bg-muted px-1 rounded text-xs">in_app_campaign_automations</code> and <code className="bg-muted px-1 rounded text-xs">campaigns</code> (invites_sent).
            Data is per datasource: <strong>Sales 2k25</strong> and <strong>Prod 2k26</strong> are separate databases with the same schema.
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            Showing: <strong>{project === "prod2k26" ? "Prod 2k26" : "Sales 2k25"}</strong> (change in sidebar)
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 text-destructive px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Automations</CardTitle>
            <CardDescription>
              One row per campaign with in-app hitlist automation. Delete removes the automation only; the campaign stays.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : automations.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No automations yet. Create a campaign in Campaign Manager with &quot;Campaign automation (in-app hitlist)&quot; checked.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Invites</TableHead>
                    <TableHead className="text-right">To message</TableHead>
                    <TableHead>Last run</TableHead>
                    <TableHead>Campaign table (campaigns)</TableHead>
                    <TableHead>Airtable</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {automations.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        {a.campaign_name ?? a.campaign_id.slice(0, 8) + "…"}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={a.schedule_cron}
                          onValueChange={(v) => handleScheduleChange(a.id, v)}
                          disabled={updatingScheduleId === a.id}
                        >
                          <SelectTrigger className="w-[140px] h-8 font-mono text-xs">
                            <SelectValue>
                              {SCHEDULE_OPTIONS.find((o) => o.value === a.schedule_cron)?.label ?? a.schedule_cron}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {SCHEDULE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                            {!SCHEDULE_OPTIONS.some((o) => o.value === a.schedule_cron) && (
                              <SelectItem value={a.schedule_cron}>
                                Custom: {a.schedule_cron}
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            a.is_active
                              ? "text-green-600 dark:text-green-400"
                              : "text-muted-foreground"
                          }
                        >
                          {a.is_active ? "Active" : "Paused"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {a.total_invites_sent}
                        {a.invites_sent_today > 0 && (
                          <span className="text-muted-foreground text-xs ml-1">
                            (+{a.invites_sent_today} today)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{a.total_to_be_messaged}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(a.last_run_at)}
                        {a.last_run_status && (
                          <span className="ml-1 text-xs">({a.last_run_status})</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        <span className="block">Invites: {(a.campaign_invites_sent ?? 0).toLocaleString()}</span>
                        <span className="block">Messages: {(a.campaign_messages_sent ?? 0).toLocaleString()}</span>
                        <span className="block">Comments: {(a.campaign_comments_made ?? 0).toLocaleString()} · Likes: {(a.campaign_likes_reactions ?? 0).toLocaleString()}</span>
                      </TableCell>
                      <TableCell>
                        <a
                          href={airtableUrl(a.airtable_base_id, a.airtable_table_id)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                        >
                          Open <ExternalLinkIcon className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end flex-wrap">
                          {runSuccessId === a.id && (
                            <span className="text-xs text-green-600 dark:text-green-400 mr-1">Run finished — see Logs for steps</span>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            disabled={runningId === a.id}
                            onClick={() => handleRunNow(a.id)}
                          >
                            <PlayIcon className="h-3.5 w-3 mr-1" />
                            {runningId === a.id ? "Running…" : "Run now"}
                          </Button>
                          <Sheet>
                            <SheetTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8">
                                <FileTextIcon className="h-3.5 w-3 mr-1" />
                                Logs
                              </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
                              <SheetHeader>
                                <SheetTitle>Run logs</SheetTitle>
                              </SheetHeader>
                              <LogsPreview runLogs={a.run_logs} formatDate={formatDate} />
                            </SheetContent>
                          </Sheet>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8"
                            disabled={deletingId === a.id}
                            onClick={() => handleDelete(a.id, a.campaign_name ?? null)}
                          >
                            <Trash2Icon className="h-4 w-4 mr-1" />
                            {deletingId === a.id ? "Deleting…" : "Delete"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}

function LogsPreview({
  runLogs,
  formatDate,
}: {
  runLogs: RunLogEntry[]
  formatDate: (s: string | null | undefined) => string
}) {
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null)
  const runs = Array.isArray(runLogs) ? runLogs : []

  if (runs.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-4">No runs yet. Use &quot;Run now&quot; to trigger one.</p>
    )
  }

  return (
    <div className="space-y-3 py-4">
      {runs.slice().reverse().map((run, idx) => {
        const i = runs.length - 1 - idx
        const isExpanded = expandedIndex === i
        const leads = Array.isArray(run.leads) ? run.leads : []
        return (
          <div
            key={i}
            className="rounded-lg border bg-muted/20 overflow-hidden"
          >
            <button
              type="button"
              className="w-full px-3 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-muted/40 transition-colors"
              onClick={() => setExpandedIndex(isExpanded ? null : i)}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-medium">
                  {run.run_date ?? formatDate(run.started_at) ?? `Run ${i + 1}`}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatDate(run.started_at)} → {formatDate(run.finished_at)}
                </span>
                <span
                  className={
                    run.status === "success"
                      ? "text-green-600 dark:text-green-400"
                      : run.status === "error"
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }
                >
                  {run.status ?? "—"}
                </span>
                {(run.invited_count != null || run.to_be_messaged_count != null || run.rejected_count != null) && (
                  <span className="text-xs text-muted-foreground">
                    invited: {run.invited_count ?? 0} · to message: {run.to_be_messaged_count ?? 0} · rejected: {run.rejected_count ?? 0}
                  </span>
                )}
              </div>
              <span className="text-muted-foreground text-xs shrink-0">
                {leads.length} lead{leads.length !== 1 ? "s" : ""} {isExpanded ? "▼" : "▶"}
              </span>
            </button>
            {isExpanded && leads.length > 0 && (
              <div className="border-t bg-background/50 px-3 py-2 space-y-2 max-h-[420px] overflow-y-auto">
                {leads.map((lead, j) => (
                  <div key={j} className="text-xs rounded border p-3 space-y-2">
                    <div className="font-medium truncate" title={lead.linkedin_url ?? ""}>
                      {lead.linkedin_url ? (
                        <a
                          href={lead.linkedin_url.startsWith("http") ? lead.linkedin_url : `https://${lead.linkedin_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          {lead.linkedin_url}
                        </a>
                      ) : (
                        lead.airtable_record_id ?? lead.lead_id ?? `Lead ${j + 1}`
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                      {lead.step != null && <div><span className="text-foreground">Step:</span> {lead.step}</div>}
                      {lead.unipile_degree != null && <div><span className="text-foreground">Degree:</span> {lead.unipile_degree}</div>}
                      {lead.decision != null && <div><span className="text-foreground">Decision:</span> {lead.decision}</div>}
                      {lead.unipile_profile_status != null && (
                        <div><span className="text-foreground">Unipile profile:</span> HTTP {lead.unipile_profile_status}</div>
                      )}
                      {lead.unipile_invite_status != null && (
                        <div><span className="text-foreground">Unipile invite:</span> HTTP {lead.unipile_invite_status}</div>
                      )}
                    </div>
                    {lead.error != null && (
                      <div className="text-destructive font-medium">{lead.error}</div>
                    )}
                    {lead.unipile_profile_response != null && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Profile response</summary>
                        <pre className="mt-1 p-2 rounded bg-muted text-[10px] overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap break-all">
                          {lead.unipile_profile_response}
                        </pre>
                      </details>
                    )}
                    {lead.unipile_invite_response != null && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Invite response</summary>
                        <pre className="mt-1 p-2 rounded bg-muted text-[10px] overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap break-all">
                          {lead.unipile_invite_response}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
