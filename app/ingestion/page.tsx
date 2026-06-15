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
import { UploadIcon, Trash2Icon } from "lucide-react"
import {
  buildUploadCsvFile,
  countCsvDataRows,
  formatBytes,
  isAllRowsPreviewBlocked,
  sliceRows,
  VERCEL_UPLOAD_LIMIT_BYTES,
} from "@/lib/csv-truncate"
import { formatPreviewError } from "@/lib/preview-errors"
import { isCsvTooLargeErrorMessage, openCsvTooLargeDialog } from "@/lib/csv-upload-errors"
import { useCsvTooLargeDialog } from "@/components/csv-too-large-dialog"

/** Clay company intelligence + ICP scores parsed from a CSV row, as returned by the preview API. */
type PreviewCompanyInfo = {
  industry?: string | null
  type?: string | null
  segment?: string | null
} | null

type PreviewIcpScores = {
  priority_score?: number | null
  confidence_score?: number | null
} | null

/** Compact "P 82 · C 90" string for the preview Scores column. Empty -> "—". */
function formatIcpScores(icp: PreviewIcpScores): string {
  if (!icp) return "—"
  const parts: string[] = []
  if (icp.priority_score != null) parts.push(`P ${icp.priority_score}`)
  if (icp.confidence_score != null) parts.push(`C ${icp.confidence_score}`)
  return parts.length > 0 ? parts.join(" · ") : "—"
}

/** Primary line for the preview Company column: industry, else type/segment. */
function companyPrimaryLine(info: PreviewCompanyInfo): string {
  if (!info) return "—"
  return info.industry || info.type || info.segment || "—"
}

export default function FileIngestionPage() {
  const csvTooLarge = useCsvTooLargeDialog()
  const [file, setFile] = React.useState<File | null>(null)
  const [endpoint, setEndpoint] = React.useState<"test" | "prod">("test")
  const [supabaseProject, setSupabaseProject] = React.useState<"sales2k25" | "prod2k26">("sales2k25")
  const [uploading, setUploading] = React.useState(false)
  const [status, setStatus] = React.useState<{ type: "success" | "error"; message: string } | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [allPreviewLeads, setAllPreviewLeads] = React.useState<Array<{ full_name: string | null; email: string | null; profile_url: string | null; company_info: PreviewCompanyInfo; icp_scores: PreviewIcpScores; company_description: string | null }>>([])
  const [fileCsvRowCount, setFileCsvRowCount] = React.useState<number | null>(null)
  const [previewCsvTotal, setPreviewCsvTotal] = React.useState<number | null>(null)
  const [excludePreviewIndices, setExcludePreviewIndices] = React.useState<number[]>([])
  const [previewLimit, setPreviewLimit] = React.useState<string>("50")
  const [previewLoading, setPreviewLoading] = React.useState(false)
  const [previewError, setPreviewError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const previewLeads = React.useMemo(
    () => sliceRows(allPreviewLeads, previewLimit),
    [allPreviewLeads, previewLimit]
  )

  React.useEffect(() => {
    setExcludePreviewIndices([])
    setAllPreviewLeads([])
    setPreviewCsvTotal(null)
    setPreviewError(null)
  }, [previewLimit])

  const applySelectedFile = (f: File) => {
    setFile(f)
    setStatus(null)
    setAllPreviewLeads([])
    setPreviewCsvTotal(null)
    setExcludePreviewIndices([])
    setPreviewError(null)
    setFileCsvRowCount(null)
    void countCsvDataRows(f).then(setFileCsvRowCount).catch(() => setFileCsvRowCount(null))
    if (isAllRowsPreviewBlocked(f)) {
      openCsvTooLargeDialog(csvTooLarge.show, { fileBytes: f.size })
    }
  }

  const showTooLargeFromMessage = (message: string) => {
    if (isCsvTooLargeErrorMessage(message)) {
      openCsvTooLargeDialog(csvTooLarge.show, {})
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f?.name.endsWith(".csv")) {
      applySelectedFile(f)
    } else setStatus({ type: "error", message: "Please upload a CSV file." })
  }
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  const handleDragLeave = () => setIsDragging(false)
  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) applySelectedFile(f)
  }

  const removeLeadFromPreview = (rowIndex: number) => {
    setExcludePreviewIndices((prev) => [...prev, rowIndex].sort((a, b) => a - b))
  }

  const handlePreview = async () => {
    if (!file) return

    if (previewLimit === "all" && isAllRowsPreviewBlocked(file)) {
      const msg = formatPreviewError(413, null, { preflightAll: true })
      setPreviewError(msg)
      openCsvTooLargeDialog(csvTooLarge.show, { preflightAll: true, fileBytes: file.size })
      return
    }

    setPreviewLoading(true)
    setPreviewError(null)
    setAllPreviewLeads([])
    setPreviewCsvTotal(null)
    setExcludePreviewIndices([])
    try {
      const uploadFile = await buildUploadCsvFile(file, previewLimit, [])
      if (uploadFile.size > VERCEL_UPLOAD_LIMIT_BYTES) {
        const msg = formatPreviewError(413, null, { uploadBytes: uploadFile.size })
        setPreviewError(msg)
        openCsvTooLargeDialog(csvTooLarge.show, { uploadBytes: uploadFile.size })
        return
      }

      const formData = new FormData()
      formData.append("file", uploadFile)
      formData.append("supabaseProject", supabaseProject)
      const res = await fetch("/api/campaign-manager/preview", { method: "POST", body: formData })
      const data = (await res.json().catch(() => ({}))) as {
        leads?: Array<{ full_name?: string | null; email?: string | null; profile_url?: string | null; company_info?: PreviewCompanyInfo; icp_scores?: PreviewIcpScores; company_description?: string | null }>
        total?: number
        error?: string
        code?: string
      }
      if (!res.ok) {
        const msg = formatPreviewError(res.status, data)
        setPreviewError(msg)
        showTooLargeFromMessage(msg)
        return
      }
      const leads = data.leads ?? []
      setPreviewCsvTotal(typeof data.total === "number" ? data.total : leads.length)
      setAllPreviewLeads(leads.map((l) => ({ full_name: l.full_name ?? null, email: l.email ?? null, profile_url: l.profile_url ?? null, company_info: l.company_info ?? null, icp_scores: l.icp_scores ?? null, company_description: l.company_description ?? null })))
    } catch (e) {
      const msg =
        e instanceof Error ? formatPreviewError(0, { error: e.message }) : formatPreviewError(0, null)
      setPreviewError(msg)
      showTooLargeFromMessage(msg)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!file) {
      setStatus({ type: "error", message: "Select a CSV file first." })
      return
    }
    if (previewLimit === "all" && isAllRowsPreviewBlocked(file)) {
      const msg = formatPreviewError(413, null, { preflightAll: true })
      setStatus({ type: "error", message: msg })
      openCsvTooLargeDialog(csvTooLarge.show, { preflightAll: true, fileBytes: file.size })
      return
    }
    setUploading(true)
    setStatus(null)
    try {
      const uploadFile = await buildUploadCsvFile(file, previewLimit, excludePreviewIndices)
      if (uploadFile.size > VERCEL_UPLOAD_LIMIT_BYTES) {
        const msg = formatPreviewError(413, null, { uploadBytes: uploadFile.size })
        setStatus({ type: "error", message: msg })
        openCsvTooLargeDialog(csvTooLarge.show, { uploadBytes: uploadFile.size })
        return
      }
      const formData = new FormData()
      formData.append("data", uploadFile)
      formData.append("endpoint", endpoint)
      formData.append("supabaseProject", supabaseProject)
      const res = await fetch("/api/ingestion", { method: "POST", body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus({ type: "error", message: data.error || res.statusText || "Upload failed" })
        return
      }
      const kept = previewLeads.length - excludePreviewIndices.length
      const limitNote = previewLimit === "all" && previewCsvTotal != null
        ? ` (${kept.toLocaleString()} rows)`
        : ` (${kept} of ${previewLeads.length} rows)`
      setStatus({ type: "success", message: `Upload sent to n8n successfully${limitNote}.` })
      setFile(null)
      setFileCsvRowCount(null)
      setAllPreviewLeads([])
      setPreviewCsvTotal(null)
      setPreviewError(null)
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
                {file ? (
                  <>
                    {file.name}
                    <span className="text-muted-foreground/80">
                      {" "}
                      · {formatBytes(file.size)}
                      {fileCsvRowCount != null ? ` · ~${fileCsvRowCount.toLocaleString()} rows` : ""}
                    </span>
                  </>
                ) : (
                  "Drop CSV here or click to browse"
                )}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex items-center gap-2">
                <Label htmlFor="ing-preview-limit" className="text-xs text-muted-foreground whitespace-nowrap">
                  Rows to upload
                </Label>
                <Select value={previewLimit} onValueChange={setPreviewLimit}>
                  <SelectTrigger id="ing-preview-limit" className="h-8 w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="150">150</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="all" disabled={isAllRowsPreviewBlocked(file)}>
                      All
                      {fileCsvRowCount != null ? ` (${fileCsvRowCount.toLocaleString()})` : ""}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!file || previewLoading}
                onClick={handlePreview}
              >
                {previewLoading ? "Loading…" : "Preview cleaned leads"}
              </Button>
              <Button onClick={handleSubmit} disabled={!file || uploading}>
                {uploading ? "Uploading…" : "Upload"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Only the selected row count is sent to the server (hosted deploy has a ~4.5MB upload limit). Changing rows clears preview — click Preview again.
              {isAllRowsPreviewBlocked(file) && previewLimit !== "all" && (
                <span className="block mt-1 text-amber-700 dark:text-amber-400">
                  Full-file upload is disabled for this CSV (too large). Use 50–200 rows or split the file.
                </span>
              )}
            </p>
            {previewError && <p className="text-sm text-destructive">{previewError}</p>}
            {allPreviewLeads.length > 0 && (
              <div className="space-y-2 rounded-md border bg-muted/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    Parser & cleaner preview ({previewLeads.length.toLocaleString()}
                    {fileCsvRowCount != null &&
                    previewLimit !== "all" &&
                    fileCsvRowCount > previewLeads.length
                      ? ` of ${fileCsvRowCount.toLocaleString()} in CSV`
                      : previewCsvTotal != null && previewCsvTotal > previewLeads.length
                        ? ` of ${previewCsvTotal.toLocaleString()} parsed`
                        : ""}{" "}
                    rows)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Upload cap: {previewLimit === "all" ? "all rows" : `${previewLimit} rows`}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Bullets (•), hyphens (-), and leading dots removed; spaces collapsed. Remove rows you don’t want to upload.
                </p>
                <div className="overflow-x-auto rounded border max-h-[320px] overflow-y-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 bg-muted/80">
                      <tr>
                        <th className="text-left p-2 font-medium">Enrich_person</th>
                        <th className="text-left p-2 font-medium">A Email</th>
                        <th className="text-left p-2 font-medium">LinkedIn</th>
                        <th className="text-left p-2 font-medium">Company</th>
                        <th className="text-left p-2 font-medium">Scores</th>
                        <th className="w-8 p-2" aria-label="Remove" />
                      </tr>
                    </thead>
                    <tbody>
                      {previewLeads
                        .map((row, i) => ({ row, i }))
                        .filter(({ i }) => !excludePreviewIndices.includes(i))
                        .map(({ row, i }) => (
                          <tr key={i} className="border-t border-border">
                            <td className="p-2 max-w-[200px] truncate" title={row.full_name ?? ""}>{row.full_name ?? "—"}</td>
                            <td className="p-2 max-w-[180px] truncate" title={row.email ?? ""}>{row.email ?? "—"}</td>
                            <td className="p-2 max-w-[180px] truncate" title={row.profile_url ?? ""}>{row.profile_url ?? "—"}</td>
                            <td className="p-2 max-w-[200px]">
                              <div className="truncate" title={companyPrimaryLine(row.company_info)}>{companyPrimaryLine(row.company_info)}</div>
                              {row.company_description && (
                                <div className="text-[10px] text-muted-foreground truncate" title={row.company_description}>
                                  {row.company_description}
                                </div>
                              )}
                            </td>
                            <td className="p-2 whitespace-nowrap font-mono text-[11px]" title={formatIcpScores(row.icp_scores)}>{formatIcpScores(row.icp_scores)}</td>
                            <td className="p-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => removeLeadFromPreview(i)}
                                title="Remove this row from preview"
                              >
                                <Trash2Icon className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {excludePreviewIndices.length > 0 && (
                  <p className="text-xs text-muted-foreground">{excludePreviewIndices.length} row(s) excluded. Re-run Preview to reset.</p>
                )}
              </div>
            )}

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
      {csvTooLarge.dialog}
    </AppShell>
  )
}
