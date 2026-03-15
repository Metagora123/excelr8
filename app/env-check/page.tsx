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
import { Badge } from "@/components/ui/badge"
import { CheckCircle2Icon, XCircleIcon, Loader2Icon, WifiIcon } from "lucide-react"

type EnvVar = { key: string; label: string; group: string; set: boolean; hint?: string }
type PingResult = { name: string; ok: boolean; detail: string }

export default function EnvCheckPage() {
  const [vars, setVars] = React.useState<EnvVar[]>([])
  const [pings, setPings] = React.useState<PingResult[] | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [pinging, setPinging] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const fetchVars = React.useCallback(async (doPing = false) => {
    try {
      if (!doPing) setLoading(true)
      else setPinging(true)
      setError(null)
      const url = doPing ? "/api/env-check?ping=1" : "/api/env-check"
      const res = await fetch(url)
      if (!res.ok) throw new Error(res.statusText)
      const data = (await res.json()) as { vars: EnvVar[]; pings?: PingResult[] }
      setVars(data.vars)
      if (data.pings) setPings(data.pings)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
      setPinging(false)
    }
  }, [])

  React.useEffect(() => {
    fetchVars(false)
  }, [fetchVars])

  const byGroup = React.useMemo(() => {
    const map = new Map<string, EnvVar[]>()
    for (const v of vars) {
      const list = map.get(v.group) ?? []
      list.push(v)
      map.set(v.group, list)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [vars])

  return (
    <AppShell title="Environment check">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchVars(false)}
            disabled={loading}
          >
            {loading ? <Loader2Icon className="h-4 w-4 animate-spin" /> : "Refresh vars"}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => fetchVars(true)}
            disabled={pinging}
          >
            {pinging ? <Loader2Icon className="h-4 w-4 animate-spin mr-2" /> : <WifiIcon className="h-4 w-4 mr-2" />}
            Ping all services
          </Button>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {pings != null && pings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Service pings</CardTitle>
              <CardDescription>Live checks to Supabase, Airtable, n8n, HubSpot, SendGrid</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {pings.map((p) => (
                  <li key={p.name} className="flex items-center gap-2 text-sm">
                    {p.ok ? (
                      <CheckCircle2Icon className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                    ) : (
                      <XCircleIcon className="h-4 w-4 shrink-0 text-destructive" />
                    )}
                    <span className="font-medium min-w-[180px]">{p.name}</span>
                    <span className={p.ok ? "text-muted-foreground" : "text-destructive"}>{p.detail}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Environment variables</CardTitle>
            <CardDescription>Values are never shown; only whether each var is set and an optional safe hint.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && vars.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <div className="space-y-6">
                {byGroup.map(([group, groupVars]) => (
                  <div key={group}>
                    <h3 className="text-sm font-semibold text-foreground mb-2">{group}</h3>
                    <ul className="space-y-1.5">
                      {groupVars.map((v) => (
                        <li key={v.key} className="flex flex-wrap items-center gap-2 text-sm">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{v.key}</code>
                          <span className="text-muted-foreground">{v.label}</span>
                          {v.set ? (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle2Icon className="h-3 w-3" />
                              Set
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-muted-foreground">
                              <XCircleIcon className="h-3 w-3" />
                              Not set
                            </Badge>
                          )}
                          {v.hint && <span className="text-muted-foreground text-xs">{v.hint}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
