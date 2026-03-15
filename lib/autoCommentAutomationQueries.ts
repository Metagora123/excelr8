/**
 * Auto Comment automations: list and run. Reads Auto Like Airtable table,
 * generates 4 comments per post (OpenAI), writes comment_a/b/c/d back to Airtable.
 */

import { createClient, type SupabaseProject } from "@/lib/supabase"
import { getAirtableApiKey } from "@/lib/env"
import {
  listAirtableRecords,
  updateAirtableRecord,
  type AirtableRecord,
} from "@/lib/campaign-manager-inline"
import { generate4Comments } from "@/lib/autoCommentGenerator"

export type AutoCommentAutomationRow = {
  id: string
  campaign_id: string
  airtable_base_id: string
  airtable_table_id: string
  is_active: boolean
  last_run_at: string | null
  last_run_status: string | null
  run_logs: AutoCommentRunLogEntry[]
  created_at: string
  updated_at: string
  campaign_name?: string | null
}

export type AutoCommentRunLogEntry = {
  run_date?: string
  started_at?: string
  finished_at?: string
  status?: string
  processed_count?: number
  failed_count?: number
  records?: Array<{
    record_id?: string
    lead_name?: string
    post_content_preview?: string
    error?: string
  }>
}

export async function getAutoCommentAutomations(
  project: SupabaseProject = "sales2k25"
): Promise<AutoCommentAutomationRow[]> {
  const supabase = createClient(project)
  const { data, error } = await supabase
    .from("in_app_auto_comment_automations")
    .select(
      `
      id,
      campaign_id,
      airtable_base_id,
      airtable_table_id,
      is_active,
      last_run_at,
      last_run_status,
      run_logs,
      created_at,
      updated_at,
      campaigns ( name )
    `
    )
    .order("created_at", { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as Array<
    Record<string, unknown> & { campaigns?: { name?: string | null } | null }
  >
  return rows.map((r) => {
    const { campaigns, ...rest } = r
    return {
      ...rest,
      campaign_name: campaigns?.name ?? null,
      run_logs: Array.isArray(r.run_logs) ? r.run_logs : [],
    } as AutoCommentAutomationRow
  })
}

function getField(fields: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = fields[k]
    if (v != null && String(v).trim() !== "") return String(v).trim()
  }
  return ""
}

/** Run one Auto Comment automation: fetch Airtable rows, generate 4 comments per row only when comment_a/b/c/d are not all present, write back. */
export async function runAutoCommentAutomation(
  project: SupabaseProject,
  automationId: string
): Promise<{ last_run_at: string; last_run_status: string }> {
  const supabase = createClient(project)
  const { data: automation, error: fetchError } = await supabase
    .from("in_app_auto_comment_automations")
    .select("id, campaign_id, airtable_base_id, airtable_table_id, run_logs")
    .eq("id", automationId)
    .single()
  if (fetchError || !automation) {
    throw new Error(fetchError?.message ?? "Automation not found")
  }

  const auto = automation as {
    airtable_base_id: string
    airtable_table_id: string
    run_logs?: unknown
  }
  const baseId = auto.airtable_base_id
  const tableId = auto.airtable_table_id
  const token = getAirtableApiKey()
  if (!baseId || !tableId || !token) {
    throw new Error("Missing airtable_base_id, airtable_table_id, or AIRTABLE_API_KEY")
  }

  const now = new Date()
  const runDate = now.toISOString().slice(0, 10)
  const runEntry: AutoCommentRunLogEntry = {
    run_date: runDate,
    started_at: now.toISOString(),
    processed_count: 0,
    failed_count: 0,
    records: [],
  }

  const records = await listAirtableRecords(baseId, token, tableId)
  // Only process rows where at least one of comment_a/b/c/d is missing (don't re-generate if all four exist)
  const toProcess = records.filter((r) => {
    const a = getField(r.fields, "comment_a")
    const b = getField(r.fields, "comment_b")
    const c = getField(r.fields, "comment_c")
    const d = getField(r.fields, "comment_d")
    return !a || !b || !c || !d
  })
  if (toProcess.length === 0) {
    runEntry.finished_at = new Date().toISOString()
    runEntry.status = "success"
    runEntry.records = []
  } else {
    for (const rec of toProcess) {
      const postContent = getField(rec.fields, "post_content")
      const leadName = getField(rec.fields, "lead_name")
      const result = await generate4Comments(postContent)
      if (result.ok) {
        try {
          await updateAirtableRecord(baseId, token, tableId, rec.id, {
            comment_a: result.comment_a,
            comment_b: result.comment_b,
            comment_c: result.comment_c,
            comment_d: result.comment_d,
          })
          runEntry.processed_count!++
          runEntry.records!.push({
            record_id: rec.id,
            lead_name: leadName || undefined,
            post_content_preview: postContent.slice(0, 80) + (postContent.length > 80 ? "…" : ""),
          })
        } catch (e) {
          runEntry.failed_count!++
          runEntry.records!.push({
            record_id: rec.id,
            lead_name: leadName || undefined,
            error: e instanceof Error ? e.message : String(e),
          })
        }
      } else {
        runEntry.failed_count!++
        runEntry.records!.push({
          record_id: rec.id,
          lead_name: leadName || undefined,
          error: result.error,
        })
      }
    }
    runEntry.finished_at = new Date().toISOString()
    runEntry.status =
      (runEntry.failed_count ?? 0) > 0
        ? (runEntry.processed_count ?? 0) > 0
          ? "partial"
          : "error"
        : "success"
  }

  const existingLogs = auto.run_logs
  const runLogs = Array.isArray(existingLogs) ? [...existingLogs, runEntry] : [runEntry]

  const { error: updateError } = await supabase
    .from("in_app_auto_comment_automations")
    .update({
      last_run_at: runEntry.finished_at,
      last_run_status: runEntry.status,
      run_logs: runLogs,
      updated_at: new Date().toISOString(),
    })
    .eq("id", automationId)

  if (updateError) throw new Error(updateError.message)

  return {
    last_run_at: runEntry.finished_at!,
    last_run_status: runEntry.status!,
  }
}
