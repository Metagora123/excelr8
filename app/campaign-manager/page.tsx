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
import { TargetIcon, UploadIcon, CheckCircle2Icon, CircleIcon, Trash2Icon } from "lucide-react"
import {
  buildUploadCsvFile,
  countCsvDataRows,
  formatBytes,
  isAllRowsPreviewBlocked,
  sliceRows,
  VERCEL_UPLOAD_LIMIT_BYTES,
} from "@/lib/csv-truncate"
import { formatPreviewError } from "@/lib/preview-errors"

/** Clay company intelligence + ICP scores parsed from a CSV row, as returned by the preview API. */
type PreviewCompanyInfo = {
  industry?: string | null
  segment?: string | null
  type?: string | null
  employee_range?: string | null
  employee_count?: number | null
  year_founded?: number | null
  specialties?: string | string[] | null
  sales_navigator_url?: string | null
  recommended_action?: string | null
  recommended_next_enrichment?: string | null
} | null

type PreviewIcpScores = {
  priority_score?: number | null
  confidence_score?: number | null
  icp_risk_score?: number | null
  technographic_fit_score?: number | null
  firmographic_fit_score?: number | null
} | null

/** Compact "P 82 · C 90" string for the preview Scores column. Empty -> "—". */
function formatIcpScores(icp: PreviewIcpScores): string {
  if (!icp) return "—"
  const parts: string[] = []
  if (icp.priority_score != null) parts.push(`P ${icp.priority_score}`)
  if (icp.confidence_score != null) parts.push(`C ${icp.confidence_score}`)
  return parts.length > 0 ? parts.join(" · ") : "—"
}

/** Primary line for the preview Company column: industry, else company type/segment. */
function companyPrimaryLine(info: PreviewCompanyInfo): string {
  if (!info) return "—"
  return info.industry || info.type || info.segment || "—"
}

function getWebhookSuffix(project: "sales2k25" | "prod2k26"): string {
  return project === "prod2k26" ? "-prod2k26" : ""
}

function getAutoLikeButtonFormula(project: "sales2k25" | "prod2k26"): string {
  const suffix = getWebhookSuffix(project)
  return `"https://n8n.srv1123126.hstgr.cloud/webhook/confirm-unipile${suffix}"
& "?post_id=" & {post_id}

& "&record_id=" & RECORD_ID()
& "&campaign_id=" & ENCODE_URL_COMPONENT({campaign_id})
& "&comment_a=" & ENCODE_URL_COMPONENT({comment_a})
& "&comment_b=" & ENCODE_URL_COMPONENT({comment_b})
& "&comment_c=" & ENCODE_URL_COMPONENT({comment_c})
& "&comment_d=" & ENCODE_URL_COMPONENT({comment_d})
& "&confirm=" & ENCODE_URL_COMPONENT({Confirm_Column})
& "&reaction=" & ENCODE_URL_COMPONENT({Reaction})
& "&custom_comment=" & ENCODE_URL_COMPONENT({Custom_Comment_Data})
& "&poster=" & ENCODE_URL_COMPONENT({Select_Poster})
& "&final_comment=" & ENCODE_URL_COMPONENT({Final_Comment})
& "&lead_profile=" & ENCODE_URL_COMPONENT({lead_profile})
& "&lead_name=" & ENCODE_URL_COMPONENT({lead_name})`
}

function getHitlistButtonFormula(project: "sales2k25" | "prod2k26"): string {
  const suffix = getWebhookSuffix(project)
  return `"https://n8n.srv1123126.hstgr.cloud/webhook/confirm-hitlist${suffix}"
& "?record_id=" & RECORD_ID()
& "&campaign_id=" & ENCODE_URL_COMPONENT({campaign_id})
& "&message_1=" & ENCODE_URL_COMPONENT({Message_1})
& "&message_2=" & ENCODE_URL_COMPONENT({Message_2})
& "&message_3=" & ENCODE_URL_COMPONENT({Message_3})
& "&tempo_1=" & ENCODE_URL_COMPONENT({Tempo_1})
& "&tempo_2=" & ENCODE_URL_COMPONENT({Tempo_2})
& "&tempo_3=" & ENCODE_URL_COMPONENT({Tempo_3})
& "&select_poster=" & ENCODE_URL_COMPONENT({Select_Poster})
& "&linkedin=" & ENCODE_URL_COMPONENT({LinkedIn})`
}

/**
 * In-app Airtable button: GET to /api/airtable/trigger. The dashboard validates
 * `{Button_Token}` against the campaign's secret and dispatches the right
 * lifecycle action (invite / acceptance / message) based on row status.
 *
 * Uses NEXT_PUBLIC_DASHBOARD_URL when set (so production URLs are copied even
 * from localhost); otherwise the current browser origin.
 */
function getInAppHitlistButtonFormula(): string {
  const fromEnv =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_DASHBOARD_URL
      ? String(process.env.NEXT_PUBLIC_DASHBOARD_URL).trim().replace(/\/+$/, "")
      : ""
  const origin =
    fromEnv ||
    (typeof window !== "undefined" && window.location?.origin ? window.location.origin : "") ||
    "https://YOUR-DASHBOARD-DOMAIN"
  return `"${origin}/api/airtable/trigger"
& "?campaign_id=" & ENCODE_URL_COMPONENT({campaign_id})
& "&record_id=" & RECORD_ID()
& "&token=" & ENCODE_URL_COMPONENT({Button_Token})`
}

type InlineCheckpointKey =
  | "campaign_created"
  | "leads_parsed"
  | "leads_upserted"
  | "lead_campaigns_filled"
  | "leads_enriched"
  | "airtable_auto_like_table_created"
  | "airtable_hitlist_table_created"
  | "n8n_auto_like_workflow_duplicated"
  | "n8n_hitlist_workflow_duplicated"
  | "completed"

const INLINE_CHECKPOINTS: { key: InlineCheckpointKey; label: string }[] = [
  { key: "campaign_created", label: "Campaign row created" },
  { key: "leads_parsed", label: "CSV parsed" },
  { key: "leads_upserted", label: "Leads upserted" },
  { key: "lead_campaigns_filled", label: "Lead–campaign links filled" },
  { key: "leads_enriched", label: "Leads enriched (profile + posts)" },
  { key: "airtable_auto_like_table_created", label: "Airtable Auto Like table created" },
  { key: "airtable_hitlist_table_created", label: "Airtable Hitlist table created" },
  { key: "n8n_auto_like_workflow_duplicated", label: "n8n Auto Like workflow duplicated" },
  { key: "n8n_hitlist_workflow_duplicated", label: "n8n Hitlist workflow duplicated" },
  { key: "completed", label: "Done" },
]

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
  const [managedByOptions, setManagedByOptions] = React.useState<{ id: string; username: string }[]>([])
  const inputRef = React.useRef<HTMLInputElement>(null)

  // In-app flow state
  const [inlineLoading, setInlineLoading] = React.useState(false)
  const [inlineCheckpoints, setInlineCheckpoints] = React.useState<Record<InlineCheckpointKey, boolean>>(
    {} as Record<InlineCheckpointKey, boolean>
  )
  const [inlineError, setInlineError] = React.useState<string | null>(null)
  const [enableAutoLike, setEnableAutoLike] = React.useState(true)
  const [enableHitlist, setEnableHitlist] = React.useState(true)
  const [enableAutoLikeWorkflow, setEnableAutoLikeWorkflow] = React.useState(false)
  const [enableHitlistWorkflow, setEnableHitlistWorkflow] = React.useState(false)
  const [enableCampaignAutomation, setEnableCampaignAutomation] = React.useState(false)
  const [inlineResult, setInlineResult] = React.useState<{
    campaignId?: string
    airtableHitlistUrl?: string
    airtableAutoLikeUrl?: string
    n8nHitlistWorkflowUrl?: string
    n8nAutoLikeWorkflowUrl?: string
    leadsCount?: number
    airtableUrlsSaved?: boolean
    enrichmentSummary?: {
      enrichedCount: number
      failedCount: number
      skipCount: number
      logs: Array<{ type: string; profile_url: string; full_name: string | null; message: string; postsStored?: number }>
    }
    autoLikeZeroRowsMessage?: string
  } | null>(null)
  const [enrichmentLogs, setEnrichmentLogs] = React.useState<Array<{ type: string; profile_url: string; full_name: string | null; message: string; postsStored?: number }>>([])
  // Live enrichment tracker; `currentLead` is set while a lead is mid-flight,
  // then cleared when the final N/N beacon arrives so the bar lands at 100%.
  const [enrichmentProgress, setEnrichmentProgress] = React.useState<{
    done: number
    total: number
    currentLead: string | null
  } | null>(null)
  const [rollback, setRollback] = React.useState<{
    airtableBaseId?: string
    airtableHitlistTableId?: string
    airtableAutoLikeTableId?: string
    n8nAutoLikeWorkflowId?: string
    n8nHitlistWorkflowId?: string
  } | null>(null)
  const [rollbackLoading, setRollbackLoading] = React.useState(false)
  const [rollbackMessage, setRollbackMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null)
  const [hitlistSchema, setHitlistSchema] = React.useState<{
    schemaSource: "airtable" | "static"
    schemaError?: string
    fields: Array<{ name: string; type: string }>
  } | null>(null)
  const [autoLikeSchema, setAutoLikeSchema] = React.useState<{
    schemaSource: "airtable" | "static"
    schemaError?: string
    fields: Array<{ name: string; type: string }>
  } | null>(null)
  const [allPreviewLeads, setAllPreviewLeads] = React.useState<Array<{
    full_name: string | null
    email: string | null
    profile_url: string | null
    company_info: PreviewCompanyInfo
    icp_scores: PreviewIcpScores
    company_description: string | null
    existingCampaigns: Array<{ id: string; name: string | null }>
  }>>([])
  /** Total data rows in the selected CSV file (for display). */
  const [fileCsvRowCount, setFileCsvRowCount] = React.useState<number | null>(null)
  const [excludePreviewIndices, setExcludePreviewIndices] = React.useState<number[]>([])
  const [previewLimit, setPreviewLimit] = React.useState<string>("50")
  const [previewLoading, setPreviewLoading] = React.useState(false)
  const [previewError, setPreviewError] = React.useState<string | null>(null)
  const [duplicateLookupError, setDuplicateLookupError] = React.useState<string | null>(null)
  /** Total rows in CSV from last preview (`/api/campaign-manager/preview` `total`). Used for the >100 lead timeout warning. */
  const [previewCsvTotal, setPreviewCsvTotal] = React.useState<number | null>(null)
  const inlineInputRef = React.useRef<HTMLInputElement>(null)

  const previewLeads = React.useMemo(
    () => sliceRows(allPreviewLeads, previewLimit),
    [allPreviewLeads, previewLimit]
  )

  React.useEffect(() => {
    setExcludePreviewIndices([])
    setAllPreviewLeads([])
    setPreviewCsvTotal(null)
    setDuplicateLookupError(null)
    setPreviewError(null)
  }, [previewLimit])

  const loadClients = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/clients?project=${encodeURIComponent(supabaseProject)}`)
      if (res.ok) setClients(await res.json())
      else setClients([])
    } catch {
      setClients([])
    }
  }, [supabaseProject])

  const loadManagedBy = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/managed-by?project=${encodeURIComponent(supabaseProject)}`)
      if (res.ok) setManagedByOptions(await res.json())
      else setManagedByOptions([])
    } catch {
      setManagedByOptions([])
    }
  }, [supabaseProject])

  React.useEffect(() => {
    loadClients()
    loadManagedBy()
  }, [loadClients, loadManagedBy])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    setFile(f ?? null)
    setAllPreviewLeads([])
    setExcludePreviewIndices([])
    setPreviewError(null)
    setPreviewCsvTotal(null)
    setFileCsvRowCount(null)
    if (f) {
      void countCsvDataRows(f).then(setFileCsvRowCount).catch(() => setFileCsvRowCount(null))
    }
  }

  const handlePreview = async () => {
    if (!file) return

    if (previewLimit === "all" && isAllRowsPreviewBlocked(file)) {
      setPreviewError(formatPreviewError(413, null, { preflightAll: true }))
      return
    }

    setPreviewLoading(true)
    setPreviewError(null)
    setAllPreviewLeads([])
    setExcludePreviewIndices([])
    setDuplicateLookupError(null)
    setPreviewCsvTotal(null)
    try {
      const uploadFile = await buildUploadCsvFile(file, previewLimit, [])
      if (uploadFile.size > VERCEL_UPLOAD_LIMIT_BYTES) {
        setPreviewError(formatPreviewError(413, null, { uploadBytes: uploadFile.size }))
        return
      }

      const formData = new FormData()
      formData.append("file", uploadFile)
      formData.append("supabaseProject", supabaseProject)
      const res = await fetch("/api/campaign-manager/preview", { method: "POST", body: formData })
      const data = (await res.json().catch(() => ({}))) as {
        leads?: Array<{
          full_name?: string | null
          email?: string | null
          profile_url?: string | null
          company_info?: PreviewCompanyInfo
          icp_scores?: PreviewIcpScores
          company_description?: string | null
          existingCampaigns?: Array<{ id: string; name: string | null }>
        }>
        total?: number
        duplicateLookupError?: string
        error?: string
        code?: string
      }
      if (!res.ok) {
        setPreviewError(formatPreviewError(res.status, data))
        return
      }
      const leads = data.leads ?? []
      setPreviewCsvTotal(typeof data.total === "number" ? data.total : leads.length)
      setAllPreviewLeads(
        leads.map((l) => ({
          full_name: l.full_name ?? null,
          email: l.email ?? null,
          profile_url: l.profile_url ?? null,
          company_info: l.company_info ?? null,
          icp_scores: l.icp_scores ?? null,
          company_description: l.company_description ?? null,
          existingCampaigns: Array.isArray(l.existingCampaigns) ? l.existingCampaigns : [],
        }))
      )
      if (data.duplicateLookupError) setDuplicateLookupError(data.duplicateLookupError)
    } catch (e) {
      setPreviewError(
        e instanceof Error ? formatPreviewError(0, { error: e.message }) : formatPreviewError(0, null)
      )
    } finally {
      setPreviewLoading(false)
    }
  }

  const removeLeadFromPreview = (rowIndex: number) => {
    setExcludePreviewIndices((prev) => [...prev, rowIndex].sort((a, b) => a - b))
  }

  const handleSubmit = async () => {
    if (!file) {
      setStatus({ type: "error", message: "Select a CSV file." })
      return
    }
    setLoading(true)
    setStatus(null)
    try {
      const uploadFile = await buildUploadCsvFile(file, previewLimit, excludePreviewIndices)
      const formData = new FormData()
      formData.append("file", uploadFile)
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
      const kept = previewLeads.length - excludePreviewIndices.length
      const limitNote = previewLimit === "all" && previewCsvTotal != null
        ? ` (${kept.toLocaleString()} rows)`
        : ` (${kept} of ${previewLeads.length} rows)`
      setStatus({ type: "success", message: `Campaign sent to n8n${limitNote}.` })
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

  const handleCreateInApp = async () => {
    if (!file) {
      setInlineError("Select a CSV file.")
      return
    }
    if (!clientId) {
      setInlineError("Select a client.")
      return
    }
    setInlineLoading(true)
    setInlineError(null)
    setInlineCheckpoints({} as Record<InlineCheckpointKey, boolean>)
    setInlineResult(null)
    setHitlistSchema(null)
    setAutoLikeSchema(null)
    setRollback(null)
    setRollbackMessage(null)
    setEnrichmentLogs([])
    setEnrichmentProgress(null)
    try {
      const uploadFile = await buildUploadCsvFile(file, previewLimit, excludePreviewIndices)
      const formData = new FormData()
      formData.append("file", uploadFile)
      formData.append("campaignName", campaignName)
      formData.append("clientId", clientId)
      formData.append("category", category)
      formData.append("managedBy", managedBy)
      formData.append("supabaseProject", supabaseProject)
      formData.append("enableAutoLike", String(enableAutoLike))
      formData.append("enableHitlist", String(enableHitlist))
      formData.append("enableAutoLikeWorkflow", String(enableAutoLikeWorkflow))
      formData.append("enableHitlistWorkflow", String(enableHitlistWorkflow))
      formData.append("enableCampaignAutomation", String(enableCampaignAutomation))
      const res = await fetch("/api/campaign-manager/inline", { method: "POST", body: formData })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setInlineError(data.error || res.statusText || "Request failed")
        setInlineLoading(false)
        return
      }
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) {
        setInlineError("No response body")
        setInlineLoading(false)
        return
      }
      let buffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const obj = JSON.parse(line) as Record<string, unknown>
            if (typeof obj.checkpoint === "string") {
              const cp = obj.checkpoint as InlineCheckpointKey
              setInlineCheckpoints((prev) => ({ ...prev, [cp]: true }))
            }
            if (obj.checkpoint === "airtable_auto_like_table_created" && obj.fields && Array.isArray(obj.fields)) {
              setAutoLikeSchema({
                schemaSource: (obj.schemaSource === "airtable" ? "airtable" : "static") as "airtable" | "static",
                schemaError: typeof obj.schemaError === "string" ? obj.schemaError : undefined,
                fields: (obj.fields as Array<{ name: string; type: string }>).map((f) => ({ name: f.name ?? "", type: f.type ?? "" })),
              })
            }
            if (typeof obj.autoLikeZeroRowsMessage === "string") {
              setInlineResult((prev) => (prev ? { ...prev, autoLikeZeroRowsMessage: obj.autoLikeZeroRowsMessage as string } : { campaignId: "", autoLikeZeroRowsMessage: obj.autoLikeZeroRowsMessage as string }))
            }
            if (obj.checkpoint === "airtable_hitlist_table_created" && obj.fields && Array.isArray(obj.fields)) {
              setHitlistSchema({
                schemaSource: (obj.schemaSource === "airtable" ? "airtable" : "static") as "airtable" | "static",
                schemaError: typeof obj.schemaError === "string" ? obj.schemaError : undefined,
                fields: (obj.fields as Array<{ name: string; type: string }>).map((f) => ({ name: f.name ?? "", type: f.type ?? "" })),
              })
            }
            if (obj.error != null) {
              let msg = String(obj.error) + (obj.detail ? `: ${obj.detail}` : "")
              if (excludePreviewIndices.length > 0 && /no valid leads|0 lead/i.test(msg)) {
                msg += " You excluded rows from the preview; if all CSV rows were excluded, add fewer exclusions or re-run Preview to reset."
              }
              setInlineError(msg)
            }
            if (obj.campaignId != null) {
              setInlineResult((prev) => ({
                ...prev,
                campaignId: String(obj.campaignId),
                airtableHitlistUrl: obj.airtableHitlistUrl != null ? String(obj.airtableHitlistUrl) : undefined,
                airtableAutoLikeUrl: obj.airtableAutoLikeUrl != null ? String(obj.airtableAutoLikeUrl) : undefined,
                n8nHitlistWorkflowUrl: obj.n8nHitlistWorkflowUrl != null ? String(obj.n8nHitlistWorkflowUrl) : undefined,
                n8nAutoLikeWorkflowUrl: obj.n8nAutoLikeWorkflowUrl != null ? String(obj.n8nAutoLikeWorkflowUrl) : undefined,
                leadsCount: typeof obj.leadsCount === "number" ? obj.leadsCount : undefined,
              airtableUrlsSaved:
                obj.airtableUrlsSaved === true ? true : prev?.airtableUrlsSaved,
                enrichmentSummary:
                  obj.enrichmentSummary != null && typeof obj.enrichmentSummary === "object"
                    ? (obj.enrichmentSummary as { enrichedCount: number; failedCount: number; skipCount: number; logs: Array<{ type: string; profile_url: string; full_name: string | null; message: string; postsStored?: number }> })
                    : prev?.enrichmentSummary,
              }))
            }
            if (obj.enrichment_progress != null && typeof obj.enrichment_progress === "object") {
              const p = obj.enrichment_progress as { done?: number; total?: number; currentLead?: string | null }
              setEnrichmentProgress({
                done: typeof p.done === "number" ? p.done : 0,
                total: typeof p.total === "number" ? p.total : 0,
                currentLead: typeof p.currentLead === "string" ? p.currentLead : null,
              })
            }
            if (obj.enrichment_log != null && typeof obj.enrichment_log === "object") {
              const e = obj.enrichment_log as { type?: string; profile_url?: string; full_name?: string | null; message?: string; postsStored?: number }
              setEnrichmentLogs((prev) => [...prev, { type: e.type ?? "skip", profile_url: e.profile_url ?? "", full_name: e.full_name ?? null, message: e.message ?? "", postsStored: e.postsStored }])
            }
            if (obj.enrichment_summary != null && typeof obj.enrichment_summary === "object") {
              const s = obj.enrichment_summary as { enrichedCount?: number; failedCount?: number; skipCount?: number; logs?: unknown[] }
              setInlineResult((prev) => prev ? { ...prev, enrichmentSummary: { enrichedCount: s.enrichedCount ?? 0, failedCount: s.failedCount ?? 0, skipCount: s.skipCount ?? 0, logs: Array.isArray(s.logs) ? s.logs as Array<{ type: string; profile_url: string; full_name: string | null; message: string; postsStored?: number }> : [] } } : null)
            }
            if (obj.checkpoint === "completed" && obj.rollback && typeof obj.rollback === "object") {
              const r = obj.rollback as Record<string, unknown>
              setRollback({
                airtableBaseId: r.airtableBaseId != null ? String(r.airtableBaseId) : undefined,
                airtableHitlistTableId: r.airtableHitlistTableId != null ? String(r.airtableHitlistTableId) : undefined,
                airtableAutoLikeTableId: r.airtableAutoLikeTableId != null ? String(r.airtableAutoLikeTableId) : undefined,
                n8nAutoLikeWorkflowId: r.n8nAutoLikeWorkflowId != null ? String(r.n8nAutoLikeWorkflowId) : undefined,
                n8nHitlistWorkflowId: r.n8nHitlistWorkflowId != null ? String(r.n8nHitlistWorkflowId) : undefined,
              })
            }
          } catch {
            // skip malformed line
          }
        }
      }
      if (buffer.trim()) {
        try {
          const obj = JSON.parse(buffer) as Record<string, unknown>
          if (typeof obj.checkpoint === "string") {
            const cp = obj.checkpoint as InlineCheckpointKey
            setInlineCheckpoints((prev) => ({ ...prev, [cp]: true }))
          }
          if (obj.checkpoint === "airtable_auto_like_table_created" && obj.fields && Array.isArray(obj.fields)) {
            setAutoLikeSchema({
              schemaSource: (obj.schemaSource === "airtable" ? "airtable" : "static") as "airtable" | "static",
              schemaError: typeof obj.schemaError === "string" ? obj.schemaError : undefined,
              fields: (obj.fields as Array<{ name: string; type: string }>).map((f) => ({ name: f.name ?? "", type: f.type ?? "" })),
            })
          }
          if (typeof obj.autoLikeZeroRowsMessage === "string") {
            setInlineResult((prev) => (prev ? { ...prev, autoLikeZeroRowsMessage: obj.autoLikeZeroRowsMessage as string } : { campaignId: "", autoLikeZeroRowsMessage: obj.autoLikeZeroRowsMessage as string }))
          }
          if (obj.checkpoint === "airtable_hitlist_table_created" && obj.fields && Array.isArray(obj.fields)) {
            setHitlistSchema({
              schemaSource: (obj.schemaSource === "airtable" ? "airtable" : "static") as "airtable" | "static",
              schemaError: typeof obj.schemaError === "string" ? obj.schemaError : undefined,
              fields: (obj.fields as Array<{ name: string; type: string }>).map((f) => ({ name: f.name ?? "", type: f.type ?? "" })),
            })
          }
          if (obj.error != null) setInlineError(String(obj.error))
          if (obj.campaignId != null) {
            setInlineResult((prev) => ({
              ...prev,
              campaignId: String(obj.campaignId),
              airtableHitlistUrl: obj.airtableHitlistUrl != null ? String(obj.airtableHitlistUrl) : undefined,
              airtableAutoLikeUrl: obj.airtableAutoLikeUrl != null ? String(obj.airtableAutoLikeUrl) : undefined,
              n8nHitlistWorkflowUrl: obj.n8nHitlistWorkflowUrl != null ? String(obj.n8nHitlistWorkflowUrl) : undefined,
              n8nAutoLikeWorkflowUrl: obj.n8nAutoLikeWorkflowUrl != null ? String(obj.n8nAutoLikeWorkflowUrl) : undefined,
              leadsCount: typeof obj.leadsCount === "number" ? obj.leadsCount : undefined,
              airtableUrlsSaved: obj.airtableUrlsSaved === true ? true : prev?.airtableUrlsSaved,
              enrichmentSummary:
                obj.enrichmentSummary != null && typeof obj.enrichmentSummary === "object"
                  ? (obj.enrichmentSummary as { enrichedCount: number; failedCount: number; skipCount: number; logs: Array<{ type: string; profile_url: string; full_name: string | null; message: string; postsStored?: number }> })
                  : prev?.enrichmentSummary,
            }))
          }
          if (obj.enrichment_progress != null && typeof obj.enrichment_progress === "object") {
            const p = obj.enrichment_progress as { done?: number; total?: number; currentLead?: string | null }
            setEnrichmentProgress({
              done: typeof p.done === "number" ? p.done : 0,
              total: typeof p.total === "number" ? p.total : 0,
              currentLead: typeof p.currentLead === "string" ? p.currentLead : null,
            })
          }
          if (obj.enrichment_log != null && typeof obj.enrichment_log === "object") {
            const e = obj.enrichment_log as { type?: string; profile_url?: string; full_name?: string | null; message?: string; postsStored?: number }
            setEnrichmentLogs((prev) => [...prev, { type: e.type ?? "skip", profile_url: e.profile_url ?? "", full_name: e.full_name ?? null, message: e.message ?? "", postsStored: e.postsStored }])
          }
          if (obj.enrichment_summary != null && typeof obj.enrichment_summary === "object") {
            const s = obj.enrichment_summary as { enrichedCount?: number; failedCount?: number; skipCount?: number; logs?: unknown[] }
            setInlineResult((prev) => prev ? { ...prev, enrichmentSummary: { enrichedCount: s.enrichedCount ?? 0, failedCount: s.failedCount ?? 0, skipCount: s.skipCount ?? 0, logs: Array.isArray(s.logs) ? (s.logs as Array<{ type: string; profile_url: string; full_name: string | null; message: string; postsStored?: number }>) : [] } } : null)
          }
          if (obj.checkpoint === "completed" && obj.rollback && typeof obj.rollback === "object") {
            const r = obj.rollback as Record<string, unknown>
            setRollback({
              airtableBaseId: r.airtableBaseId != null ? String(r.airtableBaseId) : undefined,
              airtableHitlistTableId: r.airtableHitlistTableId != null ? String(r.airtableHitlistTableId) : undefined,
              airtableAutoLikeTableId: r.airtableAutoLikeTableId != null ? String(r.airtableAutoLikeTableId) : undefined,
              n8nAutoLikeWorkflowId: r.n8nAutoLikeWorkflowId != null ? String(r.n8nAutoLikeWorkflowId) : undefined,
              n8nHitlistWorkflowId: r.n8nHitlistWorkflowId != null ? String(r.n8nHitlistWorkflowId) : undefined,
            })
          }
        } catch {
          // ignore
        }
      }
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : "Request failed")
    } finally {
      setInlineLoading(false)
    }
  }

  return (
    <AppShell title="Campaign Manager">
      <div className="px-4 lg:px-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Campaign Manager</h2>
          <p className="text-muted-foreground text-sm">
            Create campaign: client, category, managed by, and CSV. Send to n8n (first card) or run in-app with Supabase, Airtable, and n8n workflows (second card).
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>New Campaign (n8n)</CardTitle>
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
                    {managedByOptions.map((a) => (
                      <SelectItem key={a.id} value={a.username}>
                        {a.username}
                      </SelectItem>
                    ))}
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
                    "Click to select CSV"
                  )}
                </p>
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

        <Card>
          <CardHeader>
            <CardTitle>Create Campaign In-App</CardTitle>
            <CardDescription>
              Use the form above (Supabase project, campaign name, client, category, managed by, CSV). Creates campaign in Supabase, upserts leads, fills lead–campaign links, enriches every lead in-app (live progress shown below), creates Airtable tables, and duplicates n8n workflows. Checkpoints update as each step completes.
              {" "}
              <span className="text-amber-700 dark:text-amber-400">
                Use <strong>Preview cleaned leads</strong> to see total CSV row count. Lists over ~100 leads may hit the 5-minute server limit—split the file if enrichment stops early.
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {previewCsvTotal != null && previewCsvTotal > 100 && (
              <p className="text-sm rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-900 dark:text-amber-100">
                This CSV has <strong>{previewCsvTotal}</strong> rows. In-app enrichment is capped by a ~5-minute server window; very large lists may time out before every lead finishes. Consider splitting into two uploads if you see incomplete enrichment.
              </p>
            )}
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableAutoLike}
                  onChange={(e) => setEnableAutoLike(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm font-medium">Auto Like / Auto Comment</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableHitlist}
                  onChange={(e) => setEnableHitlist(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm font-medium">Hitlist (invites / messages)</span>
              </label>
              <div className="flex flex-wrap gap-6 opacity-50 grayscale pointer-events-none select-none" aria-disabled="true" title="n8n workflow duplication is currently disabled">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={false}
                    disabled
                    readOnly
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className="text-sm font-medium">Auto Like / Auto Comment n8n workflow</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={false}
                    disabled
                    readOnly
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className="text-sm font-medium">Hitlist n8n workflow</span>
                </label>
              </div>
              <span className="text-xs text-muted-foreground basis-full">n8n workflow duplication is currently disabled.</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableCampaignAutomation}
                  onChange={(e) => setEnableCampaignAutomation(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm font-medium">Campaign automation (in-app hitlist)</span>
              </label>
            </div>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex items-center gap-2">
                <Label htmlFor="cm-preview-limit" className="text-xs text-muted-foreground whitespace-nowrap">
                  Rows to preview
                </Label>
                <Select value={previewLimit} onValueChange={setPreviewLimit}>
                  <SelectTrigger id="cm-preview-limit" className="h-8 w-[120px]">
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
            </div>
            <p className="text-xs text-muted-foreground">
              Only the selected row count is sent to the server (hosted deploy has a ~4.5MB upload limit). Same cap applies to Create / Send to n8n. Changing rows clears preview — click Preview again.
              {isAllRowsPreviewBlocked(file) && previewLimit !== "all" && (
                <span className="block mt-1 text-amber-700 dark:text-amber-400">
                  Full-file preview is disabled for this CSV (too large). Use 50–200 rows or split the file.
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
                  Bullets (•), hyphens (-), and leading dots removed; spaces collapsed. Remove rows you don’t want in the campaign—excluded rows are not sent when you click Create. Rows highlighted in yellow already belong to another campaign (matched by LinkedIn URL).
                </p>
                {duplicateLookupError && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Duplicate lookup failed ({duplicateLookupError}). Showing leads without cross-campaign info.
                  </p>
                )}
                {(() => {
                  const visibleDuplicates = previewLeads.filter(
                    (row, i) => !excludePreviewIndices.includes(i) && row.existingCampaigns.length > 0
                  ).length
                  if (visibleDuplicates === 0) return null
                  return (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      {visibleDuplicates} row{visibleDuplicates === 1 ? "" : "s"} already in other campaigns.
                    </p>
                  )
                })()}
                <div className="overflow-x-auto rounded border max-h-[320px] overflow-y-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 bg-muted/80">
                      <tr>
                        <th className="text-left p-2 font-medium">Enrich_person</th>
                        <th className="text-left p-2 font-medium">A Email</th>
                        <th className="text-left p-2 font-medium">LinkedIn</th>
                        <th className="text-left p-2 font-medium">Company</th>
                        <th className="text-left p-2 font-medium">Scores</th>
                        <th className="text-left p-2 font-medium">In campaigns</th>
                        <th className="w-8 p-2" aria-label="Remove" />
                      </tr>
                    </thead>
                    <tbody>
                      {previewLeads
                        .map((row, i) => ({ row, i }))
                        .filter(({ i }) => !excludePreviewIndices.includes(i))
                        .map(({ row, i }) => {
                          const isDuplicate = row.existingCampaigns.length > 0
                          return (
                            <tr
                              key={i}
                              className={`border-t border-border ${
                                isDuplicate ? "bg-amber-100/70 dark:bg-amber-500/15" : ""
                              }`}
                            >
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
                              <td className="p-2 max-w-[220px]">
                                {isDuplicate ? (
                                  <div className="flex flex-wrap gap-1">
                                    {row.existingCampaigns.slice(0, 3).map((c) => (
                                      <span
                                        key={c.id}
                                        title={c.id}
                                        className="inline-flex items-center rounded border border-amber-400/60 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-mono text-amber-700 dark:text-amber-300"
                                      >
                                        {c.name && c.name.length > 0 ? c.name.slice(0, 28) : c.id.slice(0, 8)}
                                      </span>
                                    ))}
                                    {row.existingCampaigns.length > 3 && (
                                      <span className="text-[10px] text-muted-foreground">
                                        +{row.existingCampaigns.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="p-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeLeadFromPreview(i)}
                                  title="Remove this lead from campaign"
                                >
                                  <Trash2Icon className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
                {excludePreviewIndices.length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground">{excludePreviewIndices.length} row(s) excluded from campaign. Re-run Preview to reset.</p>
                    {excludePreviewIndices.length >= previewLeads.length && previewLeads.length > 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">You’ve excluded every visible row. If your CSV has no other rows, Create will fail with &quot;No valid leads&quot;.</p>
                    )}
                  </>
                )}
              </div>
            )}
            {enrichmentProgress && enrichmentProgress.total > 0 && (
              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <div className="flex items-center justify-between text-sm">
                  <Label className="m-0">Enriching leads</Label>
                  <span className="font-mono text-xs text-muted-foreground">
                    {enrichmentProgress.done}/{enrichmentProgress.total}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((enrichmentProgress.done / Math.max(1, enrichmentProgress.total)) * 100)
                      )}%`,
                    }}
                  />
                </div>
                <p className="truncate text-xs text-muted-foreground" title={enrichmentProgress.currentLead ?? undefined}>
                  {enrichmentProgress.currentLead
                    ? `Currently enriching: ${enrichmentProgress.currentLead}`
                    : enrichmentProgress.done >= enrichmentProgress.total
                      ? "Done."
                      : "Working…"}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Checkpoints</Label>
              <ul className="rounded-md border bg-muted/30 divide-y divide-border p-2">
                {INLINE_CHECKPOINTS.map(({ key, label }) => (
                  <li key={key} className="flex items-center gap-2 py-1.5 text-sm">
                    {inlineCheckpoints[key] ? (
                      <CheckCircle2Icon className="h-4 w-4 shrink-0 text-green-600" />
                    ) : (
                      <CircleIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className={inlineCheckpoints[key] ? "font-medium" : "text-muted-foreground"}>
                      {label} {inlineCheckpoints[key] ? "✓" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <Button
              onClick={handleCreateInApp}
              disabled={inlineLoading || !file || !clientId}
            >
              <TargetIcon className="mr-2 h-4 w-4" />
              {inlineLoading ? "Creating…" : "Create Campaign In-App"}
            </Button>
            {inlineError && (
              <p className="text-sm text-destructive">{inlineError}</p>
            )}
            {inlineResult?.campaignId && (
              <div className="rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm space-y-2">
                <p className="font-medium">Campaign created</p>
                <p>ID: <code className="bg-muted px-1 rounded">{inlineResult.campaignId}</code></p>
                {inlineResult.leadsCount != null && (
                  <p>Leads: {inlineResult.leadsCount}</p>
                )}
                {(inlineResult.enrichmentSummary || enrichmentLogs.length > 0) && (
                  <div className="rounded border border-border/50 bg-muted/20 p-2 space-y-1">
                    <p className="font-medium text-muted-foreground">Enrichment</p>
                    {inlineResult.enrichmentSummary ? (
                      <>
                        <p className="text-xs">
                          <span className="text-green-600 dark:text-green-400">{inlineResult.enrichmentSummary.enrichedCount} enriched</span>
                          {inlineResult.enrichmentSummary.failedCount > 0 && (
                            <span className="text-destructive ml-2">{inlineResult.enrichmentSummary.failedCount} failed</span>
                          )}
                          {inlineResult.enrichmentSummary.skipCount > 0 && (
                            <span className="text-muted-foreground ml-2">{inlineResult.enrichmentSummary.skipCount} skipped</span>
                          )}
                        </p>
                        {inlineResult.enrichmentSummary.logs.length > 0 && (
                          <details className="text-xs mt-1">
                            <summary className="cursor-pointer text-muted-foreground">View logs ({inlineResult.enrichmentSummary.logs.length})</summary>
                            <ul className="mt-1 max-h-40 overflow-y-auto space-y-0.5 list-none pl-0">
                              {inlineResult.enrichmentSummary.logs.map((log, i) => (
                                <li key={i} className="flex flex-wrap gap-x-2 gap-y-0">
                                  <span className={`shrink-0 font-mono ${log.type === "enriched" ? "text-green-600 dark:text-green-400" : log.type === "failed" ? "text-destructive" : "text-muted-foreground"}`}>
                                    [{log.type}]
                                  </span>
                                  <span className="truncate" title={log.full_name ?? log.profile_url}>{log.full_name || log.profile_url || "—"}</span>
                                  <span className="text-muted-foreground">{log.message}</span>
                                  {log.postsStored != null && <span className="text-muted-foreground">({log.postsStored} posts)</span>}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </>
                    ) : enrichmentLogs.length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {enrichmentLogs.filter((l) => l.type === "enriched").length} enriched, {enrichmentLogs.filter((l) => l.type === "failed").length} failed, {enrichmentLogs.filter((l) => l.type === "skip").length} skipped (live)
                      </p>
                    ) : null}
                  </div>
                )}
                <div className="grid gap-1">
                  <p className="font-medium text-muted-foreground">Links</p>
                  {inlineResult.airtableHitlistUrl && (
                    <div className="flex items-center gap-2">
                      <a
                        href={inlineResult.airtableHitlistUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        Airtable Hitlist table
                      </a>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => {
                          void navigator.clipboard?.writeText(inlineResult.airtableHitlistUrl as string)
                        }}
                      >
                        Copy URL
                      </Button>
                    </div>
                  )}
                  {inlineResult.airtableAutoLikeUrl && (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <a
                          href={inlineResult.airtableAutoLikeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline"
                        >
                          Airtable Auto Like table
                        </a>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => {
                            void navigator.clipboard?.writeText(inlineResult.airtableAutoLikeUrl as string)
                          }}
                        >
                          Copy URL
                        </Button>
                      </div>
                      {inlineResult.autoLikeZeroRowsMessage && (
                        <p className="text-xs text-muted-foreground">
                          {inlineResult.autoLikeZeroRowsMessage}
                        </p>
                      )}
                    </div>
                  )}
                  {inlineResult.n8nHitlistWorkflowUrl && (
                    <div className="flex items-center gap-2">
                      <a
                        href={inlineResult.n8nHitlistWorkflowUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        n8n Hitlist workflow
                      </a>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => {
                          void navigator.clipboard?.writeText(inlineResult.n8nHitlistWorkflowUrl as string)
                        }}
                      >
                        Copy URL
                      </Button>
                    </div>
                  )}
                  {inlineResult.n8nAutoLikeWorkflowUrl && (
                    <div className="flex items-center gap-2">
                      <a
                        href={inlineResult.n8nAutoLikeWorkflowUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        n8n Auto Like workflow
                      </a>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => {
                          void navigator.clipboard?.writeText(inlineResult.n8nAutoLikeWorkflowUrl as string)
                        }}
                      >
                        Copy URL
                      </Button>
                    </div>
                  )}
                </div>
                {(inlineResult.airtableHitlistUrl || inlineResult.airtableAutoLikeUrl) &&
                  inlineResult.airtableUrlsSaved && (
                  <p className="text-xs text-muted-foreground">
                    Airtable Hitlist and Auto Like URLs have been saved on the campaign row in Supabase.
                  </p>
                )}
                {rollback &&
                  (rollback.airtableHitlistTableId ||
                    rollback.airtableAutoLikeTableId ||
                    rollback.n8nAutoLikeWorkflowId ||
                    rollback.n8nHitlistWorkflowId) && (
                  <div className="pt-2 border-t border-border/50">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={rollbackLoading}
                      onClick={async () => {
                        setRollbackMessage(null)
                        setRollbackLoading(true)
                        try {
                          const res = await fetch("/api/campaign-manager/inline/rollback", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(rollback),
                          })
                          const data = (await res.json().catch(() => ({}))) as {
                            deleted?: string[]
                            errors?: string[]
                            error?: string
                          }
                          if (!res.ok) {
                            setRollbackMessage({
                              type: "error",
                              text: data.error || res.statusText || "Rollback failed",
                            })
                            return
                          }
                          const msg = data.deleted?.length
                            ? `Deleted: ${data.deleted.join(", ")}${
                                data.errors?.length ? `. Errors: ${data.errors.join("; ")}` : ""
                              }`
                            : data.errors?.length
                              ? `Errors: ${data.errors.join("; ")}`
                              : "Nothing was deleted."
                          setRollbackMessage({
                            type: data.errors?.length ? "error" : "success",
                            text: msg,
                          })
                          if (!data.errors?.length) {
                            setRollback(null)
                            setInlineResult((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    airtableHitlistUrl: undefined,
                                    airtableAutoLikeUrl: undefined,
                                    n8nHitlistWorkflowUrl: undefined,
                                    n8nAutoLikeWorkflowUrl: undefined,
                                  }
                                : null
                            )
                          }
                        } catch (e) {
                          setRollbackMessage({
                            type: "error",
                            text: e instanceof Error ? e.message : "Rollback failed",
                          })
                        } finally {
                          setRollbackLoading(false)
                        }
                      }}
                    >
                      <Trash2Icon className="mr-2 h-4 w-4" />
                      {rollbackLoading ? "Deleting…" : "Delete this run's Airtable tables & n8n workflows"}
                    </Button>
                    {rollbackMessage && (
                      <p
                        className={`mt-1 text-xs ${
                          rollbackMessage.type === "success"
                            ? "text-green-600 dark:text-green-400"
                            : "text-destructive"
                        }`}
                      >
                        {rollbackMessage.text}
                      </p>
                    )}
                    {rollbackMessage?.type === "error" && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        You can try again. Airtable table deletion may not be supported on your plan; n8n workflows are still deleted when possible.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            {(hitlistSchema || autoLikeSchema) && (
              <div className="space-y-4 rounded-md border bg-muted/20 p-4">
                <h4 className="text-sm font-semibold">Airtable table schemas</h4>
                {hitlistSchema && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Hitlist table</p>
                    <p className="text-xs text-muted-foreground">
                      Schema source: <strong>{hitlistSchema.schemaSource}</strong>
                      {hitlistSchema.schemaError && (
                        <span className="block mt-1 text-amber-600 dark:text-amber-400">
                          Airtable schema 403 or error — using static fallback: {hitlistSchema.schemaError.slice(0, 120)}
                          {hitlistSchema.schemaError.length > 120 ? "…" : ""}
                          {/403|INVALID_PERMISSIONS/i.test(hitlistSchema.schemaError) && (
                            <span className="block mt-1 text-xs">
                              Table creation may still succeed. If it fails, check token scope and workspace role — see <code className="bg-muted px-0.5 rounded">docs/CAMPAIGN-MANAGER-AIRTABLE-ENV.md</code>.
                            </span>
                          )}
                        </span>
                      )}
                    </p>
                    <div className="overflow-x-auto rounded border">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="text-left p-2 font-medium">Column name</th>
                            <th className="text-left p-2 font-medium">Data type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hitlistSchema.fields.map((f, i) => (
                            <tr key={i} className="border-t border-border">
                              <td className="p-2 font-mono">{f.name}</td>
                              <td className="p-2 text-muted-foreground">{f.type}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {autoLikeSchema && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Auto Like / Auto Comment table</p>
                    <p className="text-xs text-muted-foreground">
                      Schema source: <strong>{autoLikeSchema.schemaSource}</strong>
                      {autoLikeSchema.schemaError && (
                        <span className="block mt-1 text-amber-600 dark:text-amber-400">
                          Airtable schema 403 or error — using static fallback: {autoLikeSchema.schemaError.slice(0, 120)}
                          {autoLikeSchema.schemaError.length > 120 ? "…" : ""}
                          {/403|INVALID_PERMISSIONS/i.test(autoLikeSchema.schemaError) && (
                            <span className="block mt-1 text-xs">
                              Table creation may still succeed. If it fails, check token scope and workspace role — see <code className="bg-muted px-0.5 rounded">docs/CAMPAIGN-MANAGER-AIRTABLE-ENV.md</code>.
                            </span>
                          )}
                        </span>
                      )}
                    </p>
                    <div className="overflow-x-auto rounded border">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="text-left p-2 font-medium">Column name</th>
                            <th className="text-left p-2 font-medium">Data type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {autoLikeSchema.fields.map((f, i) => (
                            <tr key={i} className="border-t border-border">
                              <td className="p-2 font-mono">{f.name}</td>
                              <td className="p-2 text-muted-foreground">{f.type}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3 rounded-md border bg-muted/10 p-4 text-xs">
              <p className="font-semibold">Airtable button formulas (manual setup)</p>
              <p className="text-muted-foreground">
                Buttons with URLs cannot be fully configured via the API. After this run, open the Airtable base using the
                links above, edit the button fields directly in Airtable, and paste the formulas below into the button URL
                formula.
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-xs">Auto Like / Auto Comment button URL formula</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      void navigator.clipboard.writeText(getAutoLikeButtonFormula(supabaseProject))
                    }}
                  >
                    Copy formula
                  </Button>
                </div>
                <pre className="whitespace-pre-wrap break-words rounded bg-muted p-2 text-[11px] font-mono">
                  {getAutoLikeButtonFormula(supabaseProject)}
                </pre>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-xs">Hitlist URL formula (n8n button)</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      void navigator.clipboard.writeText(getHitlistButtonFormula(supabaseProject))
                    }}
                  >
                    Copy formula
                  </Button>
                </div>
                <pre className="whitespace-pre-wrap break-words rounded bg-muted p-2 text-[11px] font-mono">
                  {getHitlistButtonFormula(supabaseProject)}
                </pre>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-xs">Hitlist URL formula (in-app button)</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      void navigator.clipboard.writeText(getInAppHitlistButtonFormula())
                    }}
                  >
                    Copy formula
                  </Button>
                </div>
                <p className="text-muted-foreground">
                  Paste into a NEW button column (e.g. <code className="bg-muted px-0.5 rounded">In_App_Button</code>) in Airtable. Clicking it sends the request straight to this dashboard — no n8n hop — and the dashboard decides whether to invite, check acceptance, or send the next message based on the row’s current status.
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-200/90 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5">
                  If you copy this while running the app on <strong>localhost</strong>, the formula will point at localhost unless you set{" "}
                  <code className="bg-muted px-0.5 rounded">NEXT_PUBLIC_DASHBOARD_URL</code> to your live site (e.g.{" "}
                  <code className="bg-muted px-0.5 rounded">https://celr8.vercel.app</code>) in <code className="bg-muted px-0.5 rounded">.env</code> and rebuild. That value is preferred over the browser origin so Airtable buttons hit production.
                </p>
                <pre className="whitespace-pre-wrap break-words rounded bg-muted p-2 text-[11px] font-mono">
                  {getInAppHitlistButtonFormula()}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
