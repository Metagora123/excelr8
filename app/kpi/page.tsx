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
  ReplyIcon,
  HeartIcon,
} from "lucide-react"

type KpiTotals = {
  campaigns: number
  messages_sent: number
  invites_sent: number
  replies_received: number
  comments_made: number
  likes_reactions: number
}

type CampaignRow = {
  id: string
  name: string | null
  status: string | null
  messages_sent: number | null
  invites_sent: number | null
  replies_received: number | null
  comments_made: number | null
  likes_reactions: number | null
}

const engagementConfig = {
  messages_sent: { label: "Messages", color: "var(--chart-1)" },
  invites_sent: { label: "Invites", color: "var(--chart-2)" },
  replies_received: { label: "Replies", color: "var(--chart-3)" },
  comments_made: { label: "Comments", color: "var(--chart-4)" },
  likes_reactions: { label: "Likes", color: "var(--chart-5)" },
} satisfies ChartConfig

export default function KPIDashboardPage() {
  const [totals, setTotals] = React.useState<KpiTotals | null>(null)
  const [campaigns, setCampaigns] = React.useState<CampaignRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedCampaignId, setSelectedCampaignId] = React.useState<string>("__none__")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/kpi")
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
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  const maxInvites = Math.max(totals?.invites_sent ?? 1, 1)
  const maxEngagement = Math.max(
    (totals?.replies_received ?? 0) + (totals?.comments_made ?? 0) + (totals?.likes_reactions ?? 0),
    1
  )

  const barData = campaigns.map((c) => ({
    name: (c.name ?? c.id).slice(0, 20),
    messages: c.messages_sent ?? 0,
    invites: c.invites_sent ?? 0,
    replies: c.replies_received ?? 0,
    comments: c.comments_made ?? 0,
    likes: c.likes_reactions ?? 0,
  }))

  const selectedCampaign =
    selectedCampaignId && selectedCampaignId !== "__none__"
      ? campaigns.find((c) => c.id === selectedCampaignId)
      : null

  return (
    <AppShell title="KPI Dashboard" onRefresh={load}>
      <div className="px-4 lg:px-6 space-y-8">
        <div>
          <h2 className="text-lg font-semibold">Campaign KPI Overview</h2>
          <p className="text-muted-foreground text-sm">
            All campaigns summary and per-campaign details. Metrics from Supabase campaigns table.
          </p>
        </div>

        {/* ——— All Campaigns (general stats) ——— */}
        <section className="space-y-6">
          <h3 className="text-base font-medium">All Campaigns</h3>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : totals ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Campaigns</CardDescription>
                    <CardTitle className="flex items-center gap-2">
                      <TargetIcon className="h-4 w-4" />
                      {totals.campaigns}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Messages Sent</CardDescription>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquareIcon className="h-4 w-4" />
                      {totals.messages_sent.toLocaleString()}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Invites Sent</CardDescription>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlusIcon className="h-4 w-4" />
                      {totals.invites_sent.toLocaleString()}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Replies Received</CardDescription>
                    <CardTitle className="flex items-center gap-2">
                      <ReplyIcon className="h-4 w-4" />
                      {totals.replies_received.toLocaleString()}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Engagement</CardDescription>
                    <CardTitle className="flex items-center gap-2">
                      <HeartIcon className="h-4 w-4" />
                      {(totals.comments_made + totals.likes_reactions).toLocaleString()}
                    </CardTitle>
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
                    <CardTitle>Engagement & Intent</CardTitle>
                    <CardDescription>Replies, comments, likes (all campaigns)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Replies</p>
                      <Progress value={(totals.replies_received / maxEngagement) * 100} className="h-2" />
                    </div>
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
                        <Bar dataKey="replies" stackId="a" fill="var(--chart-3)" radius={[0, 0, 0, 0]} />
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
              <CardHeader>
                <CardTitle>{selectedCampaign.name ?? selectedCampaign.id}</CardTitle>
                <CardDescription>
                  {selectedCampaign.status ? `Status: ${selectedCampaign.status}` : "Single campaign metrics"}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <p className="text-xs text-muted-foreground">Messages sent</p>
                  <p className="text-lg font-semibold">{(selectedCampaign.messages_sent ?? 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Invites sent</p>
                  <p className="text-lg font-semibold">{(selectedCampaign.invites_sent ?? 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Replies received</p>
                  <p className="text-lg font-semibold">{(selectedCampaign.replies_received ?? 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Comments made</p>
                  <p className="text-lg font-semibold">{(selectedCampaign.comments_made ?? 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Likes / reactions</p>
                  <p className="text-lg font-semibold">{(selectedCampaign.likes_reactions ?? 0).toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        <p className="text-muted-foreground text-xs">All metrics from Supabase campaigns table.</p>
      </div>
    </AppShell>
  )
}
