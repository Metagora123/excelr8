"use client"

import * as React from "react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import {
  FileTextIcon,
  SearchIcon,
  DownloadIcon,
  ExternalLinkIcon,
  MapPinIcon,
  Building2Icon,
  MailIcon,
  PhoneIcon,
  UserIcon,
  Linkedin,
  TargetIcon,
} from "lucide-react"
import { useSupabaseProject } from "@/lib/supabase-project-context"

type DossierLead = {
  id: string
  name?: string | null
  title?: string | null
  company?: string | null
  location?: string | null
  email?: string | null
  phone?: string | null
  status?: string | null
  tier?: string | null
  score?: number | null
  dossier_url?: string | null
  profile_url?: string | null
  profile_picture_url?: string | null
  about_summary?: string | null
  personality?: string | null
  expertise?: string | null
  tech_stack_tags?: string | null
  company_description?: string | null
  company_info?: {
    industry?: string | null
    segment?: string | null
    type?: string | null
    employee_range?: string | null
    employee_count?: number | null
    year_founded?: number | null
    specialties?: string | string[] | null
    sales_navigator_url?: string | null
    recommended_action?: string | null
    recommended_next_enrichment?: string | null
  } | null
  icp_scores?: {
    priority_score?: number | null
    confidence_score?: number | null
    icp_risk_score?: number | null
    technographic_fit_score?: number | null
    firmographic_fit_score?: number | null
  } | null
  followers_count?: number | null
  connections_count?: number | null
  created_at?: string | null
  campaign_name?: string | null
  campaign_id?: string | null
}
type CampaignOption = {
  id: string
  name: string
}

function getInitials(name: string | null | undefined) {
  if (!name) return "?"
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatDate(s: string | null | undefined) {
  if (!s) return null
  try {
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  } catch {
    return null
  }
}

/** Normalize Clay specialties (array or delimited string) into a clean tag list. */
function toSpecialtyList(v: string | string[] | null | undefined): string[] {
  if (!v) return []
  const raw = Array.isArray(v) ? v : String(v).split(/[,;|]/)
  return raw.map((s) => String(s).replace(/^['"\[\]]+|['"\[\]]+$/g, "").trim()).filter(Boolean)
}

/** Coerce a score value to a number in 0..100, or null. */
function toScore(v: unknown): number | null {
  if (v == null || v === "") return null
  const n = typeof v === "number" ? v : Number(v)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(100, n))
}

/** Ensure URL is absolute so it opens correctly in a new tab. */
function toAbsoluteUrl(url: string | null | undefined): string | null {
  const s = (url ?? "").trim()
  if (!s) return null
  if (s.startsWith("http://") || s.startsWith("https://")) return s
  return `https://${s.replace(/^\/*/, "")}`
}

export default function DossiersPage() {
  const PAGE_SIZE = 9
  const [leads, setLeads] = React.useState<DossierLead[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [hasMore, setHasMore] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [tierFilter, setTierFilter] = React.useState<string>("all")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [selected, setSelected] = React.useState<DossierLead | null>(null)
  const [campaignFilter, setCampaignFilter] = React.useState<string>("all")
  const [campaignOptions, setCampaignOptions] = React.useState<CampaignOption[]>([])
  const { project } = useSupabaseProject()
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null)

  const load = React.useCallback(async (opts?: { reset?: boolean }) => {
    const reset = opts?.reset ?? false
    if (reset) {
      setLoading(true)
    } else {
      if (!hasMore || loadingMore || loading) return
      setLoadingMore(true)
    }
    try {
      const params = new URLSearchParams({ project })
      if (campaignFilter !== "all") {
        params.set("campaignId", campaignFilter)
      }
      params.set("limit", String(PAGE_SIZE))
      params.set("offset", String(reset ? 0 : leads.length))
      const res = await fetch(`/api/dossiers?${params.toString()}`)
      if (res.ok) {
        const payload = (await res.json()) as { items?: DossierLead[]; hasMore?: boolean }
        const items = Array.isArray(payload.items) ? payload.items : []
        setHasMore(Boolean(payload.hasMore))
        if (reset) {
          setLeads(items)
        } else {
          setLeads((prev) => [...prev, ...items])
        }
      } else if (reset) {
        setLeads([])
        setHasMore(false)
      }
    } catch {
      if (reset) setLeads([])
      setHasMore(false)
    } finally {
      if (reset) {
        setLoading(false)
      } else {
        setLoadingMore(false)
      }
    }
  }, [project, campaignFilter, hasMore, loadingMore, loading, leads.length])

  React.useEffect(() => {
    setHasMore(true)
    load({ reset: true })
  }, [project, campaignFilter])

  React.useEffect(() => {
    let cancelled = false
    fetch(`/api/dossiers/campaigns?project=${encodeURIComponent(project)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: CampaignOption[]) => {
        if (!cancelled && Array.isArray(rows)) {
          setCampaignOptions(
            rows
              .filter((r) => (r.name ?? "").trim() !== "")
              .map((r) => ({ id: r.id, name: r.name }))
          )
        }
      })
      .catch(() => {
        if (!cancelled) setCampaignOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [project])

  React.useEffect(() => {
    if (!hasMore || loading || loadingMore) return
    const node = loadMoreRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          load()
        }
      },
      { rootMargin: "200px 0px" }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [load, hasMore, loading, loadingMore])

  const filtered = React.useMemo(() => {
    let list = leads
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (l) =>
          (l.name ?? "").toLowerCase().includes(q) ||
          (l.company ?? "").toLowerCase().includes(q) ||
          (l.title ?? "").toLowerCase().includes(q)
      )
    }
    if (tierFilter !== "all") list = list.filter((l) => (l.tier ?? "") === tierFilter)
    if (statusFilter !== "all") list = list.filter((l) => (l.status ?? "") === statusFilter)
    return list
  }, [leads, search, tierFilter, statusFilter])

  const tiers = React.useMemo(() => Array.from(new Set(leads.map((l) => l.tier).filter(Boolean))) as string[], [leads])
  const statuses = React.useMemo(() => Array.from(new Set(leads.map((l) => l.status).filter(Boolean))) as string[], [leads])
  return (
    <AppShell title="Dossiers" onRefresh={() => load({ reset: true })}>
      <div className="px-4 lg:px-6 space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Dossiers</h2>
            <p className="text-muted-foreground text-sm">
              View and manage lead dossiers ({leads.length} total).
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="relative flex-1 max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, company, title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Tiers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              {tiers.map((t) => (
                <SelectItem key={t} value={t}>Tier {t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={campaignFilter} onValueChange={setCampaignFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All Campaigns" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campaigns</SelectItem>
              {campaignOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((lead) => (
              <Card
                key={lead.id}
                className="flex flex-col transition-all duration-200 hover:bg-muted/70 hover:shadow-md hover:shadow-muted-foreground/10 hover:-translate-y-0.5 hover:ring-2 hover:ring-primary/25 cursor-pointer"
                onClick={() => setSelected(lead)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12 shrink-0">
                      {lead.profile_picture_url && (
                        <AvatarImage src={lead.profile_picture_url} alt="" />
                      )}
                      <AvatarFallback className="text-sm">{getInitials(lead.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <CardTitle className="text-base leading-tight">{lead.name ?? "—"}</CardTitle>
                      {lead.title && (
                        <CardDescription className="text-xs">{lead.title}</CardDescription>
                      )}
                      {lead.company && (
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <Building2Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{lead.company}</span>
                        </div>
                      )}
                      {lead.location && (
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{lead.location}</span>
                        </div>
                      )}
                      {(lead.email ?? "").trim() !== "" && (
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <MailIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{lead.email}</span>
                        </div>
                      )}
                      {(lead.campaign_name ?? "").trim() && (
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <TargetIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{lead.campaign_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {lead.tier && (
                      <Badge variant="secondary" className="text-xs">Tier {lead.tier}</Badge>
                    )}
                    {lead.status && (
                      <Badge variant="outline" className="text-xs">{lead.status}</Badge>
                    )}
                    {typeof lead.score === "number" && (
                      <span className="text-muted-foreground text-xs">Score {lead.score}</span>
                    )}
                    {formatDate(lead.created_at) && (
                      <span className="text-muted-foreground text-xs">{formatDate(lead.created_at)}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="mt-auto flex flex-wrap gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="default"
                    className="gap-1.5 transition-all duration-200 hover:brightness-110 hover:shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelected(lead)
                    }}
                  >
                    <ExternalLinkIcon className="h-3.5 w-3.5" />
                    View
                  </Button>
                  {lead.dossier_url ? (
                    <Button size="sm" variant="outline" className="gap-1.5 transition-all duration-200 hover:bg-muted hover:border-primary/30 hover:shadow-sm" asChild>
                      <Link href={lead.dossier_url} target="_blank" rel="noopener noreferrer">
                        <DownloadIcon className="h-3.5 w-3.5" />
                        Download
                      </Link>
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="gap-1.5" disabled>
                      <DownloadIcon className="h-3.5 w-3.5" />
                      Download
                    </Button>
                  )}
                  {lead.profile_url && (
                    <Button size="sm" variant="outline" className="gap-1.5 transition-all duration-200 hover:bg-muted hover:border-primary/30 hover:shadow-sm" asChild>
                      <Link href={toAbsoluteUrl(lead.profile_url) ?? "#"} target="_blank" rel="noopener noreferrer">
                        <Linkedin className="h-3.5 w-3.5" />
                        LinkedIn
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <p className="text-muted-foreground text-sm">No dossiers found.</p>
        )}
        {!loading && filtered.length > 0 && (
          <div ref={loadMoreRef} className="py-2 text-center text-xs text-muted-foreground">
            {loadingMore ? "Loading more dossiers..." : hasMore ? "Scroll to load more" : "All dossiers loaded"}
          </div>
        )}
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="overflow-y-auto w-full sm:max-w-xl lg:max-w-2xl bg-background text-foreground p-6 sm:p-8 gap-8" overlayClassName="bg-black/20">
          {selected && (
            <>
              <SheetHeader className="sr-only">
                <SheetTitle>{selected.name ?? "—"}</SheetTitle>
                <SheetDescription>{selected.title ?? "Lead detail"}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-8 pt-4">
                {/* Header: avatar + name + title */}
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16 shrink-0 rounded-full border-2 border-muted">
                    {selected.profile_picture_url && (
                      <AvatarImage src={selected.profile_picture_url} alt="" />
                    )}
                    <AvatarFallback className="text-lg rounded-full">{getInitials(selected.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <h2 className="text-xl font-semibold leading-tight">{selected.name ?? "—"}</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">{selected.title ?? "—"}</p>
                  </div>
                </div>

                {/* Contact information */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Contact information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {(selected.company ?? "").trim() && (
                      <div className="flex items-start gap-2">
                        <Building2Icon className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                        <span>{selected.company}</span>
                      </div>
                    )}
                    {(selected.email ?? "").trim() && (
                      <div className="flex items-start gap-2">
                        <MailIcon className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                        <a href={`mailto:${selected.email}`} className="text-primary hover:underline truncate">{selected.email}</a>
                      </div>
                    )}
                    {(selected.location ?? "").trim() && (
                      <div className="flex items-start gap-2">
                        <MapPinIcon className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                        <span>{selected.location}</span>
                      </div>
                    )}
                    {(selected.phone ?? "").trim() && (
                      <div className="flex items-start gap-2">
                        <PhoneIcon className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                        <a href={`tel:${selected.phone}`} className="text-primary hover:underline">{selected.phone}</a>
                      </div>
                    )}
                    {(selected.campaign_name ?? "").trim() && (
                      <div className="flex items-start gap-2 sm:col-span-2">
                        <TargetIcon className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                        <span>{selected.campaign_name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tier & Status badges */}
                <div className="flex flex-wrap gap-2">
                  {selected.tier != null && String(selected.tier).trim() && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                      Tier: {selected.tier}
                    </Badge>
                  )}
                  {selected.status != null && String(selected.status).trim() && (
                    <Badge variant="outline" className="text-muted-foreground">
                      Status: {selected.status}
                    </Badge>
                  )}
                </div>

                {/* About */}
                {(selected.about_summary ?? "").trim() && (
                  <div>
                    <h3 className="text-sm font-semibold mb-1.5">About</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{selected.about_summary}</p>
                  </div>
                )}

                {/* Personality */}
                {(selected.personality ?? "").trim() && (
                  <div>
                    <h3 className="text-sm font-semibold mb-1.5">Personality</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{selected.personality}</p>
                  </div>
                )}

                {/* Expertise */}
                {(selected.expertise ?? "").trim() && (
                  <div>
                    <h3 className="text-sm font-semibold mb-1.5">Expertise</h3>
                    <p className="text-sm text-muted-foreground">{selected.expertise}</p>
                  </div>
                )}

                {/* Tech stack */}
                {(selected.tech_stack_tags ?? "").trim() && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Tech stack</h3>
                    <div className="flex flex-wrap gap-2">
                      {(selected.tech_stack_tags ?? "")
                        .split(/[,;|]/)
                        .map((t) => t.trim())
                        .filter(Boolean)
                        .map((tag) => (
                          <Badge key={tag} variant="secondary" className="font-normal">
                            {tag}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}

                {/* Company overview */}
                {(selected.company_description ?? "").trim() && (
                  <div>
                    <h3 className="text-sm font-semibold mb-1.5">Company overview</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{selected.company_description}</p>
                  </div>
                )}

                {/* Company intelligence (Clay) */}
                {(() => {
                  const ci = selected.company_info
                  if (!ci) return null
                  const facts: { label: string; value: string }[] = []
                  if ((ci.industry ?? "").toString().trim()) facts.push({ label: "Industry", value: String(ci.industry) })
                  if ((ci.segment ?? "").toString().trim()) facts.push({ label: "Segment", value: String(ci.segment) })
                  if ((ci.type ?? "").toString().trim()) facts.push({ label: "Type", value: String(ci.type) })
                  if ((ci.employee_range ?? "").toString().trim()) facts.push({ label: "Employees", value: String(ci.employee_range) })
                  else if (ci.employee_count != null) facts.push({ label: "Employees", value: String(ci.employee_count) })
                  if (ci.year_founded != null && String(ci.year_founded).trim()) facts.push({ label: "Founded", value: String(ci.year_founded) })
                  const specialties = toSpecialtyList(ci.specialties)
                  const salesNav = (ci.sales_navigator_url ?? "").toString().trim()
                  if (facts.length === 0 && specialties.length === 0 && !salesNav) return null
                  return (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Company intelligence</h3>
                      {facts.length > 0 && (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          {facts.map((f) => (
                            <div key={f.label} className="flex flex-col">
                              <span className="text-xs uppercase tracking-wider text-muted-foreground">{f.label}</span>
                              <span>{f.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {specialties.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {specialties.map((tag) => (
                            <Badge key={tag} variant="secondary" className="font-normal">{tag}</Badge>
                          ))}
                        </div>
                      )}
                      {salesNav && (
                        <Button variant="outline" size="sm" asChild className="mt-3 gap-2">
                          <Link href={toAbsoluteUrl(salesNav) ?? "#"} target="_blank" rel="noopener noreferrer">
                            <Linkedin className="h-3.5 w-3.5" />
                            Sales Navigator
                          </Link>
                        </Button>
                      )}
                    </div>
                  )
                })()}

                {/* Fit scorecard (Clay ICP scores) */}
                {(() => {
                  const sc = selected.icp_scores
                  if (!sc) return null
                  const rows: { label: string; value: number; hint?: string }[] = []
                  const push = (label: string, v: unknown, hint?: string) => {
                    const n = toScore(v)
                    if (n != null) rows.push({ label, value: n, hint })
                  }
                  push("Priority", sc.priority_score)
                  push("Confidence", sc.confidence_score)
                  push("ICP risk", sc.icp_risk_score, "lower is better")
                  push("Technographic fit", sc.technographic_fit_score)
                  push("Firmographic fit", sc.firmographic_fit_score)
                  if (rows.length === 0) return null
                  return (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Fit scorecard</h3>
                      <div className="space-y-2.5">
                        {rows.map((r) => (
                          <div key={r.label}>
                            <div className="flex items-center justify-between text-sm">
                              <span>
                                {r.label}
                                {r.hint && <span className="text-muted-foreground"> ({r.hint})</span>}
                              </span>
                              <span className="tabular-nums font-medium">{r.value}</span>
                            </div>
                            <Progress value={r.value} className="mt-1 h-1.5" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Next steps (Clay recommendations) */}
                {(() => {
                  const ci = selected.company_info
                  const action = (ci?.recommended_action ?? "").toString().trim()
                  const next = (ci?.recommended_next_enrichment ?? "").toString().trim()
                  if (!action && !next) return null
                  return (
                    <div>
                      <h3 className="text-sm font-semibold mb-1.5">Next steps</h3>
                      <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                        {action && (
                          <p><span className="font-medium text-foreground">Recommended action: </span>{action}</p>
                        )}
                        {next && (
                          <p><span className="font-medium text-foreground">Next enrichment: </span>{next}</p>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* Social reach */}
                {(typeof selected.followers_count === "number" || typeof selected.connections_count === "number") && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Social reach</h3>
                    <div className="flex gap-6">
                      {typeof selected.followers_count === "number" && (
                        <div>
                          <p className="text-2xl font-semibold tabular-nums">
                            {selected.followers_count.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Followers</p>
                        </div>
                      )}
                      {typeof selected.connections_count === "number" && (
                        <div>
                          <p className="text-2xl font-semibold tabular-nums">
                            {selected.connections_count.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Connections</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Footer: View dossier + Download dossier + View profile */}
                <div className="flex flex-col gap-2 pt-2 border-t">
                  {(selected.dossier_url ?? "").trim() ? (
                    <>
                      <Button asChild variant="outline" className="w-full gap-2">
                        <Link href={toAbsoluteUrl(selected.dossier_url)!} target="_blank" rel="noopener noreferrer">
                          <ExternalLinkIcon className="h-4 w-4" />
                          View dossier
                        </Link>
                      </Button>
                      <Button asChild className="w-full gap-2">
                        <Link href={toAbsoluteUrl(selected.dossier_url)!} target="_blank" rel="noopener noreferrer" download>
                          <DownloadIcon className="h-4 w-4" />
                          Download dossier
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <Button disabled className="w-full gap-2">
                      <DownloadIcon className="h-4 w-4" />
                      Download dossier (no file)
                    </Button>
                  )}
                  {selected.profile_url && (
                    <Button variant="outline" asChild className="w-full gap-2">
                      <Link href={toAbsoluteUrl(selected.profile_url) ?? "#"} target="_blank" rel="noopener noreferrer">
                        <UserIcon className="h-4 w-4" />
                        View profile
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppShell>
  )
}
