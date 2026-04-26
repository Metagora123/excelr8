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
    messages_generated?: boolean
    messages_error?: string
    message_1?: string
    message_2?: string
    message_3?: string
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

type AutoCommentRunLog = {
  run_date?: string
  started_at?: string
  finished_at?: string
  status?: string
  processed_count?: number
  failed_count?: number
  records?: Array<{
    record_id?: string
    lead_name?: string
    post_content_preview?: string
    error?: string
    mode?: "comment_generation" | "monitoring"
    lead_id?: string
    monitored?: boolean
    discovered_count?: number
    new_posts_supabase?: number
    new_posts_airtable?: number
    new_posts_added?: number
    skipped_existing?: number
  }>
  mode?: "comment_generation" | "monitoring"
  discovered_count?: number
  new_posts_added?: number
  skipped_existing?: number
}

type AutoCommentRow = {
  id: string
  campaign_id: string
  campaign_name?: string | null
  airtable_base_id: string
  airtable_table_id: string
  is_active: boolean
  last_run_at: string | null
  last_run_status: string | null
  run_logs: AutoCommentRunLog[]
}

export default function CampaignAutomationsPage() {
  const [automations, setAutomations] = React.useState<AutomationRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [runningId, setRunningId] = React.useState<string | null>(null)
  const [updatingScheduleId, setUpdatingScheduleId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [runSuccessId, setRunSuccessId] = React.useState<string | null>(null)
  const [autoCommentAutomations, setAutoCommentAutomations] = React.useState<AutoCommentRow[]>([])
  const [autoCommentLoading, setAutoCommentLoading] = React.useState(true)
  const [autoCommentRunningId, setAutoCommentRunningId] = React.useState<string | null>(null)
  const [autoCommentMonitoringId, setAutoCommentMonitoringId] = React.useState<string | null>(null)
  const [autoCommentSuccessId, setAutoCommentSuccessId] = React.useState<string | null>(null)
  const [autoCommentMonitoringSuccessId, setAutoCommentMonitoringSuccessId] = React.useState<string | null>(null)
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

  const loadAutoComment = React.useCallback(async () => {
    setAutoCommentLoading(true)
    try {
      const res = await fetch(`/api/auto-comment-automations?project=${encodeURIComponent(project)}`)
      if (res.ok) {
        const data = await res.json()
        setAutoCommentAutomations(Array.isArray(data) ? data : [])
      } else {
        setAutoCommentAutomations([])
      }
    } catch {
      setAutoCommentAutomations([])
    } finally {
      setAutoCommentLoading(false)
    }
  }, [project])

  React.useEffect(() => {
    loadAutoComment()
  }, [loadAutoComment])

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

  const handleAutoCommentRunNow = async (id: string) => {
    setAutoCommentRunningId(id)
    setError(null)
    setAutoCommentSuccessId(null)
    try {
      const res = await fetch(
        `/api/auto-comment-automations/${encodeURIComponent(id)}/run?project=${encodeURIComponent(project)}`,
        { method: "POST" }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || res.statusText || "Run failed")
        return
      }
      await loadAutoComment()
      setAutoCommentSuccessId(id)
      setTimeout(() => setAutoCommentSuccessId(null), 5000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed")
    } finally {
      setAutoCommentRunningId(null)
    }
  }

  const handleAutoCommentMonitorRunNow = async (id: string) => {
    setAutoCommentMonitoringId(id)
    setError(null)
    setAutoCommentMonitoringSuccessId(null)
    try {
      const res = await fetch(
        `/api/auto-comment-automations/${encodeURIComponent(id)}/monitor?project=${encodeURIComponent(project)}`,
        { method: "POST" }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || res.statusText || "Monitoring run failed")
        return
      }
      await loadAutoComment()
      setAutoCommentMonitoringSuccessId(id)
      setTimeout(() => setAutoCommentMonitoringSuccessId(null), 5000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Monitoring run failed")
    } finally {
      setAutoCommentMonitoringId(null)
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
            Step-by-step run logs (per lead: fetch → invited / to_be_messaged / rejected) appear under <strong>Logs</strong> for each row.
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

        <Card>
          <CardHeader>
            <CardTitle>Auto Comment Monitoring</CardTitle>
            <CardDescription>
              One row per campaign with an Auto Like Airtable table. <strong>Monitor posts</strong> discovers newly ingested posts and appends only unseen posts to Airtable (deduped by <code className="bg-muted px-1 rounded text-xs">post_id</code>/<code className="bg-muted px-1 rounded text-xs">post_url</code>). This section only monitors and syncs new posts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {autoCommentLoading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : autoCommentAutomations.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No Auto Comment automations yet. Create a campaign in Campaign Manager with &quot;Auto Like / Auto Comment&quot; checked to get an Auto Like table and this automation.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last run</TableHead>
                    <TableHead>Airtable</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {autoCommentAutomations.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        {a.campaign_name ?? a.campaign_id.slice(0, 8) + "…"}
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
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(a.last_run_at)}
                        {a.last_run_status && (
                          <span className="ml-1 text-xs">({a.last_run_status})</span>
                        )}
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
                          {autoCommentSuccessId === a.id && (
                            <span className="text-xs text-green-600 dark:text-green-400 mr-1">Run finished — see Logs</span>
                          )}
                          {autoCommentMonitoringSuccessId === a.id && (
                            <span className="text-xs text-green-600 dark:text-green-400 mr-1">Monitoring finished — see Logs</span>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            disabled={autoCommentMonitoringId === a.id}
                            onClick={() => handleAutoCommentMonitorRunNow(a.id)}
                          >
                            <PlayIcon className="h-3.5 w-3 mr-1" />
                            {autoCommentMonitoringId === a.id ? "Monitoring…" : "Monitor posts"}
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
                                <SheetTitle>Auto Comment run logs – {a.campaign_name ?? a.campaign_id.slice(0, 8)}</SheetTitle>
                              </SheetHeader>
                              <AutoCommentLogsPreview runLogs={a.run_logs} formatDate={formatDate} />
                            </SheetContent>
                          </Sheet>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Auto Comment Generator</CardTitle>
            <CardDescription>
              Original functionality: generate <code className="bg-muted px-1 rounded text-xs">comment_a</code>, <code className="bg-muted px-1 rounded text-xs">comment_b</code>, <code className="bg-muted px-1 rounded text-xs">comment_c</code>, and <code className="bg-muted px-1 rounded text-xs">comment_d</code> for posts that are missing them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {autoCommentLoading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : autoCommentAutomations.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No Auto Comment automations yet. Create a campaign in Campaign Manager with &quot;Auto Like / Auto Comment&quot; checked to get an Auto Like table and this automation.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last run</TableHead>
                    <TableHead>Airtable</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {autoCommentAutomations.map((a) => (
                    <TableRow key={`generator-${a.id}`}>
                      <TableCell className="font-medium">
                        {a.campaign_name ?? a.campaign_id.slice(0, 8) + "…"}
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
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(a.last_run_at)}
                        {a.last_run_status && (
                          <span className="ml-1 text-xs">({a.last_run_status})</span>
                        )}
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
                          {autoCommentSuccessId === a.id && (
                            <span className="text-xs text-green-600 dark:text-green-400 mr-1">Run finished — see Logs</span>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            disabled={autoCommentRunningId === a.id}
                            onClick={() => handleAutoCommentRunNow(a.id)}
                          >
                            <PlayIcon className="h-3.5 w-3 mr-1" />
                            {autoCommentRunningId === a.id ? "Running…" : "Generate comments"}
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
                                <SheetTitle>Auto Comment run logs – {a.campaign_name ?? a.campaign_id.slice(0, 8)}</SheetTitle>
                              </SheetHeader>
                              <AutoCommentLogsPreview runLogs={a.run_logs} formatDate={formatDate} />
                            </SheetContent>
                          </Sheet>
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

function AutoCommentLogsPreview({
  runLogs,
  formatDate,
}: {
  runLogs: AutoCommentRunLog[]
  formatDate: (s: string | null | undefined) => string
}) {
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null)
  const runs = Array.isArray(runLogs) ? runLogs : []

  if (runs.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-4">No runs yet. Use &quot;Run now&quot; to generate comments.</p>
    )
  }

  return (
    <div className="space-y-3 py-4">
      {runs.slice().reverse().map((run, idx) => {
        const i = runs.length - 1 - idx
        const isExpanded = expandedIndex === i
        const records = Array.isArray(run.records) ? run.records : []
        const monitoringSummary = records.find((r) => r.mode === "monitoring" && r.lead_id === "summary")
        const monitoredLeadsSummary = records.find((r) => r.mode === "monitoring" && r.lead_id === "summary_leads")
        const perLeadMonitoring = records.filter(
          (r) => r.mode === "monitoring" && r.lead_id && r.lead_id !== "summary" && r.lead_id !== "summary_leads"
        )
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
                {(run.processed_count != null || run.failed_count != null) && (
                  <span className="text-xs text-muted-foreground">
                    processed: {run.processed_count ?? 0} · failed: {run.failed_count ?? 0}
                  </span>
                )}
                {monitoringSummary && (
                  <span className="text-xs text-muted-foreground">
                    leads monitored: {monitoredLeadsSummary?.discovered_count ?? 0} · discovered: {monitoringSummary.discovered_count ?? 0} · new in Supabase: {monitoringSummary.new_posts_supabase ?? 0} · new in Airtable: {monitoringSummary.new_posts_airtable ?? 0} · skipped existing: {monitoringSummary.skipped_existing ?? 0}
                  </span>
                )}
              </div>
              <span className="text-muted-foreground text-xs shrink-0">
                {records.length} row{records.length !== 1 ? "s" : ""} {isExpanded ? "▼" : "▶"}
              </span>
            </button>
            {isExpanded && records.length > 0 && (
              <div className="border-t bg-background/50 px-3 py-2 space-y-2 max-h-[420px] overflow-y-auto">
                {perLeadMonitoring.length > 0
                  ? perLeadMonitoring.map((rec, j) => (
                      <div key={j} className="text-xs rounded border p-3 space-y-1">
                        {rec.lead_name != null && <div className="font-medium">{rec.lead_name}</div>}
                        <div className="text-muted-foreground">
                          monitored: {rec.monitored ? "yes" : "no"} · discovered: {rec.discovered_count ?? 0} · new in Supabase: {rec.new_posts_supabase ?? 0} · new in Airtable: {rec.new_posts_airtable ?? 0} · skipped existing: {rec.skipped_existing ?? 0}
                        </div>
                        {rec.error != null && (
                          <div className="text-destructive">{rec.error}</div>
                        )}
                      </div>
                    ))
                  : records.map((rec, j) => (
                  <div key={j} className="text-xs rounded border p-3 space-y-1">
                    {rec.lead_name != null && <div className="font-medium">{rec.lead_name}</div>}
                    {rec.post_content_preview != null && (
                      <div className="text-muted-foreground truncate" title={rec.post_content_preview}>
                        {rec.post_content_preview}
                      </div>
                    )}
                    {rec.error != null && (
                      <div className="text-destructive">{rec.error}</div>
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
                    invited: {run.invited_count ?? 0} · invite failed: {run.to_be_messaged_count ?? 0} · rejected: {run.rejected_count ?? 0}
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
                      {lead.messages_generated === true && (
                        <div><span className="text-foreground">Messages:</span> generated</div>
                      )}
                      {lead.messages_generated === false && lead.messages_error != null && (
                        <div><span className="text-foreground">Messages:</span> failed</div>
                      )}
                      {lead.unipile_profile_status != null && (
                        <div><span className="text-foreground">Unipile profile:</span> HTTP {lead.unipile_profile_status}</div>
                      )}
                      {lead.unipile_invite_status != null && (
                        <div><span className="text-foreground">Unipile invite:</span> HTTP {lead.unipile_invite_status}</div>
                      )}
                    </div>
                    {(lead.message_1 != null || lead.message_2 != null || lead.message_3 != null) && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Generated outreach messages</summary>
                        <div className="mt-2 space-y-2">
                          {lead.message_1 != null && (
                            <div>
                              <span className="text-foreground font-medium">Message 1:</span>
                              <p className="mt-0.5 p-2 rounded bg-muted text-[11px] whitespace-pre-wrap">{lead.message_1}</p>
                            </div>
                          )}
                          {lead.message_2 != null && (
                            <div>
                              <span className="text-foreground font-medium">Message 2:</span>
                              <p className="mt-0.5 p-2 rounded bg-muted text-[11px] whitespace-pre-wrap">{lead.message_2}</p>
                            </div>
                          )}
                          {lead.message_3 != null && (
                            <div>
                              <span className="text-foreground font-medium">Message 3:</span>
                              <p className="mt-0.5 p-2 rounded bg-muted text-[11px] whitespace-pre-wrap">{lead.message_3}</p>
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                    {lead.messages_error != null && (
                      <div className="text-amber-600 dark:text-amber-400 text-xs">Messages error: {lead.messages_error}</div>
                    )}
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
