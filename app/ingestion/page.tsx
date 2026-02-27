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
import { UploadIcon } from "lucide-react"

export default function FileIngestionPage() {
  const [file, setFile] = React.useState<File | null>(null)
  const [endpoint, setEndpoint] = React.useState<"test" | "prod">("test")
  const [supabaseProject, setSupabaseProject] = React.useState<"sales2k25" | "prod2k26">("sales2k25")
  const [uploading, setUploading] = React.useState(false)
  const [status, setStatus] = React.useState<{ type: "success" | "error"; message: string } | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f?.name.endsWith(".csv")) setFile(f)
    else setStatus({ type: "error", message: "Please upload a CSV file." })
  }
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  const handleDragLeave = () => setIsDragging(false)
  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
    setStatus(null)
  }

  const handleSubmit = async () => {
    if (!file) {
      setStatus({ type: "error", message: "Select a CSV file first." })
      return
    }
    setUploading(true)
    setStatus(null)
    try {
      const formData = new FormData()
      formData.append("data", file)
      formData.append("endpoint", endpoint)
      formData.append("supabaseProject", supabaseProject)
      const res = await fetch("/api/ingestion", { method: "POST", body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus({ type: "error", message: data.error || res.statusText || "Upload failed" })
        return
      }
      setStatus({ type: "success", message: "Upload sent to n8n successfully." })
      setFile(null)
      if (inputRef.current) inputRef.current.value = ""
    } catch (e) {
      setStatus({ type: "error", message: e instanceof Error ? e.message : "Upload failed" })
    } finally {
      setUploading(false)
    }
  }

  return (
    <AppShell title="File Ingestion">
      <div className="px-4 lg:px-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">File Ingestion</h2>
          <p className="text-muted-foreground text-sm">
            Upload CSV to n8n webhook (Supabase ingestion). Choose test or prod endpoint.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload CSV</CardTitle>
            <CardDescription>Drag and drop or click to select. Sent to n8n webhook.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleSelect}
              />
              <UploadIcon className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {file ? file.name : "Drop CSV here or click to browse"}
              </p>
            </div>

            <Button onClick={handleSubmit} disabled={!file || uploading}>
              {uploading ? "Uploading…" : "Upload"}
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
