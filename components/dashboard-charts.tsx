"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts"

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

const statusConfig = {
  status: { label: "Status" },
  value: { label: "Count", color: "var(--chart-1)" },
} satisfies ChartConfig

const tierConfig = {
  tier: { label: "Tier" },
  value: { label: "Count", color: "var(--primary)" },
} satisfies ChartConfig

const timelineConfig = {
  date: { label: "Date" },
  score: { label: "Avg Score", color: "var(--primary)" },
} satisfies ChartConfig

function titleCase(s: string): string {
  const trimmed = (s ?? "").trim()
  if (!trimmed) return "Unknown"
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

export function LeadsByStatusChart({ data }: { data: { status: string; value: number }[] }) {
  const chartData = data.map((d) => ({ status: titleCase(d.status), value: d.value }))
  const total = chartData.reduce((sum, d) => sum + d.value, 0)
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Leads by Status</CardTitle>
        <CardDescription>Distribution by lead status</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={statusConfig} className="mx-auto aspect-square h-[210px]">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="status"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
          {chartData.map((d, i) => (
            <div key={d.status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
              />
              <span>{d.status}</span>
              <span className="tabular-nums text-foreground">
                {total ? Math.round((d.value / total) * 100) : 0}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function LeadsByTierChart({ data }: { data: { tier: string; value: number }[] }) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Leads by Tier</CardTitle>
        <CardDescription>Distribution by tier</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={tierConfig} className="h-[250px] w-full">
          <BarChart data={data} layout="vertical" margin={{ left: 0 }}>
            <XAxis type="number" />
            <YAxis dataKey="tier" type="category" width={32} tickMargin={8} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="var(--primary)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function LeadGrowthTimeline({ data }: { data: { date: string; score: number }[] }) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Lead Growth Timeline</CardTitle>
        <CardDescription>Cumulative average score over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={timelineConfig} className="h-[250px] w-full">
          <LineChart data={data}>
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="score"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
