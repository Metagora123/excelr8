/**
 * HubSpot sync run history (hubspot_sync_runs table per project).
 * Powers the dashboard "HubSpot Sync" card and the daily cron audit trail.
 */

import { getSupabase, type SupabaseProject } from "./supabase"

export type SyncRunStatus = "success" | "partial" | "error"
export type SyncRunTrigger = "manual" | "scheduled"

export type SyncRunInput = {
  project: SupabaseProject
  trigger: SyncRunTrigger
  status: SyncRunStatus
  contacts_synced: number
  deals_synced: number
  associations: number
  dossier_notes: number
  post_notes: number
  errors: number
  duration_ms: number
  message?: string | null
}

export type SyncRunRow = {
  id: number
  created_at: string
  project: string
  trigger: string
  status: string
  contacts_synced: number
  deals_synced: number
  associations: number
  dossier_notes: number
  post_notes: number
  errors: number
  duration_ms: number
  message: string | null
}

/** Insert a sync run row. Never throws - recording a run must not break the sync itself. */
export async function recordSyncRun(input: SyncRunInput): Promise<void> {
  try {
    const supabase = getSupabase(input.project)
    const { error } = await supabase.from("hubspot_sync_runs").insert({
      project: input.project,
      trigger: input.trigger,
      status: input.status,
      contacts_synced: input.contacts_synced,
      deals_synced: input.deals_synced,
      associations: input.associations,
      dossier_notes: input.dossier_notes,
      post_notes: input.post_notes,
      errors: input.errors,
      duration_ms: input.duration_ms,
      message: input.message ?? null,
    })
    if (error) console.error("Failed to record hubspot_sync_run:", error.message)
  } catch (e) {
    console.error("Failed to record hubspot_sync_run:", e instanceof Error ? e.message : e)
  }
}

/** Latest sync run for a project, or null if none / table missing. */
export async function getLatestSyncRun(project: SupabaseProject): Promise<SyncRunRow | null> {
  try {
    const supabase = getSupabase(project)
    const { data, error } = await supabase
      .from("hubspot_sync_runs")
      .select("*")
      .eq("project", project)
      .order("created_at", { ascending: false })
      .limit(1)
    if (error) return null
    const row = (data ?? [])[0]
    return row ? (row as SyncRunRow) : null
  } catch {
    return null
  }
}
