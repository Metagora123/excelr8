import { createClient, type SupabaseProject } from "@/lib/supabase"
import { getAirtableApiKey, getUnipileAccountId } from "@/lib/env"
import {
  listAirtableRecords,
  updateAirtableRecord,
  fetchAirtableRecord,
  type AirtableRecord,
} from "@/lib/campaign-manager-inline"
import {
  resolveIdentifierFromProfileUrl,
  fetchUnipileProfileWithDetails,
  sendUnipileInviteWithDetails,
  sendUnipileMessageWithDetails,
} from "@/lib/enrichment-engine"
import { getLeadByProfileUrl, generateOutreachMessages } from "@/lib/outreachMessageGenerator"

/**
 * Campaign automations (in_app_campaign_automations) exist in both databases:
 * - Sales 2k25
 * - Prod 2k26
 * Same table schema in both; data is separate per project. Always pass project.
 *
 * The orchestrator (`runCampaignAutomation`) runs three passes in order:
 *   1. Invite       — picks up `status='fresh'` rows and sends connection invites.
 *   2. Acceptance   — picks up `status='invited'` rows and flips them to
 *                     `to_be_messaged` once Unipile reports degree=1.
 *   3. Messaging    — only when `messaging_runner='in_app'`. Walks accepted
 *                     leads and sends M1/M2/M3 by tempo, capped at the
 *                     per-automation daily quota.
 *
 * Transient errors (HTTP 408/425/429/5xx + network exceptions) never change
 * Airtable status; they log `step='retry_pending'` and the row is retried on
 * the next cron tick.
 */

// =============================================================================
// Public types + small-surface helpers
// =============================================================================

export type CampaignAutomationRow = {
  id: string
  campaign_id: string
  airtable_base_id: string
  airtable_table_id: string
  schedule_cron: string
  is_active: boolean
  default_unipile_sender_id: string | null
  total_invites_sent: number
  invites_sent_today: number
  total_to_be_messaged: number
  total_rejected: number
  last_run_at: string | null
  last_run_status: string | null
  run_logs: unknown[]
  created_at: string
  updated_at: string
  campaign_name?: string | null
  /** From campaigns table (legacy mirror; KPI uses total_invites_sent instead). */
  campaign_invites_sent?: number | null
  campaign_messages_sent?: number | null
  campaign_comments_made?: number | null
  campaign_likes_reactions?: number | null
  // Block 2 additions
  messaging_runner?: "off" | "in_app"
  messaging_quota_daily?: number
  messages_sent_today?: number
  messages_sent_today_date?: string | null
  airtable_button_token?: string | null
  legacy_migrated?: boolean | null
}

export async function getCampaignAutomations(
  project: SupabaseProject = "sales2k25"
): Promise<CampaignAutomationRow[]> {
  const supabase = createClient(project)
  const { data, error } = await supabase
    .from("in_app_campaign_automations")
    .select(
      `
      id,
      campaign_id,
      airtable_base_id,
      airtable_table_id,
      schedule_cron,
      is_active,
      default_unipile_sender_id,
      total_invites_sent,
      invites_sent_today,
      total_to_be_messaged,
      total_rejected,
      last_run_at,
      last_run_status,
      run_logs,
      messaging_runner,
      messaging_quota_daily,
      messages_sent_today,
      messages_sent_today_date,
      airtable_button_token,
      legacy_migrated,
      created_at,
      updated_at,
      campaigns ( name, invites_sent, messages_sent, comments_made, likes_reactions )
    `
    )
    .order("created_at", { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as Array<
    Record<string, unknown> & {
      campaigns?: {
        name?: string | null
        invites_sent?: number | null
        messages_sent?: number | null
        comments_made?: number | null
        likes_reactions?: number | null
      } | null
    }
  >
  return rows.map((r) => {
    const { campaigns, ...rest } = r
    return {
      ...rest,
      campaign_name: campaigns?.name ?? null,
      campaign_invites_sent: campaigns?.invites_sent ?? null,
      campaign_messages_sent: campaigns?.messages_sent ?? null,
      campaign_comments_made: campaigns?.comments_made ?? null,
      campaign_likes_reactions: campaigns?.likes_reactions ?? null,
      run_logs: Array.isArray(r.run_logs) ? r.run_logs : [],
    } as CampaignAutomationRow
  })
}

export async function deleteCampaignAutomation(
  project: SupabaseProject,
  automationId: string
): Promise<void> {
  const supabase = createClient(project)
  const { error } = await supabase
    .from("in_app_campaign_automations")
    .delete()
    .eq("id", automationId)
  if (error) throw error
}

export async function updateCampaignAutomationSchedule(
  project: SupabaseProject,
  automationId: string,
  scheduleCron: string
): Promise<void> {
  const supabase = createClient(project)
  const { error } = await supabase
    .from("in_app_campaign_automations")
    .update({
      schedule_cron: scheduleCron,
      updated_at: new Date().toISOString(),
    })
    .eq("id", automationId)
  if (error) throw error
}

/** Toggle in-app messaging on/off for this automation. */
export async function setMessagingRunner(
  project: SupabaseProject,
  automationId: string,
  runner: "off" | "in_app"
): Promise<void> {
  const supabase = createClient(project)
  const { error } = await supabase
    .from("in_app_campaign_automations")
    .update({ messaging_runner: runner, updated_at: new Date().toISOString() })
    .eq("id", automationId)
  if (error) throw error
}

/** Update the daily DM quota for this automation. Clamped to 0..200. */
export async function setMessagingQuota(
  project: SupabaseProject,
  automationId: string,
  quota: number
): Promise<void> {
  const supabase = createClient(project)
  const clamped = Math.max(0, Math.min(200, Math.floor(Number(quota) || 0)))
  const { error } = await supabase
    .from("in_app_campaign_automations")
    .update({ messaging_quota_daily: clamped, updated_at: new Date().toISOString() })
    .eq("id", automationId)
  if (error) throw error
}

// =============================================================================
// Module-level helpers
// =============================================================================

/**
 * Transient = retryable on our end (rate limit, network blip, server error).
 * NOT a failure: don't count it as `to_be_messaged` and don't change Airtable
 * status, so the lead is picked up again on the next run.
 */
export function isTransient(statusCode?: number | null): boolean {
  if (statusCode == null) return true
  if (statusCode === 408 || statusCode === 425 || statusCode === 429) return true
  if (statusCode >= 500 && statusCode < 600) return true
  return false
}

/**
 * Tempo parsing rules (per spec): trim, base-10 integer, must be in [0, 90],
 * else use the fallback. Defensive against negative numbers, decimals,
 * "now", "asap", "3 days", etc.
 */
export function parseTempoOrDefault(value: unknown, fallback: number): number {
  if (value == null) return fallback
  const trimmed = String(value).trim()
  if (trimmed === "") return fallback
  const match = trimmed.match(/-?\d+/)
  if (!match) return fallback
  const n = Number.parseInt(match[0], 10)
  if (!Number.isFinite(n) || n < 0 || n > 90) return fallback
  return n
}

/** Default tempo (days) before each message. Tempo_1 fires immediately on accept. */
export const DEFAULT_TEMPOS: Record<1 | 2 | 3, number> = { 1: 0, 2: 3, 3: 3 }

/** UTC date key ("YYYY-MM-DD"). Cheap shared definition of "today". */
function dayKeyUtc(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10)
}

/** Get the Unipile account id for this automation (Supabase override or env default). */
async function resolveUnipileAccountId(
  supabase: ReturnType<typeof createClient>,
  automation: { default_unipile_sender_id: string | null }
): Promise<string> {
  let unipileAccountId: string | null = null
  if (automation.default_unipile_sender_id) {
    const { data: ua } = await supabase
      .from("unipile_accounts")
      .select("account_id")
      .eq("id", automation.default_unipile_sender_id)
      .single()
    if (ua?.account_id) unipileAccountId = String(ua.account_id)
  }
  if (!unipileAccountId) unipileAccountId = getUnipileAccountId() || null
  if (!unipileAccountId) {
    throw new Error(
      "No Unipile sender: set default_unipile_sender_id on automation or UNIPILE_ACCOUNT_ID in env"
    )
  }
  return unipileAccountId
}

/** Read LinkedIn URL from an Airtable Hitlist row, tolerating legacy column names. */
function readLinkedinUrl(fields: Record<string, unknown>): string {
  return (
    (fields.LinkedIn != null && String(fields.LinkedIn).trim()) ||
    (fields.Linkedin_Profile != null && String(fields.Linkedin_Profile).trim()) ||
    (fields.URL != null && String(fields.URL).trim()) ||
    (fields.profile_url != null && String(fields.profile_url).trim()) ||
    ""
  )
}

/** Find the lead_campaigns row for (campaign_id, profile_url). Returns null if absent. */
async function findLeadCampaign(
  supabase: ReturnType<typeof createClient>,
  campaignId: string,
  profileUrl: string
): Promise<{
  leadId: string
  leadCampaign: {
    lead_id: string
    campaign_id: string
    message_status?: string | null
    acceptance_detected_at?: string | null
    message_1_sent_at?: string | null
    message_2_sent_at?: string | null
    message_3_sent_at?: string | null
  }
} | null> {
  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("profile_url", profileUrl)
    .maybeSingle()
  if (!lead?.id) return null
  const leadId = String(lead.id)
  const { data: lc } = await supabase
    .from("lead_campaigns")
    .select(
      "lead_id, campaign_id, message_status, acceptance_detected_at, message_1_sent_at, message_2_sent_at, message_3_sent_at"
    )
    .eq("lead_id", leadId)
    .eq("campaign_id", campaignId)
    .maybeSingle()
  if (!lc) return null
  return {
    leadId,
    leadCampaign: lc as {
      lead_id: string
      campaign_id: string
      message_status?: string | null
      acceptance_detected_at?: string | null
      message_1_sent_at?: string | null
      message_2_sent_at?: string | null
      message_3_sent_at?: string | null
    },
  }
}

/** Patch lead_campaigns for (campaign_id, lead_id). Silent on error (logged via runEntry caller). */
async function patchLeadCampaign(
  supabase: ReturnType<typeof createClient>,
  campaignId: string,
  leadId: string,
  patch: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from("lead_campaigns")
    .update(patch)
    .eq("campaign_id", campaignId)
    .eq("lead_id", leadId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// =============================================================================
// Run-log shapes
// =============================================================================

type LeadLog = {
  airtable_record_id?: string
  linkedin_url?: string
  pass?: "invite" | "acceptance" | "messaging" | "single_row"
  step?: string
  unipile_degree?: string
  decision?: string
  error?: string
  unipile_profile_status?: number
  unipile_profile_response?: string
  unipile_invite_status?: number
  unipile_invite_response?: string
  unipile_message_status?: number
  unipile_message_response?: string
  message_number?: 1 | 2 | 3
  message_preview?: string
  message_1?: string
  message_2?: string
  message_3?: string
  messages_generated?: boolean
  messages_error?: string
  tempo_days?: number
  baseline_at?: string | null
  transient?: boolean
  [k: string]: unknown
}

type RunEntry = {
  run_date: string
  started_at: string
  finished_at: string
  status: "success" | "partial" | "error"
  invited_count: number
  to_be_messaged_count: number
  rejected_count: number
  retry_pending_count: number
  accepted_count: number
  messages_sent_count: number
  messaging_failed_count: number
  legacy_migrated_count: number
  leads: LeadLog[]
}

function emptyRunEntry(): RunEntry {
  const now = new Date()
  return {
    run_date: dayKeyUtc(now),
    started_at: now.toISOString(),
    finished_at: "",
    status: "success",
    invited_count: 0,
    to_be_messaged_count: 0,
    rejected_count: 0,
    retry_pending_count: 0,
    accepted_count: 0,
    messages_sent_count: 0,
    messaging_failed_count: 0,
    legacy_migrated_count: 0,
    leads: [],
  }
}

// =============================================================================
// Pass 1 — Invite (status=fresh → status=invited or invite_failed)
// =============================================================================

type PassCtx = {
  project: SupabaseProject
  supabase: ReturnType<typeof createClient>
  automation: {
    id: string
    campaign_id: string
    airtable_base_id: string
    airtable_table_id: string
    default_unipile_sender_id: string | null
    messaging_runner: "off" | "in_app"
    messaging_quota_daily: number
    messages_sent_today: number
    messages_sent_today_date: string | null
    legacy_migrated: boolean
  }
  unipileAccountId: string
  airtableToken: string
  runEntry: RunEntry
}

async function runInvitePass(ctx: PassCtx, options: { recordIds?: string[] } = {}): Promise<void> {
  const { supabase, automation, unipileAccountId, airtableToken, runEntry, project } = ctx
  const baseId = automation.airtable_base_id
  const tableId = automation.airtable_table_id

  const records = options.recordIds?.length
    ? await Promise.all(
        options.recordIds.map((id) => fetchAirtableRecord(baseId, airtableToken, tableId, id))
      )
    : await listAirtableRecords(baseId, airtableToken, tableId, {
        filterByFormula: "{status}='fresh'",
        pageSize: 50,
      })

  for (const rec of records as AirtableRecord[]) {
    const fields = rec.fields ?? {}
    const linkedinUrl = readLinkedinUrl(fields)
    const leadLog: LeadLog = {
      airtable_record_id: rec.id,
      linkedin_url: linkedinUrl || undefined,
      pass: "invite",
      step: "fetch",
    }

    if (!linkedinUrl.trim()) {
      leadLog.step = "skip"
      leadLog.decision = "no_linkedin_url"
      runEntry.rejected_count += 1
      runEntry.leads.push(leadLog)
      continue
    }

    // Generate Message_1/2/3 if missing — same logic as before, so the messaging
    // pass has bodies to send when leads accept later.
    const existingMessage1 =
      (fields.Message_1 ?? fields["Message_1"]) != null &&
      String(fields.Message_1 ?? fields["Message_1"]).trim() !== ""
    if (!existingMessage1) {
      try {
        const lead = await getLeadByProfileUrl(project, linkedinUrl)
        const gen = await generateOutreachMessages({
          project,
          airtableFields: fields,
          leadId: lead?.id ?? undefined,
        })
        if (gen.ok) {
          await updateAirtableRecord(baseId, airtableToken, tableId, rec.id, {
            Message_1: gen.message_1,
            Message_2: gen.message_2,
            Message_3: gen.message_3,
          })
          leadLog.messages_generated = true
          leadLog.message_1 = gen.message_1
          leadLog.message_2 = gen.message_2
          leadLog.message_3 = gen.message_3
        } else {
          leadLog.messages_generated = false
          leadLog.messages_error = gen.error
        }
      } catch (e) {
        leadLog.messages_generated = false
        leadLog.messages_error = e instanceof Error ? e.message : String(e)
      }
    }

    const { identifier } = resolveIdentifierFromProfileUrl(linkedinUrl)
    if (!identifier) {
      leadLog.step = "skip"
      leadLog.decision = "invalid_linkedin_url"
      runEntry.rejected_count += 1
      runEntry.leads.push(leadLog)
      continue
    }

    let profile: { provider_id?: string } | null = null
    try {
      const details = await fetchUnipileProfileWithDetails(identifier)
      profile = details.profile
      leadLog.unipile_profile_status = details.statusCode
      leadLog.unipile_profile_response = details.responseSnippet
      if (details.degree != null) leadLog.unipile_degree = details.degree
      if (!profile && details.statusCode !== 200) {
        if (isTransient(details.statusCode)) {
          leadLog.step = "retry_pending"
          leadLog.transient = true
          leadLog.error = `${details.statusCode}: ${details.responseSnippet.slice(0, 200)}`
          runEntry.retry_pending_count += 1
          runEntry.leads.push(leadLog)
          continue
        }
        // Permanent profile error → terminal invite_failed (new lifecycle).
        leadLog.step = "unipile_profile_error"
        leadLog.error = `${details.statusCode}: ${details.responseSnippet.slice(0, 200)}`
        runEntry.rejected_count += 1
        runEntry.leads.push(leadLog)
        try {
          await updateAirtableRecord(baseId, airtableToken, tableId, rec.id, {
            status: "invite_failed",
          })
        } catch {
          // non-fatal
        }
        await mirrorMessageStatus(ctx, linkedinUrl, "invite_failed")
        continue
      }
    } catch (e) {
      leadLog.step = "retry_pending"
      leadLog.transient = true
      leadLog.error = e instanceof Error ? e.message : String(e)
      runEntry.retry_pending_count += 1
      runEntry.leads.push(leadLog)
      continue
    }

    if (!profile?.provider_id) {
      leadLog.step = "profile_not_found"
      leadLog.decision = "no_provider_id"
      if (leadLog.unipile_degree == null) leadLog.unipile_degree = "—"
      runEntry.rejected_count += 1
      runEntry.leads.push(leadLog)
      try {
        await updateAirtableRecord(baseId, airtableToken, tableId, rec.id, {
          status: "invite_failed",
        })
      } catch {
        // non-fatal
      }
      await mirrorMessageStatus(ctx, linkedinUrl, "invite_failed")
      continue
    }

    if (leadLog.unipile_degree == null) leadLog.unipile_degree = "resolved"
    const inviteResult = await sendUnipileInviteWithDetails(unipileAccountId, profile.provider_id)
    leadLog.unipile_invite_status = inviteResult.statusCode
    leadLog.unipile_invite_response = inviteResult.responseSnippet
    if (!inviteResult.ok) {
      if (isTransient(inviteResult.statusCode)) {
        leadLog.step = "retry_pending"
        leadLog.transient = true
        leadLog.error = inviteResult.error
        runEntry.retry_pending_count += 1
        runEntry.leads.push(leadLog)
        continue
      }
      leadLog.step = "invite_failed"
      leadLog.decision = "invite_failed"
      leadLog.error = inviteResult.error
      runEntry.rejected_count += 1
      runEntry.leads.push(leadLog)
      try {
        await updateAirtableRecord(baseId, airtableToken, tableId, rec.id, {
          status: "invite_failed",
        })
      } catch {
        // non-fatal
      }
      await mirrorMessageStatus(ctx, linkedinUrl, "invite_failed")
      continue
    }

    leadLog.step = "invited"
    leadLog.decision = "invited"
    runEntry.invited_count += 1
    runEntry.leads.push(leadLog)
    try {
      await updateAirtableRecord(baseId, airtableToken, tableId, rec.id, { status: "invited" })
    } catch (e) {
      leadLog.error = (e instanceof Error ? e.message : String(e)) + " (Airtable update failed)"
    }
    await mirrorMessageStatus(ctx, linkedinUrl, "invited")
  }
}

/** Best-effort mirror of Airtable status → lead_campaigns.message_status. Never throws. */
async function mirrorMessageStatus(
  ctx: PassCtx,
  linkedinUrl: string,
  status: string,
  extraPatch: Record<string, unknown> = {}
): Promise<void> {
  if (!linkedinUrl) return
  try {
    const match = await findLeadCampaign(ctx.supabase, ctx.automation.campaign_id, linkedinUrl)
    if (!match) return
    await patchLeadCampaign(ctx.supabase, ctx.automation.campaign_id, match.leadId, {
      message_status: status,
      ...extraPatch,
    })
  } catch {
    // non-fatal — run_logs is the source of truth, lead_campaigns is just a mirror.
  }
}

// =============================================================================
// Pass 2 — Acceptance (status=invited → status=to_be_messaged when degree=1)
// =============================================================================

async function runAcceptancePass(ctx: PassCtx, options: { recordIds?: string[] } = {}): Promise<void> {
  const { supabase, automation, airtableToken, runEntry } = ctx
  const baseId = automation.airtable_base_id
  const tableId = automation.airtable_table_id

  const records = options.recordIds?.length
    ? await Promise.all(
        options.recordIds.map((id) => fetchAirtableRecord(baseId, airtableToken, tableId, id))
      )
    : await listAirtableRecords(baseId, airtableToken, tableId, {
        filterByFormula: "{status}='invited'",
        pageSize: 50,
      })

  for (const rec of records as AirtableRecord[]) {
    const fields = rec.fields ?? {}
    const linkedinUrl = readLinkedinUrl(fields)
    const leadLog: LeadLog = {
      airtable_record_id: rec.id,
      linkedin_url: linkedinUrl || undefined,
      pass: "acceptance",
      step: "check",
    }
    if (!linkedinUrl.trim()) {
      leadLog.step = "skip"
      leadLog.decision = "no_linkedin_url"
      runEntry.leads.push(leadLog)
      continue
    }
    const { identifier } = resolveIdentifierFromProfileUrl(linkedinUrl)
    if (!identifier) {
      leadLog.step = "skip"
      leadLog.decision = "invalid_linkedin_url"
      runEntry.leads.push(leadLog)
      continue
    }
    try {
      const details = await fetchUnipileProfileWithDetails(identifier)
      leadLog.unipile_profile_status = details.statusCode
      leadLog.unipile_profile_response = details.responseSnippet
      if (details.degree != null) leadLog.unipile_degree = details.degree
      if (!details.profile && details.statusCode !== 200) {
        if (isTransient(details.statusCode)) {
          leadLog.step = "retry_pending"
          leadLog.transient = true
          leadLog.error = `${details.statusCode}: ${details.responseSnippet.slice(0, 200)}`
          runEntry.retry_pending_count += 1
          runEntry.leads.push(leadLog)
          continue
        }
        leadLog.step = "unipile_profile_error"
        leadLog.error = `${details.statusCode}: ${details.responseSnippet.slice(0, 200)}`
        runEntry.leads.push(leadLog)
        continue
      }

      const degree = (details.degree ?? "").trim()
      const accepted = degree === "1" || degree.toLowerCase() === "1st"
      if (!accepted) {
        leadLog.step = "still_invited"
        leadLog.decision = `degree=${degree || "—"}`
        runEntry.leads.push(leadLog)
        continue
      }

      // Accepted — flip Airtable + lead_campaigns + log step=accepted.
      const now = new Date().toISOString()
      try {
        await updateAirtableRecord(ctx.automation.airtable_base_id, airtableToken, tableId, rec.id, {
          status: "to_be_messaged",
        })
      } catch (e) {
        leadLog.error = (e instanceof Error ? e.message : String(e)) + " (Airtable update failed)"
      }
      const match = await findLeadCampaign(supabase, ctx.automation.campaign_id, linkedinUrl)
      if (match) {
        await patchLeadCampaign(supabase, ctx.automation.campaign_id, match.leadId, {
          message_status: "to_be_messaged",
          acceptance_detected_at: now,
        })
      }
      leadLog.step = "accepted"
      leadLog.decision = "to_be_messaged"
      runEntry.accepted_count += 1
      runEntry.to_be_messaged_count += 1
      runEntry.leads.push(leadLog)
    } catch (e) {
      leadLog.step = "retry_pending"
      leadLog.transient = true
      leadLog.error = e instanceof Error ? e.message : String(e)
      runEntry.retry_pending_count += 1
      runEntry.leads.push(leadLog)
    }
  }
}

// =============================================================================
// Pass 3 — Messaging (to_be_messaged → message_1_sent → … → messaged)
// =============================================================================

/** What message to send next, given the current Airtable status. */
function nextMessageForStatus(status: string): {
  number: 1 | 2 | 3
  newStatus: "message_1_sent" | "message_2_sent" | "messaged"
  baselineField: "acceptance_detected_at" | "message_1_sent_at" | "message_2_sent_at"
  sentAtField: "message_1_sent_at" | "message_2_sent_at" | "message_3_sent_at"
  tempoFieldName: "Tempo_1" | "Tempo_2" | "Tempo_3"
  messageFieldName: "Message_1" | "Message_2" | "Message_3"
} | null {
  if (status === "to_be_messaged") {
    return {
      number: 1,
      newStatus: "message_1_sent",
      baselineField: "acceptance_detected_at",
      sentAtField: "message_1_sent_at",
      tempoFieldName: "Tempo_1",
      messageFieldName: "Message_1",
    }
  }
  if (status === "message_1_sent") {
    return {
      number: 2,
      newStatus: "message_2_sent",
      baselineField: "message_1_sent_at",
      sentAtField: "message_2_sent_at",
      tempoFieldName: "Tempo_2",
      messageFieldName: "Message_2",
    }
  }
  if (status === "message_2_sent") {
    return {
      number: 3,
      newStatus: "messaged",
      baselineField: "message_2_sent_at",
      sentAtField: "message_3_sent_at",
      tempoFieldName: "Tempo_3",
      messageFieldName: "Message_3",
    }
  }
  return null
}

async function runMessagingPass(
  ctx: PassCtx,
  options: { recordIds?: string[]; force?: boolean; onProgress?: (info: { processed: number; total: number; current?: string }) => void } = {}
): Promise<{ messagesSentToday: number; messagesSentTodayDate: string }> {
  const { supabase, automation, unipileAccountId, airtableToken, runEntry } = ctx
  const today = dayKeyUtc()

  // Reset counter if the recorded day has flipped (UTC midnight rollover).
  let messagesSentToday =
    automation.messages_sent_today_date === today ? automation.messages_sent_today : 0

  if (automation.messaging_runner !== "in_app" && !options.force) {
    return { messagesSentToday, messagesSentTodayDate: today }
  }

  const baseId = automation.airtable_base_id
  const tableId = automation.airtable_table_id

  const records = options.recordIds?.length
    ? await Promise.all(
        options.recordIds.map((id) => fetchAirtableRecord(baseId, airtableToken, tableId, id))
      )
    : await listAirtableRecords(baseId, airtableToken, tableId, {
        filterByFormula:
          "OR({status}='to_be_messaged',{status}='message_1_sent',{status}='message_2_sent')",
        pageSize: 100,
      })

  const total = records.length
  let processed = 0
  options.onProgress?.({ processed, total })

  for (const rec of records as AirtableRecord[]) {
    if (messagesSentToday >= automation.messaging_quota_daily && !options.force) {
      runEntry.leads.push({
        airtable_record_id: rec.id,
        pass: "messaging",
        step: "quota_reached",
        decision: `daily_quota=${automation.messaging_quota_daily}`,
      })
      break
    }

    const fields = rec.fields ?? {}
    const status = String(fields.status ?? "").trim()
    const next = nextMessageForStatus(status)
    const linkedinUrl = readLinkedinUrl(fields)
    const leadLog: LeadLog = {
      airtable_record_id: rec.id,
      linkedin_url: linkedinUrl || undefined,
      pass: "messaging",
      step: "check",
    }
    if (!next) {
      leadLog.step = "skip"
      leadLog.decision = `unexpected_status=${status}`
      runEntry.leads.push(leadLog)
      processed += 1
      options.onProgress?.({ processed, total, current: linkedinUrl })
      continue
    }
    leadLog.message_number = next.number

    if (!linkedinUrl.trim()) {
      leadLog.step = "skip"
      leadLog.decision = "no_linkedin_url"
      runEntry.leads.push(leadLog)
      processed += 1
      options.onProgress?.({ processed, total })
      continue
    }

    // Resolve lead_campaigns row for the baseline timestamp.
    const match = await findLeadCampaign(supabase, ctx.automation.campaign_id, linkedinUrl)
    if (!match) {
      leadLog.step = "skip"
      leadLog.decision = "no_lead_campaigns_row"
      runEntry.leads.push(leadLog)
      processed += 1
      options.onProgress?.({ processed, total, current: linkedinUrl })
      continue
    }

    // Baseline: when we started counting time for this tempo step.
    // For `to_be_messaged` with no acceptance_detected_at (e.g. row pre-dates
    // this PR), we backfill it to NOW so M1 is scheduled cleanly going forward.
    const nowIso = new Date().toISOString()
    let baselineIso = match.leadCampaign[next.baselineField] as string | null | undefined
    if (!baselineIso) {
      baselineIso = nowIso
      await patchLeadCampaign(supabase, ctx.automation.campaign_id, match.leadId, {
        [next.baselineField]: nowIso,
      })
    }
    leadLog.baseline_at = baselineIso

    // Parse tempo. If blank/invalid, write the default back to Airtable so the
    // user sees what we used.
    const rawTempo = fields[next.tempoFieldName]
    const tempoDays = parseTempoOrDefault(rawTempo, DEFAULT_TEMPOS[next.number])
    leadLog.tempo_days = tempoDays
    const rawTempoStr = rawTempo == null ? "" : String(rawTempo).trim()
    const tempoWasBlank = rawTempoStr === ""
    const tempoWasInvalid =
      !tempoWasBlank && parseTempoOrDefault(rawTempo, -1) === -1
        ? true
        : !tempoWasBlank && String(rawTempo).trim() !== String(tempoDays)
    if (tempoWasBlank || tempoWasInvalid) {
      try {
        await updateAirtableRecord(baseId, airtableToken, tableId, rec.id, {
          [next.tempoFieldName]: String(tempoDays),
        })
      } catch {
        // non-fatal
      }
    }

    // Is the message due yet?
    const baselineMs = new Date(baselineIso).getTime()
    const dueAtMs = baselineMs + tempoDays * 24 * 60 * 60 * 1000
    if (!options.force && Date.now() < dueAtMs) {
      leadLog.step = "not_due"
      leadLog.decision = `due_at=${new Date(dueAtMs).toISOString()}`
      runEntry.leads.push(leadLog)
      processed += 1
      options.onProgress?.({ processed, total, current: linkedinUrl })
      continue
    }

    // Confirm degree still = 1 (lead might have un-accepted between passes).
    const { identifier } = resolveIdentifierFromProfileUrl(linkedinUrl)
    if (!identifier) {
      leadLog.step = "skip"
      leadLog.decision = "invalid_linkedin_url"
      runEntry.leads.push(leadLog)
      processed += 1
      options.onProgress?.({ processed, total, current: linkedinUrl })
      continue
    }
    let providerId: string | null = null
    try {
      const details = await fetchUnipileProfileWithDetails(identifier)
      leadLog.unipile_profile_status = details.statusCode
      leadLog.unipile_profile_response = details.responseSnippet
      if (details.degree != null) leadLog.unipile_degree = details.degree
      if (!details.profile && isTransient(details.statusCode)) {
        leadLog.step = "retry_pending"
        leadLog.transient = true
        leadLog.error = `${details.statusCode}: ${details.responseSnippet.slice(0, 200)}`
        runEntry.retry_pending_count += 1
        runEntry.leads.push(leadLog)
        processed += 1
        options.onProgress?.({ processed, total, current: linkedinUrl })
        continue
      }
      if (!details.profile?.provider_id) {
        leadLog.step = "messaging_failed"
        leadLog.error = "Lead profile unreachable (provider_id missing)"
        runEntry.messaging_failed_count += 1
        runEntry.leads.push(leadLog)
        try {
          await updateAirtableRecord(baseId, airtableToken, tableId, rec.id, {
            status: "messaging_failed",
          })
        } catch {
          // non-fatal
        }
        await patchLeadCampaign(supabase, ctx.automation.campaign_id, match.leadId, {
          message_status: "messaging_failed",
        })
        processed += 1
        options.onProgress?.({ processed, total, current: linkedinUrl })
        continue
      }
      const degree = (details.degree ?? "").trim()
      if (degree && degree !== "1" && degree.toLowerCase() !== "1st") {
        leadLog.step = "messaging_failed"
        leadLog.error = `Lead no longer 1st-degree (degree=${degree})`
        runEntry.messaging_failed_count += 1
        runEntry.leads.push(leadLog)
        try {
          await updateAirtableRecord(baseId, airtableToken, tableId, rec.id, {
            status: "messaging_failed",
          })
        } catch {
          // non-fatal
        }
        await patchLeadCampaign(supabase, ctx.automation.campaign_id, match.leadId, {
          message_status: "messaging_failed",
        })
        processed += 1
        options.onProgress?.({ processed, total, current: linkedinUrl })
        continue
      }
      providerId = details.profile.provider_id ?? null
    } catch (e) {
      leadLog.step = "retry_pending"
      leadLog.transient = true
      leadLog.error = e instanceof Error ? e.message : String(e)
      runEntry.retry_pending_count += 1
      runEntry.leads.push(leadLog)
      processed += 1
      options.onProgress?.({ processed, total, current: linkedinUrl })
      continue
    }

    const messageText = String(fields[next.messageFieldName] ?? "").trim()
    if (!messageText || !providerId) {
      leadLog.step = "skip"
      leadLog.decision = !messageText ? "empty_message_body" : "missing_provider_id"
      runEntry.leads.push(leadLog)
      processed += 1
      options.onProgress?.({ processed, total, current: linkedinUrl })
      continue
    }
    leadLog.message_preview = messageText.slice(0, 200)

    // Send the DM.
    const sendResult = await sendUnipileMessageWithDetails(unipileAccountId, providerId, messageText)
    leadLog.unipile_message_status = sendResult.statusCode
    leadLog.unipile_message_response = sendResult.responseSnippet
    if (!sendResult.ok) {
      if (isTransient(sendResult.statusCode)) {
        leadLog.step = "retry_pending"
        leadLog.transient = true
        leadLog.error = sendResult.error
        runEntry.retry_pending_count += 1
        runEntry.leads.push(leadLog)
        processed += 1
        options.onProgress?.({ processed, total, current: linkedinUrl })
        continue
      }
      leadLog.step = "messaging_failed"
      leadLog.error = sendResult.error
      runEntry.messaging_failed_count += 1
      runEntry.leads.push(leadLog)
      try {
        await updateAirtableRecord(baseId, airtableToken, tableId, rec.id, {
          status: "messaging_failed",
        })
      } catch {
        // non-fatal
      }
      await patchLeadCampaign(supabase, ctx.automation.campaign_id, match.leadId, {
        message_status: "messaging_failed",
      })
      processed += 1
      options.onProgress?.({ processed, total, current: linkedinUrl })
      continue
    }

    const sentAtIso = new Date().toISOString()
    leadLog.step = `message_${next.number}_sent`
    leadLog.decision = next.newStatus
    runEntry.messages_sent_count += 1
    messagesSentToday += 1
    runEntry.leads.push(leadLog)
    try {
      await updateAirtableRecord(baseId, airtableToken, tableId, rec.id, { status: next.newStatus })
    } catch (e) {
      leadLog.error = (e instanceof Error ? e.message : String(e)) + " (Airtable update failed)"
    }
    await patchLeadCampaign(supabase, ctx.automation.campaign_id, match.leadId, {
      message_status: next.newStatus,
      [next.sentAtField]: sentAtIso,
    })
    processed += 1
    options.onProgress?.({ processed, total, current: linkedinUrl })
  }

  return { messagesSentToday, messagesSentTodayDate: today }
}

// =============================================================================
// Legacy migration — old to_be_messaged rows mean "invite failed" in the old
// model. We only flip to `invite_failed` if run_logs prove that origin.
// =============================================================================

async function migrateLegacyToBeMessaged(ctx: PassCtx): Promise<void> {
  if (ctx.automation.legacy_migrated) return
  const { supabase, automation, airtableToken, runEntry } = ctx
  const baseId = automation.airtable_base_id
  const tableId = automation.airtable_table_id

  // Pull historical run_logs to know which records previously failed invite.
  const { data: aRow } = await supabase
    .from("in_app_campaign_automations")
    .select("run_logs")
    .eq("id", automation.id)
    .single()
  const historicalLogs = Array.isArray(aRow?.run_logs)
    ? (aRow!.run_logs as Array<Record<string, unknown>>)
    : []
  const previouslyFailedRecordIds = new Set<string>()
  const failureSteps = new Set(["invite_failed", "profile_not_found", "unipile_profile_error"])
  for (const entry of historicalLogs) {
    const leads = Array.isArray(entry.leads) ? (entry.leads as Array<Record<string, unknown>>) : []
    for (const lead of leads) {
      const recId = typeof lead.airtable_record_id === "string" ? lead.airtable_record_id : null
      const step = typeof lead.step === "string" ? lead.step : null
      if (recId && step && failureSteps.has(step)) previouslyFailedRecordIds.add(recId)
    }
  }

  let records: AirtableRecord[] = []
  try {
    records = await listAirtableRecords(baseId, airtableToken, tableId, {
      filterByFormula: "{status}='to_be_messaged'",
      pageSize: 100,
    })
  } catch (e) {
    runEntry.leads.push({
      pass: "invite",
      step: "legacy_migration",
      error: e instanceof Error ? e.message : String(e),
      decision: "list_failed",
    })
    return
  }

  let flipped = 0
  let untouched = 0
  for (const rec of records) {
    if (!previouslyFailedRecordIds.has(rec.id)) {
      untouched += 1
      continue
    }
    try {
      await updateAirtableRecord(baseId, airtableToken, tableId, rec.id, {
        status: "invite_failed",
      })
      flipped += 1
      runEntry.leads.push({
        airtable_record_id: rec.id,
        pass: "invite",
        step: "legacy_migration",
        decision: "to_be_messaged→invite_failed",
      })
      const url = readLinkedinUrl(rec.fields ?? {})
      if (url) await mirrorMessageStatus(ctx, url, "invite_failed")
    } catch (e) {
      runEntry.leads.push({
        airtable_record_id: rec.id,
        pass: "invite",
        step: "legacy_migration",
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }
  runEntry.legacy_migrated_count = flipped
  runEntry.leads.push({
    pass: "invite",
    step: "legacy_migration",
    decision: "summary",
    flipped,
    untouched,
  } as LeadLog)

  // Flip the flag — single shot, never re-run.
  await supabase
    .from("in_app_campaign_automations")
    .update({ legacy_migrated: true, updated_at: new Date().toISOString() })
    .eq("id", automation.id)
}

// =============================================================================
// Public orchestrators
// =============================================================================

async function loadAutomation(
  project: SupabaseProject,
  automationId: string
): Promise<PassCtx["automation"]> {
  const supabase = createClient(project)
  const { data, error } = await supabase
    .from("in_app_campaign_automations")
    .select(
      "id, campaign_id, airtable_base_id, airtable_table_id, default_unipile_sender_id, messaging_runner, messaging_quota_daily, messages_sent_today, messages_sent_today_date, legacy_migrated"
    )
    .eq("id", automationId)
    .single()
  if (error || !data) throw error ?? new Error("Automation not found")
  return {
    id: String(data.id),
    campaign_id: String(data.campaign_id),
    airtable_base_id: String(data.airtable_base_id),
    airtable_table_id: String(data.airtable_table_id),
    default_unipile_sender_id: data.default_unipile_sender_id ?? null,
    messaging_runner: (data.messaging_runner === "in_app" ? "in_app" : "off"),
    messaging_quota_daily: Number(data.messaging_quota_daily ?? 30),
    messages_sent_today: Number(data.messages_sent_today ?? 0),
    messages_sent_today_date: data.messages_sent_today_date ?? null,
    legacy_migrated: Boolean(data.legacy_migrated),
  }
}

async function loadCtx(project: SupabaseProject, automationId: string): Promise<PassCtx> {
  const supabase = createClient(project)
  const automation = await loadAutomation(project, automationId)
  const airtableToken = getAirtableApiKey()
  if (!airtableToken) throw new Error("AIRTABLE_API_KEY not set")
  if (!automation.airtable_base_id || !automation.airtable_table_id) {
    throw new Error("Automation missing airtable_base_id or airtable_table_id")
  }
  const unipileAccountId = await resolveUnipileAccountId(supabase, {
    default_unipile_sender_id: automation.default_unipile_sender_id,
  })
  return {
    project,
    supabase,
    automation,
    unipileAccountId,
    airtableToken,
    runEntry: emptyRunEntry(),
  }
}

async function persistRunEntry(
  ctx: PassCtx,
  finalCounters: { messagesSentToday: number; messagesSentTodayDate: string } | null
): Promise<void> {
  const { supabase, automation, runEntry } = ctx
  runEntry.finished_at = new Date().toISOString()
  if (runEntry.status === "success" && runEntry.leads.some((l) => l.error)) {
    runEntry.status = "partial"
  }

  // Append to run_logs (atomic read-modify-write is fine — daily cron only).
  const { data: aRow } = await supabase
    .from("in_app_campaign_automations")
    .select(
      "run_logs, total_invites_sent, invites_sent_today, last_run_at, total_to_be_messaged, total_rejected"
    )
    .eq("id", automation.id)
    .single()
  const existingLogs = Array.isArray(aRow?.run_logs) ? (aRow!.run_logs as unknown[]) : []
  const runLogs = [...existingLogs, runEntry]

  const todayKey = dayKeyUtc()
  const wasToday = (aRow?.last_run_at ?? "").slice(0, 10) === todayKey
  const prevInvitesToday = wasToday ? Number(aRow?.invites_sent_today ?? 0) : 0

  const updates: Record<string, unknown> = {
    last_run_at: runEntry.finished_at,
    last_run_status: runEntry.status,
    run_logs: runLogs,
    total_invites_sent: Number(aRow?.total_invites_sent ?? 0) + runEntry.invited_count,
    invites_sent_today: prevInvitesToday + runEntry.invited_count,
    total_to_be_messaged: Number(aRow?.total_to_be_messaged ?? 0) + runEntry.to_be_messaged_count,
    total_rejected: Number(aRow?.total_rejected ?? 0) + runEntry.rejected_count,
    updated_at: new Date().toISOString(),
  }
  if (finalCounters) {
    updates.messages_sent_today = finalCounters.messagesSentToday
    updates.messages_sent_today_date = finalCounters.messagesSentTodayDate
  }
  const { error } = await supabase
    .from("in_app_campaign_automations")
    .update(updates)
    .eq("id", automation.id)
  if (error) throw error

  // Mirror invited_count → campaigns.invites_sent for legacy consumers
  // (n8n nodes, external dashboards). KPI page reads only total_invites_sent,
  // but this keeps the old surfaces in sync.
  if (runEntry.invited_count > 0 && automation.campaign_id) {
    const { data: camp } = await supabase
      .from("campaigns")
      .select("invites_sent")
      .eq("id", automation.campaign_id)
      .single()
    const currentInvites = Number((camp?.invites_sent ?? 0) as number)
    const { error: campErr } = await supabase
      .from("campaigns")
      .update({
        invites_sent: currentInvites + runEntry.invited_count,
        updated_at: new Date().toISOString(),
      })
      .eq("id", automation.campaign_id)
    if (campErr) console.error("Campaign invites_sent update failed:", campErr)
  }
}

/**
 * Daily orchestrator. Runs invite → acceptance → (optional) messaging passes.
 *
 * The acceptance pass ALWAYS runs (no toggle) so accepted leads transition
 * promptly even if the user has messaging set to `off`. Messaging only runs
 * when `messaging_runner === 'in_app'`.
 */
export async function runCampaignAutomation(
  project: SupabaseProject,
  automationId: string
): Promise<{ last_run_at: string; last_run_status: string }> {
  const ctx = await loadCtx(project, automationId)
  let finalCounters: { messagesSentToday: number; messagesSentTodayDate: string } | null = null
  try {
    await migrateLegacyToBeMessaged(ctx)
    await runInvitePass(ctx)
    await runAcceptancePass(ctx)
    if (ctx.automation.messaging_runner === "in_app") {
      finalCounters = await runMessagingPass(ctx)
    }
  } catch (e) {
    ctx.runEntry.status = "error"
    ctx.runEntry.leads.push({
      step: "run_error",
      error: e instanceof Error ? e.message : String(e),
    })
  }
  await persistRunEntry(ctx, finalCounters)
  return {
    last_run_at: ctx.runEntry.finished_at,
    last_run_status: ctx.runEntry.status,
  }
}

/**
 * Run only the messaging pass with streaming progress. Used by the "Run
 * messaging now" button on /campaign-automations.
 *
 * `force: true` bypasses the messaging_runner toggle so manual runs work even
 * when in-app messaging is set to `off`.
 */
export async function runCampaignMessagingNow(
  project: SupabaseProject,
  automationId: string,
  onProgress?: (info: { processed: number; total: number; current?: string }) => void
): Promise<{ last_run_at: string; last_run_status: string; summary: RunEntry }> {
  const ctx = await loadCtx(project, automationId)
  let finalCounters: { messagesSentToday: number; messagesSentTodayDate: string } | null = null
  try {
    finalCounters = await runMessagingPass(ctx, { force: true, onProgress })
  } catch (e) {
    ctx.runEntry.status = "error"
    ctx.runEntry.leads.push({
      pass: "messaging",
      step: "run_error",
      error: e instanceof Error ? e.message : String(e),
    })
  }
  await persistRunEntry(ctx, finalCounters)
  return {
    last_run_at: ctx.runEntry.finished_at,
    last_run_status: ctx.runEntry.status,
    summary: ctx.runEntry,
  }
}

/**
 * Single-row trigger for the in-app Airtable button. Dispatches the correct
 * pass for the row's current status and returns a small result summary suited
 * for the trigger endpoint's HTML reply.
 */
export async function runSingleRowAirtableTrigger(
  project: SupabaseProject,
  automationId: string,
  recordId: string
): Promise<{
  status: string
  decision: string
  summary: RunEntry
}> {
  const ctx = await loadCtx(project, automationId)
  let finalCounters: { messagesSentToday: number; messagesSentTodayDate: string } | null = null
  let decision = "no_op"
  try {
    const record = await fetchAirtableRecord(
      ctx.automation.airtable_base_id,
      ctx.airtableToken,
      ctx.automation.airtable_table_id,
      recordId
    )
    const status = String(record.fields?.status ?? "").trim()
    if (status === "fresh") {
      decision = "invite_sent"
      await runInvitePass(ctx, { recordIds: [recordId] })
    } else if (status === "invited") {
      decision = "acceptance_checked"
      await runAcceptancePass(ctx, { recordIds: [recordId] })
    } else if (status === "to_be_messaged" || status === "message_1_sent" || status === "message_2_sent") {
      decision = "message_sent_or_scheduled"
      finalCounters = await runMessagingPass(ctx, { recordIds: [recordId], force: true })
    } else if (status === "messaged") {
      decision = "sequence_complete"
      ctx.runEntry.leads.push({
        airtable_record_id: recordId,
        pass: "single_row",
        step: "noop",
        decision: "sequence_complete",
      })
    } else if (status === "invite_failed") {
      decision = "invite_previously_failed"
      ctx.runEntry.leads.push({
        airtable_record_id: recordId,
        pass: "single_row",
        step: "noop",
        decision,
      })
    } else if (status === "messaging_failed") {
      decision = "messaging_previously_failed"
      ctx.runEntry.leads.push({
        airtable_record_id: recordId,
        pass: "single_row",
        step: "noop",
        decision,
      })
    } else {
      decision = `unknown_status=${status || "—"}`
      ctx.runEntry.leads.push({
        airtable_record_id: recordId,
        pass: "single_row",
        step: "noop",
        decision,
      })
    }
  } catch (e) {
    ctx.runEntry.status = "error"
    decision = "error"
    ctx.runEntry.leads.push({
      airtable_record_id: recordId,
      pass: "single_row",
      step: "run_error",
      error: e instanceof Error ? e.message : String(e),
    })
  }
  await persistRunEntry(ctx, finalCounters)
  return {
    status: ctx.runEntry.status,
    decision,
    summary: ctx.runEntry,
  }
}
