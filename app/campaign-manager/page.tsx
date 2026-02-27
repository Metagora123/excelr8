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
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TargetIcon, UploadIcon } from "lucide-react"

export default function CampaignManagerPage() {
  const [campaignName, setCampaignName] = React.useState("")
  const [clientId, setClientId] = React.useState("")
  const [category, setCategory] = React.useState("")
  const [managedBy, setManagedBy] = React.useState("")
  const [file, setFile] = React.useState<File | null>(null)
  const [endpoint, setEndpoint] = React.useState<"test" | "prod">("test")
  const [supabaseProject, setSupabaseProject] = React.useState<"sales2k25" | "prod2k26">("sales2k25")
  const [loading, setLoading] = React.useState(false)
  const [status, setStatus] = React.useState<{ type: "success" | "error"; message: string } | null>(null)
  const [clients, setClients] = React.useState<{ id: string; name: string | null }[]>([])
  const inputRef = React.useRef<HTMLInputElement>(null)

  const loadClients = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/clients?project=${encodeURIComponent(supabaseProject)}`)
      if (res.ok) setClients(await res.json())
      else setClients([])
    } catch {
      setClients([])
    }
  }, [supabaseProject])

  React.useEffect(() => {
    loadClients()
  }, [loadClients])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    setFile(f ?? null)
  }

  const handleSubmit = async () => {
    if (!file) {
      setStatus({ type: "error", message: "Select a CSV file." })
      return
    }
    setLoading(true)
    setStatus(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("campaignName", campaignName)
      formData.append("clientId", clientId)
      formData.append("category", category)
      formData.append("managedBy", managedBy)
      formData.append("endpoint", endpoint)
      formData.append("supabaseProject", supabaseProject)
      const res = await fetch("/api/campaign-manager", { method: "POST", body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus({ type: "error", message: data.error || res.statusText || "Send failed" })
        return
      }
      setStatus({ type: "success", message: "Campaign sent to n8n." })
      setFile(null)
      setCampaignName("")
      setCategory("")
      setManagedBy("")
      if (inputRef.current) inputRef.current.value = ""
    } catch (e) {
      setStatus({ type: "error", message: e instanceof Error ? e.message : "Send failed" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell title="Campaign Manager">
      <div className="px-4 lg:px-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Campaign Manager</h2>
          <p className="text-muted-foreground text-sm">
            Create campaign: client, category, managed by, and CSV upload to n8n.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>New Campaign</CardTitle>
            <CardDescription>Fill in details and upload CSV. Sends to n8n webhook.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Supabase project</Label>
                <Select value={supabaseProject} onValueChange={(v) => setSupabaseProject(v as "sales2k25" | "prod2k26")}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales2k25">Sales 2k25</SelectItem>
                    <SelectItem value="prod2k26">Prod 2k26</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Campaign name</Label>
                <Input
                  id="campaign-name"
                  placeholder="e.g. Q1 Outreach"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={clientId || "_"} onValueChange={(v) => setClientId(v === "_" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">—</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name ?? c.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category || "_"} onValueChange={(v) => setCategory(v === "_" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">—</SelectItem>
                    <SelectItem value="Technical">Technical</SelectItem>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Managed by</Label>
                <Select value={managedBy || "_"} onValueChange={(v) => setManagedBy(v === "_" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">—</SelectItem>
                    <SelectItem value="Yves (Sales, CEO, CTOs)">Yves (Sales, CEO, CTOs)</SelectItem>
                    <SelectItem value="Eva (Marketing)">Eva (Marketing)</SelectItem>
                    <SelectItem value="Shawn (Technical)">Shawn (Technical)</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Endpoint</Label>
              <Select value={endpoint} onValueChange={(v) => setEndpoint(v as "test" | "prod")}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="test">Test</SelectItem>
                  <SelectItem value="prod">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>CSV file</Label>
              <div
                onClick={() => inputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <UploadIcon className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">{file ? file.name : "Click to select CSV"}</p>
              </div>
            </div>

            <Button onClick={handleSubmit} disabled={!file || loading}>
              <TargetIcon className="mr-2 h-4 w-4" />
              {loading ? "Sending…" : "Send to n8n"}
            </Button>

            {status && (
              <div
                className={`rounded-md border p-3 text-sm ${
                  status.type === "success"
                    ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400"
                    : "border-destructive/50 bg-destructive/10 text-destructive"
                }`}
              >
                {status.message}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
