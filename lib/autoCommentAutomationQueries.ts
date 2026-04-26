/**
 * Auto Comment automations: list and run. Reads Auto Like Airtable table,
 * generates 4 comments per post (OpenAI), writes comment_a/b/c/d back to Airtable.
 */

import { createClient, type SupabaseProject } from "@/lib/supabase"
import { getAirtableApiKey } from "@/lib/env"
import {
  listAirtableRecords,
  updateAirtableRecord,
  appendAirtableRecords,
  type AirtableRecord,
} from "@/lib/campaign-manager-inline"
import { generate4Comments } from "@/lib/autoCommentGenerator"
import {
  resolveIdentifierFromProfileUrl,
  fetchUnipileProfile,
  searchUnipilePeople,
  fetchUnipilePosts,
} from "@/lib/enrichment-engine"

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
    mode?: "comment_generation" | "monitoring"
    discovered_count?: number
    new_posts_added?: number
    skipped_existing?: number
    lead_id?: string
    monitored?: boolean
    new_posts_supabase?: number
    new_posts_airtable?: number
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

function safeText(v: unknown): string {
  return v == null ? "" : String(v).trim()
}

function toLinkedinPostId(post: { social_id?: string; repost_id?: string; is_repost?: boolean }): string | null {
  if (post.is_repost && post.repost_id) {
    return post.repost_id.startsWith("urn:li:") ? post.repost_id : `urn:li:activity:${post.repost_id}`
  }
  if (post.social_id) return post.social_id
  return null
}

/** Monitor campaign leads for new posts and append only unseen posts to Auto Like Airtable table. */
export async function runAutoCommentMonitoringAutomation(
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
    campaign_id: string
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
  const runEntry: AutoCommentRunLogEntry = {
    run_date: now.toISOString().slice(0, 10),
    started_at: now.toISOString(),
    status: "success",
    processed_count: 0,
    failed_count: 0,
    records: [],
  }

  try {
    const { data: links, error: linksError } = await supabase
      .from("lead_campaigns")
      .select("lead_id")
      .eq("campaign_id", auto.campaign_id)
    if (linksError) throw new Error(linksError.message)
    const leadIds = (links ?? [])
      .map((r) => String((r as { lead_id?: string }).lead_id ?? ""))
      .filter(Boolean)
    if (leadIds.length === 0) {
      runEntry.records?.push({
        mode: "monitoring",
        error: "No leads are linked to this campaign",
      })
    } else {
      const [existingPostsResp, leadsResp, existing] = await Promise.all([
        supabase
          .from("lead_posts")
          .select("lead_id, linkedin_post_id, post_url")
          .in("lead_id", leadIds),
        supabase
          .from("leads")
          .select("id, profile_url, full_name, company_name")
          .in("id", leadIds),
        listAirtableRecords(baseId, token, tableId),
      ])
      if (existingPostsResp.error) throw new Error(existingPostsResp.error.message)
      if (leadsResp.error) throw new Error(leadsResp.error.message)

      const leadsById = new Map<string, { profile_url?: string; full_name?: string; company_name?: string }>()
      for (const row of leadsResp.data ?? []) {
        const id = String((row as { id?: string }).id ?? "")
        if (!id) continue
        leadsById.set(id, {
          profile_url: safeText((row as { profile_url?: string }).profile_url),
          full_name: safeText((row as { full_name?: string }).full_name),
          company_name: safeText((row as { company_name?: string }).company_name),
        })
      }

      const existingSupabaseByLead = new Map<string, { ids: Set<string>; urls: Set<string> }>()
      for (const p of (existingPostsResp.data ?? []) as Array<{ lead_id?: string; linkedin_post_id?: string; post_url?: string }>) {
        const leadId = safeText(p.lead_id)
        if (!leadId) continue
        const entry = existingSupabaseByLead.get(leadId) ?? { ids: new Set<string>(), urls: new Set<string>() }
        const pid = safeText(p.linkedin_post_id)
        const purl = safeText(p.post_url)
        if (pid && pid !== "—") entry.ids.add(pid)
        if (purl && purl !== "—") entry.urls.add(purl)
        existingSupabaseByLead.set(leadId, entry)
      }

      const existingAirtableIds = new Set<string>()
      const existingAirtableUrls = new Set<string>()
      for (const rec of existing) {
        const pid = safeText(rec.fields.post_id)
        const purl = safeText(rec.fields.post_url)
        if (pid && pid !== "—") existingAirtableIds.add(pid)
        if (purl && purl !== "—") existingAirtableUrls.add(purl)
      }

      const discovered: Array<Record<string, unknown>> = []
      const supabaseUpserts: Array<Record<string, unknown>> = []
      const appendPayload: Array<Record<string, unknown>> = []
      let monitoredLeads = 0
      let newSupabaseTotal = 0
      let newAirtableTotal = 0
      let skippedExisting = 0

      for (const leadId of leadIds) {
        const lead = leadsById.get(leadId)
        const leadName = safeText(lead?.full_name) || leadId
        const profileUrl = safeText(lead?.profile_url)
        if (!profileUrl) {
          runEntry.records?.push({
            mode: "monitoring",
            lead_id: leadId,
            lead_name: leadName,
            monitored: false,
            error: "Missing profile_url",
          })
          continue
        }
        monitoredLeads += 1

        const { identifier, latestNameIdentifier } = resolveIdentifierFromProfileUrl(profileUrl)
        let providerId: string | null = null
        if (identifier) {
          const profile = await fetchUnipileProfile(identifier)
          if (profile?.provider_id) providerId = profile.provider_id
        }
        if (!providerId && latestNameIdentifier) {
          const results = await searchUnipilePeople(latestNameIdentifier)
          if (results.length > 0) {
            const profile = await fetchUnipileProfile(results[0].id)
            if (profile?.provider_id) providerId = profile.provider_id
          }
        }
        if (!providerId) {
          runEntry.records?.push({
            mode: "monitoring",
            lead_id: leadId,
            lead_name: leadName,
            monitored: true,
            error: "Unipile profile not found",
          })
          continue
        }

        const posts = await fetchUnipilePosts(providerId)
        const existingSupabase = existingSupabaseByLead.get(leadId) ?? { ids: new Set<string>(), urls: new Set<string>() }
        let leadNewSupabase = 0
        let leadNewAirtable = 0
        for (const post of posts) {
          const postId = safeText(toLinkedinPostId(post))
          const postUrl = safeText(post.share_url).split("?")[0]
          discovered.push({ lead_id: leadId, linkedin_post_id: postId, post_url: postUrl })

          const existsInSupabase =
            (postId && existingSupabase.ids.has(postId)) ||
            (postUrl && existingSupabase.urls.has(postUrl))
          if (!existsInSupabase) {
            const createdAt = safeText(post.parsed_datetime) || new Date().toISOString()
            supabaseUpserts.push({
              lead_id: leadId,
              lead_name: leadName,
              lead_company: safeText(lead?.company_name) || null,
              content: safeText(post.text) || null,
              post_url: postUrl || null,
              linkedin_post_id: postId || `urn:li:activity:${Date.now()}-${Math.random().toString(36).slice(2)}`,
              reactions: typeof post.reaction_counter === "number" ? post.reaction_counter : null,
              comments: typeof post.comment_counter === "number" ? post.comment_counter : null,
              is_repost: Boolean(post.is_repost),
              created_at: createdAt,
              updated_at: new Date().toISOString(),
            })
            leadNewSupabase += 1
            if (postId) existingSupabase.ids.add(postId)
            if (postUrl) existingSupabase.urls.add(postUrl)
          }

          const existsInAirtable =
            (postId && existingAirtableIds.has(postId)) ||
            (postUrl && existingAirtableUrls.has(postUrl))
          if (!existsInAirtable && !existsInSupabase) {
            appendPayload.push({
              lead_name: leadName,
              lead_profile: profileUrl || "—",
              tier: "None",
              score: 0,
              campaign_id: auto.campaign_id,
              post_content: safeText(post.text) || "—",
              "commentators(json)": "",
              "reactioners(json)": "",
              commentators_count: typeof post.comment_counter === "number" ? post.comment_counter : 0,
              reactioners_count: typeof post.reaction_counter === "number" ? post.reaction_counter : 0,
              comment_a: "",
              comment_b: "",
              comment_c: "",
              comment_d: "",
              Reaction: "None",
              Final_Comment: "None",
              Confirm_Column: "None",
              Select_Poster: "None",
              post_id: postId || "—",
              post_url: postUrl || "—",
              Custom_Comment_Data: "",
              title: "",
              location: "",
              expertise: safeText(lead?.company_name),
              Tags: "",
              Confirmation_status: "None",
            })
            leadNewAirtable += 1
            if (postId) existingAirtableIds.add(postId)
            if (postUrl) existingAirtableUrls.add(postUrl)
          } else if (existsInAirtable) {
            skippedExisting += 1
          }
        }
        existingSupabaseByLead.set(leadId, existingSupabase)
        newSupabaseTotal += leadNewSupabase
        newAirtableTotal += leadNewAirtable
        runEntry.records?.push({
          mode: "monitoring",
          lead_id: leadId,
          lead_name: leadName,
          monitored: true,
          discovered_count: posts.length,
          new_posts_supabase: leadNewSupabase,
          new_posts_airtable: leadNewAirtable,
          skipped_existing: Math.max(0, posts.length - leadNewAirtable),
        })
      }

      if (supabaseUpserts.length > 0) {
        for (const row of supabaseUpserts) {
          const { error } = await supabase.from("lead_posts").upsert(row, {
            onConflict: "linkedin_post_id",
            ignoreDuplicates: false,
          })
          if (error) throw new Error(`lead_posts upsert: ${error.message}`)
        }
      }
      if (appendPayload.length > 0) {
        await appendAirtableRecords(baseId, token, tableId, appendPayload)
      }
      runEntry.processed_count = appendPayload.length
      runEntry.records?.push({
        mode: "monitoring",
        lead_name: "SUMMARY",
        monitored: true,
        lead_id: "summary",
        new_posts_supabase: newSupabaseTotal,
        new_posts_airtable: newAirtableTotal,
        discovered_count: discovered.length,
        new_posts_added: appendPayload.length,
        skipped_existing: skippedExisting,
      })
      runEntry.records?.push({
        mode: "monitoring",
        lead_name: "LEADS_MONITORED",
        lead_id: "summary_leads",
        monitored: true,
        discovered_count: monitoredLeads,
      })
    }
  } catch (e) {
    runEntry.status = "error"
    runEntry.failed_count = (runEntry.failed_count ?? 0) + 1
    runEntry.records?.push({
      mode: "monitoring",
      error: e instanceof Error ? e.message : String(e),
    })
  }

  runEntry.finished_at = new Date().toISOString()
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
