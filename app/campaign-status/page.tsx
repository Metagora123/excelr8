"use client"

import * as React from "react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { SearchIcon, ExternalLinkIcon } from "lucide-react"
import { useSupabaseProject } from "@/lib/supabase-project-context"

type LeadCampaignEntry = {
  campaign_id: string
  campaign_name: string | null
  status: string | null
  message_status: string | null
  joined_at: string | null
  acceptance_detected_at: string | null
  message_1_sent_at: string | null
  message_2_sent_at: string | null
  message_3_sent_at: string | null
}

type LeadEntry = {
  id: string
  full_name: string | null
  profile_url: string | null
  email: string | null
  company_name: string | null
  title: string | null
  campaigns: LeadCampaignEntry[]
}

type CampaignLeadRow = {
  lead_id: string
  full_name: string | null
  profile_url: string | null
  email: string | null
  company_name: string | null
  title: string | null
  status: string | null
  message_status: string | null
  joined_at: string | null
  acceptance_detected_at: string | null
  message_1_sent_at: string | null
  message_2_sent_at: string | null
  message_3_sent_at: string | null
}

type CampaignRow = {
  id: string
  name: string | null
}

/**
 * Lifecycle pill train. The current step glows; everything before it is
 * green (done), everything after is muted. Tooltip on each pill exposes the
 * timestamp from `lead_campaigns`.
 */
const PILL_ORDER: Array<{
  key: string
  label: string
  reachedBy: (status: string) => boolean
  tsField:
    | "joined_at"
    | "acceptance_detected_at"
    | "message_1_sent_at"
    | "message_2_sent_at"
    | "message_3_sent_at"
    | null
}> = [
  { key: "fresh", label: "Fresh", reachedBy: () => true, tsField: "joined_at" },
  {
    key: "invited",
    label: "Invited",
    reachedBy: (s) =>
      s === "invited" ||
      s === "to_be_messaged" ||
      s === "message_1_sent" ||
      s === "message_2_sent" ||
      s === "messaged" ||
      s === "messaging_failed",
    tsField: null,
  },
  {
    key: "to_be_messaged",
    label: "Accepted",
    reachedBy: (s) =>
      s === "to_be_messaged" ||
      s === "message_1_sent" ||
      s === "message_2_sent" ||
      s === "messaged" ||
      s === "messaging_failed",
    tsField: "acceptance_detected_at",
  },
  {
    key: "message_1_sent",
    label: "M1",
    reachedBy: (s) =>
      s === "message_1_sent" ||
      s === "message_2_sent" ||
      s === "messaged" ||
      s === "messaging_failed",
    tsField: "message_1_sent_at",
  },
  {
    key: "message_2_sent",
    label: "M2",
    reachedBy: (s) => s === "message_2_sent" || s === "messaged" || s === "messaging_failed",
    tsField: "message_2_sent_at",
  },
  {
    key: "messaged",
    label: "Messaged",
    reachedBy: (s) => s === "messaged",
    tsField: "message_3_sent_at",
  },
]

function isTerminalFailure(status: string | null): "invite_failed" | "messaging_failed" | null {
  if (status === "invite_failed") return "invite_failed"
  if (status === "messaging_failed") return "messaging_failed"
  return null
}

function formatDate(s: string | null | undefined): string {
  if (!s) return ""
  try {
    return new Date(s).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
  } catch {
    return s
  }
}

function LifecyclePillTrain({ row }: { row: CampaignLeadRow | LeadCampaignEntry }) {
  const status = (row.message_status ?? row.status ?? "fresh").trim()
  const terminal = isTerminalFailure(status)
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {PILL_ORDER.map((stage) => {
        const reached = stage.reachedBy(status) && !terminal
        const isCurrent = stage.key === status
        const ts = stage.tsField
          ? (row as Record<string, string | null>)[stage.tsField]
          : null
        const cls = isCurrent
          ? "bg-primary text-primary-foreground border-primary"
          : reached
            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
            : "bg-muted text-muted-foreground border-transparent"
        return (
          <span
            key={stage.key}
            title={ts ? `${stage.label} · ${formatDate(ts)}` : stage.label}
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${cls}`}
          >
            {stage.label}
          </span>
        )
      })}
      {terminal && (
        <span
          className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300"
          title={terminal === "invite_failed" ? "Invite permanently failed" : "Messaging permanently failed"}
        >
          {terminal === "invite_failed" ? "Invite failed" : "Messaging failed"}
        </span>
      )}
    </div>
  )
}

const CAMPAIGN_FILTERS = [
  { id: "all", label: "All", match: () => true },
  {
    id: "fresh",
    label: "Fresh",
    match: (s: string) => s === "fresh" || s === "" || s === "new",
  },
  { id: "invited", label: "Invited", match: (s: string) => s === "invited" },
  { id: "to_be_messaged", label: "Accepted", match: (s: string) => s === "to_be_messaged" },
  {
    id: "in_flight",
    label: "Messages in flight",
    match: (s: string) => s === "message_1_sent" || s === "message_2_sent",
  },
  { id: "messaged", label: "Messaged", match: (s: string) => s === "messaged" },
  {
    id: "failures",
    label: "Failures",
    match: (s: string) => s === "invite_failed" || s === "messaging_failed",
  },
]

export default function CampaignStatusPage() {
  const { project } = useSupabaseProject()
  const [tab, setTab] = React.useState<"by-lead" | "by-campaign">("by-lead")

  return (
    <AppShell title="Campaign Status">
      <div className="px-4 lg:px-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Lead Campaign Status</h2>
          <p className="text-muted-foreground text-sm">
            Inspect a single lead across every campaign, or a campaign across every lead. Status pulled from <code className="bg-muted px-1 rounded text-xs">lead_campaigns.message_status</code>.
          </p>
          <p className="text-muted-foreground text-xs mt-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
            If a lead still shows <strong>Accepted</strong> in Airtable but never moved in the dashboard, check the KPI page&apos;s <strong>View run logs</strong> for that campaign—legacy rows that used <code className="text-xs">to_be_messaged</code> for invite failures are only migrated to <code className="text-xs">invite_failed</code> when run logs confirm the origin.
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            Showing: <strong>{project === "prod2k26" ? "Prod 2k26" : "Sales 2k25"}</strong> (change in sidebar)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={tab === "by-lead" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("by-lead")}
          >
            By lead
          </Button>
          <Button
            variant={tab === "by-campaign" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("by-campaign")}
          >
            By campaign
          </Button>
        </div>

        {tab === "by-lead" ? <ByLeadView project={project} /> : <ByCampaignView project={project} />}
      </div>
    </AppShell>
  )
}

function ByLeadView({ project }: { project: "sales2k25" | "prod2k26" }) {
  const [q, setQ] = React.useState("")
  const [leads, setLeads] = React.useState<LeadEntry[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [debounced, setDebounced] = React.useState("")

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250)
    return () => clearTimeout(t)
  }, [q])

  React.useEffect(() => {
    if (debounced.length < 2) {
      setLeads([])
      setError(null)
      return
    }
    let aborted = false
    setLoading(true)
    setError(null)
    fetch(
      `/api/campaign-status?mode=by-lead&q=${encodeURIComponent(debounced)}&project=${encodeURIComponent(project)}`
    )
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (aborted) return
        if (!res.ok) {
          setError(data?.error ?? res.statusText ?? "Search failed")
          setLeads([])
          return
        }
        setLeads(Array.isArray(data.leads) ? data.leads : [])
      })
      .catch((e) => {
        if (aborted) return
        setError(e instanceof Error ? e.message : "Search failed")
      })
      .finally(() => {
        if (!aborted) setLoading(false)
      })
    return () => {
      aborted = true
    }
  }, [debounced, project])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Find a lead</CardTitle>
        <CardDescription>
          Search by name, LinkedIn URL, or email. We show every campaign they’ve been added to.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative max-w-md">
          <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            placeholder="Search a lead…"
            onChange={(e) => setQ(e.target.value)}
            className="pl-8"
          />
        </div>
        {error && (
          <p className="text-destructive text-sm">{error}</p>
        )}
        {loading && <p className="text-muted-foreground text-sm">Searching…</p>}
        {!loading && debounced.length >= 2 && leads.length === 0 && !error && (
          <p className="text-muted-foreground text-sm">No leads matched.</p>
        )}
        <div className="space-y-4">
          {leads.map((lead) => (
            <div key={lead.id} className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <h4 className="text-sm font-semibold">{lead.full_name ?? "Unnamed lead"}</h4>
                {lead.title && <span className="text-xs text-muted-foreground">· {lead.title}</span>}
                {lead.company_name && (
                  <span className="text-xs text-muted-foreground">@ {lead.company_name}</span>
                )}
                {lead.profile_url && (
                  <a
                    href={lead.profile_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
                  >
                    LinkedIn <ExternalLinkIcon className="h-3 w-3" />
                  </a>
                )}
              </div>
              {lead.campaigns.length === 0 ? (
                <p className="text-xs text-muted-foreground">Not in any campaign.</p>
              ) : (
                <div className="space-y-2">
                  {lead.campaigns.map((c) => (
                    <div
                      key={`${lead.id}-${c.campaign_id}`}
                      className="rounded border bg-background p-2.5 space-y-1.5"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-xs font-medium">
                          {c.campaign_name ?? c.campaign_id.slice(0, 8) + "…"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Joined {formatDate(c.joined_at)}
                        </span>
                      </div>
                      <LifecyclePillTrain row={c} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ByCampaignView({ project }: { project: "sales2k25" | "prod2k26" }) {
  const [campaigns, setCampaigns] = React.useState<CampaignRow[]>([])
  const [selectedId, setSelectedId] = React.useState<string>("")
  const [leads, setLeads] = React.useState<CampaignLeadRow[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState("all")
  const [search, setSearch] = React.useState("")

  React.useEffect(() => {
    fetch(`/api/campaigns/list?project=${encodeURIComponent(project)}`)
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        if (Array.isArray(data)) {
          setCampaigns(
            data.map((c: { id: string; name: string | null }) => ({ id: c.id, name: c.name }))
          )
        }
      })
      .catch(() => {})
  }, [project])

  React.useEffect(() => {
    if (!selectedId) {
      setLeads([])
      return
    }
    let aborted = false
    setLoading(true)
    setError(null)
    fetch(
      `/api/campaign-status?mode=by-campaign&campaign_id=${encodeURIComponent(selectedId)}&project=${encodeURIComponent(project)}`
    )
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (aborted) return
        if (!res.ok) {
          setError(data?.error ?? res.statusText ?? "Load failed")
          setLeads([])
          return
        }
        setLeads(Array.isArray(data.leads) ? data.leads : [])
      })
      .catch((e) => {
        if (aborted) return
        setError(e instanceof Error ? e.message : "Load failed")
      })
      .finally(() => {
        if (!aborted) setLoading(false)
      })
    return () => {
      aborted = true
    }
  }, [selectedId, project])

  const filteredLeads = React.useMemo(() => {
    const filterDef = CAMPAIGN_FILTERS.find((f) => f.id === filter) ?? CAMPAIGN_FILTERS[0]
    const term = search.trim().toLowerCase()
    return leads.filter((l) => {
      const s = (l.message_status ?? l.status ?? "fresh").trim()
      if (!filterDef.match(s)) return false
      if (!term) return true
      const haystack = [l.full_name, l.email, l.profile_url, l.title, l.company_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [leads, filter, search])

  const counts = React.useMemo(() => {
    const map: Record<string, number> = {}
    for (const f of CAMPAIGN_FILTERS) {
      map[f.id] = leads.filter((l) =>
        f.match((l.message_status ?? l.status ?? "fresh").trim())
      ).length
    }
    return map
  }, [leads])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pick a campaign</CardTitle>
        <CardDescription>
          Every lead in the campaign, with their current lifecycle stage and timestamps.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select a campaign…" />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name ?? c.id.slice(0, 8) + "…"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative max-w-xs">
            <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              placeholder="Filter leads…"
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>

        {selectedId && (
          <div className="flex flex-wrap gap-1.5">
            {CAMPAIGN_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  filter === f.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-muted"
                }`}
              >
                {f.label} · {counts[f.id] ?? 0}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}
        {loading && <p className="text-muted-foreground text-sm">Loading…</p>}
        {!loading && selectedId && filteredLeads.length === 0 && !error && (
          <p className="text-muted-foreground text-sm">No leads match this filter.</p>
        )}

        <div className="space-y-2">
          {filteredLeads.map((lead) => (
            <div
              key={lead.lead_id}
              className="rounded border bg-background px-3 py-2 flex flex-wrap items-center gap-3"
            >
              <div className="flex-1 min-w-[180px]">
                <div className="text-sm font-medium">
                  {lead.full_name ?? lead.email ?? lead.profile_url ?? lead.lead_id.slice(0, 8) + "…"}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {[lead.title, lead.company_name].filter(Boolean).join(" @ ")}
                </div>
              </div>
              <LifecyclePillTrain row={lead} />
              {lead.profile_url && (
                <Link
                  href={lead.profile_url}
                  target="_blank"
                  className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
                >
                  LinkedIn <ExternalLinkIcon className="h-3 w-3" />
                </Link>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
