"use client"

import * as React from "react"
import { AppShell } from "@/components/app-shell"
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
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  RadarIcon,
  MessageCircleIcon,
  ThumbsUpIcon,
  SparklesIcon,
  BarChart3Icon,
  CheckIcon,
  DownloadIcon,
} from "lucide-react"
import type { NormalizedPostData, RadarPerson } from "@/app/api/radar/route"

const ICP_STORAGE_KEY = "icpConfig"

const companySizeOptions = ["1-10", "11-50", "51-200", "201-500", "500+"]
const industryOptions = [
  "Technology",
  "Finance",
  "Healthcare",
  "Manufacturing",
  "Retail",
  "Consulting",
  "SaaS",
  "Agency",
  "Other",
]
const jobTitleOptions = [
  "C-Suite",
  "VP",
  "Director",
  "Manager",
  "Head of",
  "Founder",
  "Owner",
  "Lead",
  "Engineer",
  "Other",
]
const locationOptions = ["North America", "Europe", "UK", "APAC", "Remote", "Other"]
const revenueOptions = ["< $1M", "$1M-$10M", "$10M-$50M", "$50M+", "Unknown"]
const techStackOptions = ["Salesforce", "HubSpot", "Microsoft", "Google", "AWS", "Other"]

export type IcpConfig = {
  companySize?: string[]
  industries?: string[]
  jobTitles?: string[]
  locations?: string[]
  revenueRange?: string[]
  techStack?: string[]
  additionalCriteria?: string
}

type IcpMatchResult = {
  matchScore: number
  reasoning: string
  matchedCriteria: string[]
}

type RadarResult = {
  postData: NormalizedPostData
  source: "supabase" | "unipile"
}

function getMatchScoreColor(score: number): string {
  if (score >= 80) return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/50"
  if (score >= 60) return "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/50"
  if (score >= 50) return "bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/50"
  return "bg-muted text-muted-foreground border-border"
}

function escapeCSV(val: string): string {
  const s = String(val ?? "")
  if (s.includes('"') || s.includes(",") || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadCSV(
  rows: { name: string; headline?: string; profile_url?: string; matchScore?: number }[],
  filename: string
) {
  const headers = ["Name", "Headline", "Profile URL", "ICP Match Score"]
  const lines = [headers.map(escapeCSV).join(",")]
  for (const r of rows) {
    lines.push(
      [r.name, r.headline ?? "", r.profile_url ?? "", r.matchScore != null ? String(r.matchScore) : ""]
        .map(escapeCSV)
        .join(",")
    )
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function PostRadarPage() {
  const [postUrl, setPostUrl] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [postData, setPostData] = React.useState<NormalizedPostData | null>(null)
  const [source, setSource] = React.useState<"supabase" | "unipile" | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const [icpConfig, setIcpConfig] = React.useState<IcpConfig>({})
  const [showIcpModal, setShowIcpModal] = React.useState(false)
  const [isFiltering, setIsFiltering] = React.useState(false)
  const [matchResults, setMatchResults] = React.useState<Record<string, IcpMatchResult>>({})
  const [isFilterActive, setIsFilterActive] = React.useState(false)
  const [filteredCommentators, setFilteredCommentators] = React.useState<RadarPerson[]>([])
  const [filteredReactioners, setFilteredReactioners] = React.useState<RadarPerson[]>([])
  const [batchSize, setBatchSize] = React.useState<"10" | "20" | "50" | "all">("20")
  const [showStatsModal, setShowStatsModal] = React.useState(false)
  const [matchThreshold, setMatchThreshold] = React.useState(50)

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(ICP_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as IcpConfig
        setIcpConfig(parsed)
      }
    } catch {
      // ignore
    }
  }, [])

  const saveIcpConfig = React.useCallback((config: IcpConfig) => {
    setIcpConfig(config)
    try {
      localStorage.setItem(ICP_STORAGE_KEY, JSON.stringify(config))
    } catch {
      // ignore
    }
    setShowIcpModal(false)
  }, [])

  const isIcpConfigured = (): boolean => {
    const c = icpConfig
    return !!(
      (c.companySize?.length ?? 0) ||
      (c.industries?.length ?? 0) ||
      (c.jobTitles?.length ?? 0) ||
      (c.locations?.length ?? 0) ||
      (c.revenueRange?.length ?? 0) ||
      (c.techStack?.length ?? 0) ||
      (c.additionalCriteria?.trim?.() ?? "")
    )
  }

  const handleSearch = React.useCallback(async () => {
    if (!postUrl.trim()) return
    setLoading(true)
    setError(null)
    setPostData(null)
    setSource(null)
    setMatchResults({})
    setIsFilterActive(false)
    setFilteredCommentators([])
    setFilteredReactioners([])
    try {
      const res = await fetch("/api/radar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: postUrl.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((data as { error?: string }).error || res.statusText || "Search failed")
        return
      }
      const result = data as RadarResult
      setPostData(result.postData)
      setSource(result.source)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed")
    } finally {
      setLoading(false)
    }
  }, [postUrl])

  const resetFilter = React.useCallback(() => {
    setMatchResults({})
    setIsFilterActive(false)
    setFilteredCommentators([])
    setFilteredReactioners([])
  }, [])

  const getPersonKey = (p: RadarPerson, index: number): string =>
    (p.profile_url && p.profile_url.trim()) ? p.profile_url : `index:${index}`

  const filterByICP = React.useCallback(async () => {
    if (!postData) return
    const commentators = postData.commentators ?? []
    const reactioners = postData.reactioners ?? []
    let idx = 0
    const people: { index: number; name: string; headline?: string; profile_url?: string; type: "commentator" | "reactioner" }[] = []
    commentators.forEach((p) => {
      people.push({
        index: idx++,
        name: p.name,
        headline: p.headline,
        profile_url: p.profile_url,
        type: "commentator",
      })
    })
    reactioners.forEach((p) => {
      people.push({
        index: idx++,
        name: p.name,
        headline: p.headline,
        profile_url: p.profile_url,
        type: "reactioner",
      })
    })
    if (people.length === 0) return

    const size = batchSize === "all" ? people.length : Math.min(parseInt(batchSize, 10), people.length)
    setIsFiltering(true)
    const allResults: Record<string, IcpMatchResult> = {}
    try {
      for (let start = 0; start < people.length; start += size) {
        const batch = people.slice(start, start + size)
        const res = await fetch("/api/radar/icp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ icpConfig, people: batch, batchSize: size }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError((data as { error?: string }).error || "ICP filter failed")
          break
        }
        const next = (data as { matchResults?: Record<string, IcpMatchResult> }).matchResults ?? {}
        Object.assign(allResults, next)
      }
      setMatchResults(allResults)
      applyThreshold(allResults, matchThreshold)
      setIsFilterActive(true)
    } finally {
      setIsFiltering(false)
    }
  }, [postData, icpConfig, batchSize, matchThreshold])

  const applyThreshold = React.useCallback(
    (results?: Record<string, IcpMatchResult>, threshold?: number) => {
      const th = threshold ?? matchThreshold
      const res = results ?? matchResults
      if (!postData) return
      const comm = postData.commentators ?? []
      const react = postData.reactioners ?? []
      const keysComm = comm.map((p, i) => getPersonKey(p, i))
      const keysReact = react.map((p, i) => getPersonKey(p, comm.length + i))
      setFilteredCommentators(comm.filter((_, i) => (res[keysComm[i]]?.matchScore ?? 0) >= th))
      setFilteredReactioners(react.filter((_, i) => (res[keysReact[i]]?.matchScore ?? 0) >= th))
    },
    [postData, matchThreshold, matchResults]
  )

  const handleApplyThreshold = React.useCallback(() => {
    applyThreshold(matchResults, matchThreshold)
  }, [applyThreshold, matchResults, matchThreshold])

  const getMatchResult = (p: RadarPerson, index: number): IcpMatchResult | undefined =>
    matchResults[getPersonKey(p, index)]

  const calculateStats = (): {
    total: number
    avg: number
    min: number
    max: number
    median: number
    distribution: { bucket: string; count: number }[]
    byScore: { name: string; score: number }[]
  } => {
    const scores = Object.values(matchResults).map((r) => r.matchScore).filter((n) => n != null)
    const total = scores.length
    if (total === 0) {
      return {
        total: 0,
        avg: 0,
        min: 0,
        max: 0,
        median: 0,
        distribution: [],
        byScore: [],
      }
    }
    const sorted = [...scores].sort((a, b) => a - b)
    const sum = scores.reduce((a, b) => a + b, 0)
    const buckets = [
      { label: "0-20", min: 0, max: 20 },
      { label: "21-40", min: 21, max: 40 },
      { label: "41-60", min: 41, max: 60 },
      { label: "61-80", min: 61, max: 80 },
      { label: "81-100", min: 81, max: 100 },
    ]
    const distribution = buckets.map((b) => ({
      bucket: b.label,
      count: scores.filter((s) => s >= b.min && s <= b.max).length,
    }))
    const comm = postData?.commentators ?? []
    const react = postData?.reactioners ?? []
    const byScore = Object.entries(matchResults).map(([key, r]) => {
      let name = key
      if (postData) {
        for (let i = 0; i < comm.length; i++) {
          if (getPersonKey(comm[i], i) === key) {
            name = comm[i].name
            break
          }
        }
        for (let i = 0; i < react.length; i++) {
          if (getPersonKey(react[i], comm.length + i) === key) {
            name = react[i].name
            break
          }
        }
      }
      return { name, score: r.matchScore }
    })
    byScore.sort((a, b) => b.score - a.score)
    return {
      total,
      avg: Math.round((sum / total) * 10) / 10,
      min: Math.min(...scores),
      max: Math.max(...scores),
      median: total % 2 ? sorted[Math.floor(total / 2)] : (sorted[total / 2 - 1] + sorted[total / 2]) / 2,
      distribution,
      byScore,
    }
  }

  const commentatorsToShow = isFilterActive ? filteredCommentators : postData?.commentators ?? []
  const reactionersToShow = isFilterActive ? filteredReactioners : postData?.reactioners ?? []
  const commentStartIndex = 0
  const reactStartIndex = postData?.commentators?.length ?? 0

  const handleDownloadCommentators = () => {
    if (!postData) return
    const list = isFilterActive ? filteredCommentators : postData.commentators ?? []
    const postId = postData.linkedinPostId ?? "post"
    const date = new Date().toISOString().slice(0, 10)
    const rows = list.map((p, i) => {
      const res = getMatchResult(p, commentStartIndex + i)
      return {
        name: p.name,
        headline: p.headline,
        profile_url: p.profile_url,
        matchScore: res?.matchScore,
      }
    })
    downloadCSV(rows, `radar-commentators-${postId}-${date}.csv`)
  }

  const handleDownloadReactioners = () => {
    if (!postData) return
    const list = isFilterActive ? filteredReactioners : postData.reactioners ?? []
    const postId = postData.linkedinPostId ?? "post"
    const date = new Date().toISOString().slice(0, 10)
    const rows = list.map((p, i) => {
      const res = getMatchResult(p, reactStartIndex + i)
      return {
        name: p.name,
        headline: p.headline,
        profile_url: p.profile_url,
        matchScore: res?.matchScore,
      }
    })
    downloadCSV(rows, `radar-reactioners-${postId}-${date}.csv`)
  }

  const toggleArrayItem = (key: keyof IcpConfig, item: string) => {
    const arr = [...(icpConfig[key] as string[] | undefined) ?? []]
    const i = arr.indexOf(item)
    if (i >= 0) arr.splice(i, 1)
    else arr.push(item)
    setIcpConfig((prev) => ({ ...prev, [key]: arr }))
  }

  const renderPersonList = (
    list: RadarPerson[],
    label: string,
    icon: React.ReactNode,
    startIndex: number
  ) => (
    <div className="space-y-2">
      <h4 className="text-sm font-medium flex items-center gap-2">
        {icon}
        {label} ({list.length})
      </h4>
      <ul className="space-y-1.5">
        {list.map((p, i) => {
          const res = getMatchResult(p, startIndex + i)
          return (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <span className="font-medium">{p.name}</span>
                {p.headline && (
                  <span className="text-muted-foreground block text-xs truncate">{p.headline}</span>
                )}
              </div>
              {res != null && (
                <Badge variant="outline" className={`shrink-0 text-xs ${getMatchScoreColor(res.matchScore)}`}>
                  {res.matchScore}
                </Badge>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )

  const stats = calculateStats()

  return (
    <AppShell title="Post Radar">
      <div className="px-4 lg:px-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Post Radar</h2>
            <p className="text-muted-foreground text-sm">
              Enter a LinkedIn post URL to load commentators and reactioners, filter by ICP (OpenAI), and export CSV.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowIcpModal(true)}>
              <SparklesIcon className="mr-2 h-4 w-4" />
              ICP Settings
              {isIcpConfigured() && <CheckIcon className="ml-2 h-4 w-4 text-emerald-500" />}
            </Button>
            {postData && Object.keys(matchResults).length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setShowStatsModal(true)}>
                <BarChart3Icon className="mr-2 h-4 w-4" />
                Stats
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>LinkedIn Post URL</CardTitle>
            <CardDescription>Paste a LinkedIn post URL and click Search (or press Enter).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="post-url">Post URL</Label>
              <Input
                id="post-url"
                placeholder="https://www.linkedin.com/posts/..."
                value={postUrl}
                onChange={(e) => setPostUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSearch} disabled={loading || !postUrl.trim()}>
                <RadarIcon className="mr-2 h-4 w-4" />
                {loading ? "Searching…" : "Search"}
              </Button>
              {postData && isFilterActive && (
                <Button variant="outline" onClick={resetFilter}>
                  Reset filter
                </Button>
              )}
            </div>
            {error && (
              <p className="text-destructive text-sm rounded-md border border-destructive/50 bg-destructive/10 p-3">
                {error}
              </p>
            )}
          </CardContent>
        </Card>

        {postData && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Post summary</CardTitle>
                <CardDescription>
                  {source && (
                    <Badge variant="secondary" className="mr-2">
                      {source}
                    </Badge>
                  )}
                  {postData.reactionsCount} reactions · {postData.commentsCount} comments
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {postData.content && (
                  <p className="text-sm whitespace-pre-wrap border rounded-md p-3 bg-muted/30">{postData.content}</p>
                )}
                {postData.postUrl && (
                  <a
                    href={postData.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-sm underline"
                  >
                    Open post
                  </a>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <CardTitle>Commentators & Reactioners</CardTitle>
                    <CardDescription>
                      {isFilterActive
                        ? `Showing only people with ICP score ≥ ${matchThreshold}.`
                        : "Run ICP filter to score and filter by your criteria."}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor="threshold" className="text-xs text-muted-foreground">
                      Min score
                    </Label>
                    <Input
                      id="threshold"
                      type="number"
                      min={0}
                      max={100}
                      value={matchThreshold}
                      onChange={(e) => setMatchThreshold(Number(e.target.value) || 0)}
                      className="w-16 h-8 text-sm"
                    />
                    <Button variant="outline" size="sm" onClick={handleApplyThreshold} disabled={!isFilterActive}>
                      Apply threshold
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={filterByICP}
                      disabled={isFiltering || !isIcpConfigured()}
                    >
                      {isFiltering ? "Filtering…" : "Filter by ICP"}
                    </Button>
                    <select
                      value={batchSize}
                      onChange={(e) => setBatchSize(e.target.value as "10" | "20" | "50" | "all")}
                      className="h-8 rounded-md border bg-background px-2 text-sm"
                    >
                      <option value="10">Batch 10</option>
                      <option value="20">Batch 20</option>
                      <option value="50">Batch 50</option>
                      <option value="all">All</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    {renderPersonList(
                      commentatorsToShow,
                      "Commentators",
                      <MessageCircleIcon className="h-4 w-4" />,
                      commentStartIndex
                    )}
                    <Button variant="outline" size="sm" className="mt-2" onClick={handleDownloadCommentators}>
                      <DownloadIcon className="mr-2 h-4 w-4" />
                      Download CSV
                    </Button>
                  </div>
                  <div>
                    {renderPersonList(
                      reactionersToShow,
                      "Reactioners",
                      <ThumbsUpIcon className="h-4 w-4" />,
                      reactStartIndex
                    )}
                    <Button variant="outline" size="sm" className="mt-2" onClick={handleDownloadReactioners}>
                      <DownloadIcon className="mr-2 h-4 w-4" />
                      Download CSV
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {!postData && !loading && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              No results yet. Enter a LinkedIn post URL and click Search.
            </CardContent>
          </Card>
        )}
      </div>

      {/* ICP Settings Sheet */}
      <Sheet open={showIcpModal} onOpenChange={setShowIcpModal}>
        <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>ICP Settings</SheetTitle>
            <SheetDescription>
              Define your Ideal Customer Profile. People are scored 0–100 against these criteria when you run Filter by
              ICP.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-6 py-4">
            <div>
              <Label className="text-xs text-muted-foreground">Company size</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {companySizeOptions.map((opt) => (
                  <Button
                    key={opt}
                    type="button"
                    variant={(icpConfig.companySize ?? []).includes(opt) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleArrayItem("companySize", opt)}
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Industries</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {industryOptions.map((opt) => (
                  <Button
                    key={opt}
                    type="button"
                    variant={(icpConfig.industries ?? []).includes(opt) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleArrayItem("industries", opt)}
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Job titles</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {jobTitleOptions.map((opt) => (
                  <Button
                    key={opt}
                    type="button"
                    variant={(icpConfig.jobTitles ?? []).includes(opt) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleArrayItem("jobTitles", opt)}
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Locations</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {locationOptions.map((opt) => (
                  <Button
                    key={opt}
                    type="button"
                    variant={(icpConfig.locations ?? []).includes(opt) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleArrayItem("locations", opt)}
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Revenue range</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {revenueOptions.map((opt) => (
                  <Button
                    key={opt}
                    type="button"
                    variant={(icpConfig.revenueRange ?? []).includes(opt) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleArrayItem("revenueRange", opt)}
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Tech stack</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {techStackOptions.map((opt) => (
                  <Button
                    key={opt}
                    type="button"
                    variant={(icpConfig.techStack ?? []).includes(opt) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleArrayItem("techStack", opt)}
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="additional-criteria">Additional criteria (free text)</Label>
              <Textarea
                id="additional-criteria"
                placeholder="e.g. Looking for decision makers in SaaS..."
                value={icpConfig.additionalCriteria ?? ""}
                onChange={(e) => setIcpConfig((c) => ({ ...c, additionalCriteria: e.target.value }))}
                className="mt-1 min-h-[80px]"
              />
            </div>
          </div>
          <SheetFooter>
            <Button onClick={() => saveIcpConfig(icpConfig)}>Save</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Stats Sheet */}
      <Sheet open={showStatsModal} onOpenChange={setShowStatsModal}>
        <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>ICP match stats</SheetTitle>
            <SheetDescription>Distribution and list of scored people.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border p-2">
                <span className="text-muted-foreground">Total scored</span>
                <p className="font-medium">{stats.total}</p>
              </div>
              <div className="rounded-md border p-2">
                <span className="text-muted-foreground">Average</span>
                <p className="font-medium">{stats.avg}</p>
              </div>
              <div className="rounded-md border p-2">
                <span className="text-muted-foreground">Min</span>
                <p className="font-medium">{stats.min}</p>
              </div>
              <div className="rounded-md border p-2">
                <span className="text-muted-foreground">Max</span>
                <p className="font-medium">{stats.max}</p>
              </div>
              <div className="rounded-md border p-2 col-span-2">
                <span className="text-muted-foreground">Median</span>
                <p className="font-medium">{stats.median}</p>
              </div>
            </div>
            {stats.distribution.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Score distribution</Label>
                <ul className="mt-1 space-y-1">
                  {stats.distribution.map((d) => (
                    <li key={d.bucket} className="flex justify-between text-sm">
                      <span>{d.bucket}</span>
                      <span>{d.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {stats.byScore.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">By score (top)</Label>
                <ul className="mt-1 space-y-1 max-h-60 overflow-y-auto">
                  {stats.byScore.slice(0, 30).map((s, i) => (
                    <li key={i} className="flex justify-between text-sm">
                      <span className="truncate mr-2">{s.name}</span>
                      <Badge variant="outline" className={getMatchScoreColor(s.score)}>
                        {s.score}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  )
}
