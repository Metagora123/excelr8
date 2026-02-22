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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MailIcon, CopyIcon, CheckIcon, FileTextIcon } from "lucide-react"

export default function NewsletterPage() {
  const [dateFolders, setDateFolders] = React.useState<string[]>([])
  const [selectedDate, setSelectedDate] = React.useState("")
  const [dateFoldersLoading, setDateFoldersLoading] = React.useState(true)
  const [filesForDate, setFilesForDate] = React.useState<string[]>([])
  const [filesLoading, setFilesLoading] = React.useState(false)
  const [tone, setTone] = React.useState("professional")
  const [customTone, setCustomTone] = React.useState("")
  const [endpoint, setEndpoint] = React.useState<"test" | "prod">("test")
  const [generating, setGenerating] = React.useState(false)
  const [generatedHtml, setGeneratedHtml] = React.useState("")
  const [copied, setCopied] = React.useState(false)
  const [status, setStatus] = React.useState<string | null>(null)

  const handleGenerate = async () => {
    setGenerating(true)
    setStatus(null)
    setGeneratedHtml("")
    try {
      const res = await fetch("/api/newsletter/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint,
          tone,
          customTone: customTone || undefined,
          dateFolder: selectedDate || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus(data.error || res.statusText || "Generate failed")
        return
      }
      setGeneratedHtml(data.html ?? "")
      setStatus("Generated. Copy or use the HTML below.")
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Generate failed")
    } finally {
      setGenerating(false)
    }
  }

  React.useEffect(() => {
    let cancelled = false
    setDateFoldersLoading(true)
    fetch("/api/newsletter/date-folders")
      .then((res) => (res.ok ? res.json() : []))
      .then((list: string[]) => {
        if (!cancelled && Array.isArray(list)) setDateFolders(list)
      })
      .catch(() => {
        if (!cancelled) setDateFolders([])
      })
      .finally(() => {
        if (!cancelled) setDateFoldersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!selectedDate) {
      setFilesForDate([])
      return
    }
    let cancelled = false
    setFilesLoading(true)
    fetch(`/api/newsletter/files?date=${encodeURIComponent(selectedDate)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((list: string[]) => {
        if (!cancelled && Array.isArray(list)) setFilesForDate(list)
        else if (!cancelled) setFilesForDate([])
      })
      .catch(() => {
        if (!cancelled) setFilesForDate([])
      })
      .finally(() => {
        if (!cancelled) setFilesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedDate])

  const handleCopy = async () => {
    if (!generatedHtml) return
    try {
      await navigator.clipboard.writeText(generatedHtml)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setStatus("Copy failed")
    }
  }

  return (
    <AppShell title="Newsletter">
      <div className="px-4 lg:px-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Newsletter</h2>
          <p className="text-muted-foreground text-sm">
            Generate newsletter via n8n. Date folders and file list from R2 when wired.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Generate Newsletter</CardTitle>
            <CardDescription>Select tone and endpoint. R2 date folders to be wired.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Date folder</Label>
                <Select
                  value={selectedDate || "_"}
                  onValueChange={(v) => setSelectedDate(v === "_" ? "" : v)}
                  disabled={dateFoldersLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={dateFoldersLoading ? "Loading…" : "Select a date folder"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">— (none)</SelectItem>
                    {dateFolders.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Recent date folders. R2 list used when configured.</p>
              </div>
              {selectedDate && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Files for {selectedDate}</Label>
                  {filesLoading ? (
                    <p className="text-muted-foreground text-sm">Loading files…</p>
                  ) : filesForDate.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No files for this date.</p>
                  ) : (
                    <ul className="rounded-md border bg-muted/30 divide-y divide-border">
                      {filesForDate.map((f) => (
                        <li key={f} className="flex items-center gap-2 px-3 py-2 text-sm">
                          <FileTextIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label>Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-tone">Custom tone (optional)</Label>
              <input
                id="custom-tone"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="e.g. concise, technical"
                value={customTone}
                onChange={(e) => setCustomTone(e.target.value)}
              />
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
            <Button onClick={handleGenerate} disabled={generating}>
              <MailIcon className="mr-2 h-4 w-4" />
              {generating ? "Generating…" : "Generate"}
            </Button>
            {status && (
              <p className="text-muted-foreground text-sm">{status}</p>
            )}
          </CardContent>
        </Card>

        {generatedHtml && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Generated HTML</CardTitle>
                  <CardDescription>Copy or use below.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <CheckIcon className="h-4 w-4 mr-2" /> : <CopyIcon className="h-4 w-4 mr-2" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[400px] overflow-auto rounded border bg-muted/30 p-4 text-xs whitespace-pre-wrap break-words">
                {generatedHtml}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
