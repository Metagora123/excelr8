"use client"

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip"
import { UsersIcon, FileTextIcon, TrendingUpIcon, DatabaseIcon } from "lucide-react"

type StatCardProps = {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  tooltip?: string
  progress?: number
}

function StatCard({ title, value, subtitle, icon, tooltip, progress }: StatCardProps) {
  return (
    <Card className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @container/card">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {tooltip ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help underline-offset-2 hover:underline">{value}</span>
              </TooltipTrigger>
              <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
          ) : (
            value
          )}
        </CardTitle>
      </CardHeader>
      {(progress !== undefined || subtitle) && (
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          {progress !== undefined && (
            <Progress value={progress} className="w-full" />
          )}
          {subtitle && (
            <div className="text-muted-foreground">{subtitle}</div>
          )}
        </CardFooter>
      )}
    </Card>
  )
}

export function DashboardStatCards({
  total,
  withDossiers,
  dossierPct,
  averageScore,
}: {
  total: number
  withDossiers: number
  dossierPct: number
  averageScore: number
}) {
  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 gap-4 px-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 lg:px-6">
        <StatCard
          title="Total Leads"
          value={total.toLocaleString()}
          icon={<UsersIcon />}
          tooltip="Total number of leads in the system"
        />
        <StatCard
          title="With Dossiers"
          value={withDossiers.toLocaleString()}
          subtitle={`${dossierPct.toFixed(0)}% of total`}
          icon={<FileTextIcon />}
          progress={dossierPct}
        />
        <StatCard
          title="Average Score"
          value={averageScore.toFixed(1)}
          icon={<TrendingUpIcon />}
          tooltip="Average lead score across all leads"
        />
        <StatCard
          title="Data Source"
          value="Supabase"
          subtitle="leads table"
          icon={<DatabaseIcon />}
        />
      </div>
    </TooltipProvider>
  )
}
