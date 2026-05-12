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
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Bar, BarChart, XAxis, YAxis } from "recharts"
import {
  TargetIcon,
  MessageSquareIcon,
  UserPlusIcon,
  HeartIcon,
  SendIcon,
  UserXIcon,
  EyeOffIcon,
  RotateCwIcon,
  ScrollTextIcon,
  ExternalLinkIcon,
  SearchIcon,
  ClockIcon,
  CheckCircle2Icon,
} from "lucide-react"
import { useSupabaseProject } from "@/lib/supabase-project-context"

type KpiTotals = {
  campaigns: number
  messages_sent: number
  invites_sent: number
  comments_made: number
  likes_reactions: number
  send_failed: number
  profile_unreachable: number
  skipped_bad_input: number
  retry_pending: number
  to_be_messaged: number
  messaged: number
}

type CampaignRow = {
  id: string
  name: string | null
  status: string | null
  messages_sent: number | null
  invites_sent: number
  comments_made: number | null
  likes_reactions: number | null
  send_failed: number
  profile_unreachable: number
  skipped_bad_input: number
  retry_pending: number
  to_be_messaged: number
  messaged: number
}

const engagementConfig = {
  messages_sent: { label: "Messages", color: "var(--chart-1)" },
  invites_sent: { label: "Invites", color: "var(--chart-2)" },
  comments_made: { label: "Comments", color: "var(--chart-4)" },
  likes_reactions: { label: "Likes", color: "var(--chart-5)" },
} satisfies ChartConfig

type RunLogLead = {
  airtable_record_id?: string
  linkedin_url?: string
  step?: string
  decision?: string
  error?: string
  unipile_profile_status?: number
  unipile_profile_response?: string
  unipile_invite_status?: number
  unipile_invite_response?: string
  unipile_degree?: string
  transient?: boolean
  messages_generated?: boolean
  messages_error?: string
  message_1?: string
  message_2?: string
  message_3?: string
  automation_id?: string
  run_index?: number
  run_date?: string | null
  run_started_at?: string | null
  run_status?: string | null
}

type RunLogResponse = {
  campaign: {
    id: string
    name: string | null
    status: string | null
    messages_sent: number | null
    invites_sent: number | null
    comments_made: number | null
    likes_reactions: number | null
  } | null
  automations: Array<{
    id: string
    airtable_base_id: string | null
    airtable_table_id: string | null
    total_invites_sent: number
    total_to_be_messaged: number
    total_rejected: number
    last_run_at: string | null
    last_run_status: string | null
    runs: Array<{
      run_date?: string
      started_at?: string
      finished_at?: string
      status?: string
      invited_count?: number
      to_be_messaged_count?: number
      rejected_count?: number
      retry_pending_count?: number
      leads?: RunLogLead[]
    }>
  }>
  buckets: {
    invites_sent: number
    send_failed: number
    profile_unreachable: number
    skipped_bad_input: number
    retry_pending: number
  }
  leads: RunLogLead[]
}

const STEP_FILTERS: Array<{ id: string; label: string; match: (step?: string, transient?: boolean) => boolean }> = [
  { id: "all", label: "All", match: () => true },
  { id: "invited", label: "Invited", match: (s) => s === "invited" },
  { id: "accepted", label: "Accepted", match: (s) => s === "accepted" },
  {
    id: "message_sent",
    label: "Message sent",
    match: (s) =>
      s === "message_1_sent" || s === "message_2_sent" || s === "message_3_sent" || s === "messaged",
  },
  { id: "messaging_failed", label: "Messaging failed", match: (s) => s === "messaging_failed" },
  { id: "send_failed", label: "Invite failed", match: (s) => s === "invite_failed" },
  {
    id: "profile_unreachable",
    label: "Profile unreachable",
    match: (s) => s === "profile_not_found" || s === "unipile_profile_error",
  },
  { id: "skip", label: "Skipped", match: (s) => s === "skip" },
  {
    id: "retry_pending",
    label: "Retry pending",
    match: (s, t) => s === "retry_pending" || t === true,
  },
  { id: "legacy_migration", label: "Legacy migration", match: (s) => s === "legacy_migration" },
]

function stepBadgeVariant(step?: string, transient?: boolean): {
  className: string
  label: string
} {
  if (step === "retry_pending" || transient === true) {
    return { className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30", label: "retry pending" }
  }
  if (step === "invited") {
    return { className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", label: "invited" }
  }
  if (step === "accepted") {
    return { className: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30", label: "accepted" }
  }
  if (step === "message_1_sent") {
    return { className: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30", label: "M1 sent" }
  }
  if (step === "message_2_sent") {
    return { className: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30", label: "M2 sent" }
  }
  if (step === "message_3_sent" || step === "messaged") {
    return { className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", label: "messaged" }
  }
  if (step === "messaging_failed") {
    return { className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30", label: "messaging failed" }
  }
  if (step === "invite_failed") {
    return { className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30", label: "invite failed" }
  }
  if (step === "profile_not_found" || step === "unipile_profile_error") {
    return { className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30", label: "profile unreachable" }
  }
  if (step === "skip") {
    return { className: "bg-muted text-muted-foreground border-border", label: "skipped" }
  }
  if (step === "legacy_migration") {
    return { className: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30", label: "legacy migration" }
  }
  if (step === "run_error") {
    return { className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30", label: "run error" }
  }
  return { className: "bg-muted text-muted-foreground border-border", label: step ?? "—" }
}

function formatRunDate(value?: string | null): string {
  if (!value) return "—"
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    return d.toLocaleString()
  } catch {
    return value
  }
}

export default function KPIDashboardPage() {
  const [totals, setTotals] = React.useState<KpiTotals | null>(null)
  const [campaigns, setCampaigns] = React.useState<CampaignRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedCampaignId, setSelectedCampaignId] = React.useState<string>("__none__")
  const { project } = useSupabaseProject()

  const [logsOpen, setLogsOpen] = React.useState(false)
  const [logsLoading, setLogsLoading] = React.useState(false)
  const [logsError, setLogsError] = React.useState<string | null>(null)
  const [logsData, setLogsData] = React.useState<RunLogResponse | null>(null)
  const [logsFilter, setLogsFilter] = React.useState<string>("all")
  const [logsSearch, setLogsSearch] = React.useState<string>("")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/kpi?project=${encodeURIComponent(project)}`)
      if (res.ok) {
        const data = await res.json()
        setTotals(data.totals)
        setCampaigns(data.campaigns ?? [])
      } else {
        setTotals(null)
        setCampaigns([])
      }
    } catch {
      setTotals(null)
      setCampaigns([])
    } finally {
      setLoading(false)
    }
  }, [project])

  React.useEffect(() => {
    load()
  }, [load])

  const maxInvites = Math.max(totals?.invites_sent ?? 1, 1)
  const maxEngagement = Math.max(
    (totals?.comments_made ?? 0) + (totals?.likes_reactions ?? 0),
    1
  )

  const barData = campaigns.map((c) => ({
    name: (c.name ?? c.id).slice(0, 20),
    messages: c.messages_sent ?? 0,
    invites: c.invites_sent,
    comments: c.comments_made ?? 0,
    likes: c.likes_reactions ?? 0,
  }))

  const selectedCampaign =
    selectedCampaignId && selectedCampaignId !== "__none__"
      ? campaigns.find((c) => c.id === selectedCampaignId)
      : null

  const openRunLogs = React.useCallback(async (campaignId: string) => {
    setLogsOpen(true)
    setLogsLoading(true)
    setLogsError(null)
    setLogsData(null)
    setLogsFilter("all")
    setLogsSearch("")
    try {
      const res = await fetch(
        `/api/kpi/campaign/${encodeURIComponent(campaignId)}?project=${encodeURIComponent(project)}`,
        { cache: "no-store" }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLogsError(data?.error || res.statusText || "Failed to load run logs")
        return
      }
      setLogsData(data as RunLogResponse)
    } catch (e) {
      setLogsError(e instanceof Error ? e.message : "Failed to load run logs")
    } finally {
      setLogsLoading(false)
    }
  }, [project])

  const filteredLogLeads = React.useMemo(() => {
    if (!logsData) return [] as RunLogLead[]
    const matcher = STEP_FILTERS.find((f) => f.id === logsFilter) ?? STEP_FILTERS[0]
    const q = logsSearch.trim().toLowerCase()
    return logsData.leads.filter((l) => {
      if (!matcher.match(l.step, l.transient)) return false
      if (!q) return true
      const haystack = [
        l.linkedin_url,
        l.airtable_record_id,
        l.error,
        l.unipile_profile_response,
        l.unipile_invite_response,
        l.decision,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [logsData, logsFilter, logsSearch])

  const filterCounts = React.useMemo(() => {
    const counts: Record<string, number> = {}
    if (!logsData) return counts
    for (const f of STEP_FILTERS) {
      counts[f.id] = logsData.leads.filter((l) => f.match(l.step, l.transient)).length
    }
    return counts
  }, [logsData])

  return (
    <AppShell title="KPI Dashboard" onRefresh={load}>
      <div className="px-4 lg:px-6 space-y-8">
        <div>
          <h2 className="text-lg font-semibold">Campaign KPI Overview</h2>
          <p className="text-muted-foreground text-sm">
            All campaigns summary and per-campaign details.
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            <strong>Sources:</strong> <code className="bg-muted px-1 rounded">in_app_campaign_automations</code> (invites &amp; outcomes — single source of truth) · <code className="bg-muted px-1 rounded">campaigns</code> (messages &amp; engagement only)
          </p>
        </div>

        {/* ——— All Campaigns (general stats) ——— */}
        <section className="space-y-6">
          <h3 className="text-base font-medium">All Campaigns</h3>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : totals ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Campaigns</CardDescription>
                    <CardTitle className="flex items-center gap-2">
                      <TargetIcon className="h-4 w-4" />
                      {totals.campaigns}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">Table: <code className="bg-muted px-1 rounded">campaigns</code></p>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Messages Sent</CardDescription>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquareIcon className="h-4 w-4" />
                      {totals.messages_sent.toLocaleString()}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">Table: <code className="bg-muted px-1 rounded">campaigns</code></p>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Invites Sent</CardDescription>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlusIcon className="h-4 w-4" />
                      {totals.invites_sent.toLocaleString()}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">Source of truth: <code className="bg-muted px-1 rounded">in_app_campaign_automations</code></p>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Engagement</CardDescription>
                    <CardTitle className="flex items-center gap-2">
                      <HeartIcon className="h-4 w-4" />
                      {(totals.comments_made + totals.likes_reactions).toLocaleString()}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">Table: <code className="bg-muted px-1 rounded">campaigns</code> (comments + likes)</p>
                  </CardHeader>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription title="Accepted the connection and waiting for Message_1.">
                      To be messaged
                    </CardDescription>
                    <CardTitle className="flex items-center gap-2">
                      <ClockIcon className="h-4 w-4" />
                      {(totals.to_be_messaged ?? 0).toLocaleString()}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">Accepted — awaiting M1</p>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription title="Message_3 delivered. Sequence complete.">
                      Messaged
                    </CardDescription>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2Icon className="h-4 w-4" />
                      {(totals.messaged ?? 0).toLocaleString()}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">Full sequence complete (M3 delivered)</p>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription title="LinkedIn refused the invite (already invited, already connected, daily quota, sender flagged)">
                      Invite failed
                    </CardDescription>
                    <CardTitle className="flex items-center gap-2">
                      <SendIcon className="h-4 w-4" />
                      {totals.send_failed.toLocaleString()}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">LinkedIn refused (already invited / connected / quota)</p>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription title="Profile private, restricted, deactivated, or returned 404">
                      Profile unreachable
                    </CardDescription>
                    <CardTitle className="flex items-center gap-2">
                      <EyeOffIcon className="h-4 w-4" />
                      {totals.profile_unreachable.toLocaleString()}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">Private / restricted / not found</p>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription title="Row had no LinkedIn URL or the URL was invalid — never attempted">
                      Skipped — bad input
                    </CardDescription>
                    <CardTitle className="flex items-center gap-2">
                      <UserXIcon className="h-4 w-4" />
                      {totals.skipped_bad_input.toLocaleString()}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">No / invalid LinkedIn URL</p>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription title="Transient errors (rate limit, network, 5xx). Will be retried on the next run.">
                      Retry pending
                    </CardDescription>
                    <CardTitle className="flex items-center gap-2">
                      <RotateCwIcon className="h-4 w-4" />
                      {totals.retry_pending.toLocaleString()}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">429 / 5xx / network — will retry next run</p>
                  </CardHeader>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Outreach & Coverage</CardTitle>
                    <CardDescription>Messages and invites (all campaigns)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Messages sent</p>
                      <Progress value={(totals.messages_sent / maxInvites) * 100} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">{totals.messages_sent}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Invites sent</p>
                      <Progress value={(totals.invites_sent / maxInvites) * 100} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">{totals.invites_sent}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Engagement</CardTitle>
                    <CardDescription>Comments and likes (all campaigns)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Comments</p>
                      <Progress value={(totals.comments_made / maxEngagement) * 100} className="h-2" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Likes</p>
                      <Progress value={(totals.likes_reactions / maxEngagement) * 100} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {barData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>KPIs by campaign</CardTitle>
                    <CardDescription>All campaigns overview</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={engagementConfig} className="h-[300px] w-full">
                      <BarChart data={barData} layout="vertical" margin={{ left: 0 }}>
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="messages" stackId="a" fill="var(--chart-1)" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="invites" stackId="a" fill="var(--chart-2)" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="comments" stackId="a" fill="var(--chart-4)" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="likes" stackId="a" fill="var(--chart-5)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm">No KPI data. Check Supabase campaigns table and env.</p>
          )}
        </section>

        {/* ——— Individual campaign details ——— */}
        <section className="space-y-4">
          <h3 className="text-base font-medium">Campaign details</h3>
          <div className="space-y-2">
            <Label>Select a campaign</Label>
            <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Choose a campaign…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name ?? c.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedCampaign && (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>{selectedCampaign.name ?? selectedCampaign.id}</CardTitle>
                  <CardDescription>
                    {selectedCampaign.status ? `Status: ${selectedCampaign.status}` : "Single campaign metrics"}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openRunLogs(selectedCampaign.id)}
                >
                  <ScrollTextIcon className="mr-2 h-4 w-4" />
                  View run logs
                </Button>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Messages sent</p>
                  <p className="text-lg font-semibold">{(selectedCampaign.messages_sent ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">campaigns</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Invites sent</p>
                  <p className="text-lg font-semibold">{selectedCampaign.invites_sent.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">in_app_campaign_automations</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Comments made</p>
                  <p className="text-lg font-semibold">{(selectedCampaign.comments_made ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">campaigns</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Likes / reactions</p>
                  <p className="text-lg font-semibold">{(selectedCampaign.likes_reactions ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">campaigns</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground" title="LinkedIn refused (already invited / connected / quota)">Send failed</p>
                  <p className="text-lg font-semibold">{selectedCampaign.send_failed.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">run_logs</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground" title="Private / restricted / 404">Profile unreachable</p>
                  <p className="text-lg font-semibold">{selectedCampaign.profile_unreachable.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">run_logs</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground" title="No or invalid LinkedIn URL">Skipped — bad input</p>
                  <p className="text-lg font-semibold">{selectedCampaign.skipped_bad_input.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">run_logs</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground" title="Transient (429 / 5xx / network) — will retry next run">Retry pending</p>
                  <p className="text-lg font-semibold">{selectedCampaign.retry_pending.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">run_logs</p>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        <p className="text-muted-foreground text-xs">
          <strong>Tables:</strong> <code className="bg-muted px-1 rounded">campaigns</code> · <code className="bg-muted px-1 rounded">in_app_campaign_automations</code>
        </p>
      </div>

      <Sheet open={logsOpen} onOpenChange={setLogsOpen}>
        <SheetContent side="right" className="overflow-y-auto sm:max-w-3xl w-full">
          <SheetHeader>
            <SheetTitle>
              {logsData?.campaign?.name ?? "Campaign run logs"}
            </SheetTitle>
            <SheetDescription>
              Per-lead run history from <code className="bg-muted px-1 rounded">in_app_campaign_automations.run_logs</code>.
              Each entry is one lead, one attempt, with the exact Unipile response we got back.
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-6 space-y-4">
            {logsLoading && (
              <div className="space-y-3 mt-4">
                <Skeleton className="h-20 rounded-md" />
                <Skeleton className="h-32 rounded-md" />
                <Skeleton className="h-32 rounded-md" />
              </div>
            )}

            {logsError && (
              <p className="text-sm text-destructive mt-4">{logsError}</p>
            )}

            {!logsLoading && !logsError && logsData && (
              <>
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-5 mt-4">
                  <div className="rounded-md border p-2">
                    <p className="text-[11px] text-muted-foreground">Invites sent</p>
                    <p className="text-base font-semibold">{logsData.buckets.invites_sent.toLocaleString()}</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-[11px] text-muted-foreground">Send failed</p>
                    <p className="text-base font-semibold">{logsData.buckets.send_failed.toLocaleString()}</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-[11px] text-muted-foreground">Profile unreachable</p>
                    <p className="text-base font-semibold">{logsData.buckets.profile_unreachable.toLocaleString()}</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-[11px] text-muted-foreground">Bad input</p>
                    <p className="text-base font-semibold">{logsData.buckets.skipped_bad_input.toLocaleString()}</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-[11px] text-muted-foreground">Retry pending</p>
                    <p className="text-base font-semibold">{logsData.buckets.retry_pending.toLocaleString()}</p>
                  </div>
                </div>

                {logsData.automations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No automation rows for this campaign yet — run the in-app automation at least once.</p>
                ) : (
                  <>
                    <div className="rounded-md border bg-muted/20 p-3 text-xs space-y-1">
                      <p className="font-medium text-foreground">Automation status</p>
                      {logsData.automations.map((a) => (
                        <div key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
                          <span><span className="text-foreground/80">Last run:</span> {formatRunDate(a.last_run_at)}</span>
                          <span><span className="text-foreground/80">Status:</span> {a.last_run_status ?? "—"}</span>
                          <span><span className="text-foreground/80">Total runs:</span> {a.runs.length}</span>
                          <span><span className="text-foreground/80">Invited:</span> {a.total_invites_sent}</span>
                          <span><span className="text-foreground/80">To message:</span> {a.total_to_be_messaged}</span>
                          <span><span className="text-foreground/80">Rejected:</span> {a.total_rejected}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <div className="relative">
                        <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Search LinkedIn URL, error, response…"
                          value={logsSearch}
                          onChange={(e) => setLogsSearch(e.target.value)}
                          className="pl-7 h-8 text-sm"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {STEP_FILTERS.map((f) => (
                          <Button
                            key={f.id}
                            type="button"
                            variant={logsFilter === f.id ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setLogsFilter(f.id)}
                          >
                            {f.label}
                            <span className="ml-1.5 text-[10px] opacity-70">
                              {filterCounts[f.id] ?? 0}
                            </span>
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Showing {filteredLogLeads.length} of {logsData.leads.length} lead attempts
                        {logsSearch.trim() ? ` matching "${logsSearch.trim()}"` : ""}.
                      </p>
                      {filteredLogLeads.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">No matching entries.</p>
                      ) : (
                        <ul className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                          {filteredLogLeads.map((lead, i) => {
                            const badge = stepBadgeVariant(lead.step, lead.transient)
                            return (
                              <li
                                key={`${lead.automation_id}-${lead.run_index ?? 0}-${i}`}
                                className="rounded-md border bg-muted/10 p-3 text-xs space-y-2"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className={badge.className}>
                                    {badge.label}
                                  </Badge>
                                  {lead.unipile_degree && (
                                    <Badge variant="outline" className="text-[10px]">
                                      {lead.unipile_degree}
                                    </Badge>
                                  )}
                                  {lead.transient && (
                                    <Badge variant="outline" className="text-[10px] text-blue-600 dark:text-blue-400 border-blue-500/30">
                                      transient
                                    </Badge>
                                  )}
                                  <span className="text-muted-foreground ml-auto">
                                    {formatRunDate(lead.run_started_at ?? lead.run_date ?? null)}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                  {lead.linkedin_url ? (
                                    <a
                                      href={lead.linkedin_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary underline truncate max-w-full inline-flex items-center gap-1"
                                    >
                                      {lead.linkedin_url}
                                      <ExternalLinkIcon className="h-3 w-3 shrink-0" />
                                    </a>
                                  ) : (
                                    <span className="text-muted-foreground">No LinkedIn URL</span>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 font-mono">
                                  {lead.airtable_record_id && (
                                    <div className="truncate">
                                      <span className="text-muted-foreground">Airtable:</span> {lead.airtable_record_id}
                                    </div>
                                  )}
                                  {lead.decision && (
                                    <div className="truncate">
                                      <span className="text-muted-foreground">Decision:</span> {lead.decision}
                                    </div>
                                  )}
                                  {lead.unipile_profile_status != null && (
                                    <div className="truncate">
                                      <span className="text-muted-foreground">Profile HTTP:</span> {lead.unipile_profile_status}
                                    </div>
                                  )}
                                  {lead.unipile_invite_status != null && (
                                    <div className="truncate">
                                      <span className="text-muted-foreground">Invite HTTP:</span> {lead.unipile_invite_status}
                                    </div>
                                  )}
                                  {lead.messages_generated != null && (
                                    <div className="truncate">
                                      <span className="text-muted-foreground">Messages generated:</span> {lead.messages_generated ? "yes" : "no"}
                                    </div>
                                  )}
                                </div>

                                {lead.error && (
                                  <div>
                                    <p className="text-muted-foreground">Error</p>
                                    <pre className="whitespace-pre-wrap break-words text-[11px] leading-snug font-mono bg-background/40 rounded p-2 border">
                                      {lead.error}
                                    </pre>
                                  </div>
                                )}

                                {lead.unipile_profile_response && (
                                  <details className="text-[11px]">
                                    <summary className="cursor-pointer text-muted-foreground select-none">Profile response snippet</summary>
                                    <pre className="whitespace-pre-wrap break-words font-mono bg-background/40 rounded p-2 border mt-1">
                                      {lead.unipile_profile_response}
                                    </pre>
                                  </details>
                                )}

                                {lead.unipile_invite_response && (
                                  <details className="text-[11px]">
                                    <summary className="cursor-pointer text-muted-foreground select-none">Invite response snippet</summary>
                                    <pre className="whitespace-pre-wrap break-words font-mono bg-background/40 rounded p-2 border mt-1">
                                      {lead.unipile_invite_response}
                                    </pre>
                                  </details>
                                )}

                                {(lead.message_1 || lead.message_2 || lead.message_3) && (
                                  <details className="text-[11px]">
                                    <summary className="cursor-pointer text-muted-foreground select-none">Generated outreach messages</summary>
                                    <div className="space-y-1 mt-1">
                                      {[lead.message_1, lead.message_2, lead.message_3].map((m, idx) =>
                                        m ? (
                                          <div key={idx}>
                                            <p className="text-muted-foreground">Message {idx + 1}</p>
                                            <pre className="whitespace-pre-wrap break-words font-mono bg-background/40 rounded p-2 border">{m}</pre>
                                          </div>
                                        ) : null
                                      )}
                                    </div>
                                  </details>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  )
}
