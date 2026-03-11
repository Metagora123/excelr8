/**
 * Minimal data for HubSpot sync: dossiers and lead_posts grouped by lead.
 * Kept separate so sync route stays thin and easy to adjust.
 */

import { getSupabase, type SupabaseProject } from "./supabase"

export type LeadPostSummary = { count: number; firstPostUrl: string | null }

/** Returns lead_id -> { count, firstPostUrl } for syncing as notes. */
export async function getLeadPostsByLead(
  project: SupabaseProject = "sales2k25"
): Promise<Map<string, LeadPostSummary>> {
  const supabase = getSupabase(project)
  const { data, error } = await supabase
    .from("lead_posts")
    .select("lead_id, post_url")
    .order("created_at", { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as { lead_id: string; post_url: string | null }[]
  const map = new Map<string, LeadPostSummary>()
  for (const r of rows) {
    const id = r.lead_id
    if (!id) continue
    const cur = map.get(id)
    if (!cur) {
      map.set(id, { count: 1, firstPostUrl: r.post_url ?? null })
    } else {
      cur.count += 1
    }
  }
  return map
}
