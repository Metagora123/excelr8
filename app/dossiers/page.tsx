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
} from "lucide-react"

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
  followers_count?: number | null
  connections_count?: number | null
  created_at?: string | null
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

export default function DossiersPage() {
  const [leads, setLeads] = React.useState<DossierLead[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [tierFilter, setTierFilter] = React.useState<string>("all")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [selected, setSelected] = React.useState<DossierLead | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/dossiers")
      if (res.ok) setLeads(await res.json())
      else setLeads([])
    } catch {
      setLeads([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

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
    <AppShell title="Dossiers" onRefresh={load}>
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
                className="flex flex-col transition-colors hover:bg-muted/50"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12 shrink-0">
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
                <CardContent className="mt-auto flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="default"
                    className="gap-1.5"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelected(lead)
                    }}
                  >
                    <ExternalLinkIcon className="h-3.5 w-3.5" />
                    View
                  </Button>
                  {lead.dossier_url ? (
                    <Button size="sm" variant="outline" className="gap-1.5" asChild>
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <p className="text-muted-foreground text-sm">No dossiers found.</p>
        )}
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-lg bg-background text-foreground">
          {selected && (
            <>
              <SheetHeader className="sr-only">
                <SheetTitle>{selected.name ?? "—"}</SheetTitle>
                <SheetDescription>{selected.title ?? "Lead detail"}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-6 pt-2">
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
                    <div className="flex items-start gap-2">
                      <Building2Icon className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                      <span>{selected.company ?? "—"}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MailIcon className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                      <span>{selected.email ?? "—"}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPinIcon className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                      <span>{selected.location ?? "—"}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <PhoneIcon className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                      <span>{selected.phone ?? "—"}</span>
                    </div>
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

                {/* Footer: Download Dossier + View Profile */}
                <div className="flex flex-col gap-2 pt-2 border-t">
                  <Button asChild className="w-full gap-2">
                    <Link href={selected.dossier_url ?? "#"} target="_blank" rel="noopener noreferrer" download>
                      <DownloadIcon className="h-4 w-4" />
                      Download dossier
                    </Link>
                  </Button>
                  {selected.profile_url && (
                    <Button variant="outline" asChild className="w-full gap-2">
                      <Link href={selected.profile_url} target="_blank" rel="noopener noreferrer">
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
