import { createClient, type SupabaseProject } from "@/lib/supabase"
import { getAirtableApiKey, getUnipileAccountId } from "@/lib/env"
import {
  listAirtableRecords,
  updateAirtableRecord,
  type AirtableRecord,
} from "@/lib/campaign-manager-inline"
import {
  resolveIdentifierFromProfileUrl,
  fetchUnipileProfileWithDetails,
  sendUnipileInviteWithDetails,
} from "@/lib/enrichment-engine"

/**
 * Campaign automations (in_app_campaign_automations) exist in both databases:
 * - Sales 2k25
 * - Prod 2k26
 * Same table schema in both; data is separate per project. Always pass project.
 */

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
  /** From campaigns table (updated when Run now sends invites) */
  campaign_invites_sent?: number | null
  campaign_messages_sent?: number | null
  campaign_comments_made?: number | null
  campaign_likes_reactions?: number | null
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

/** Run automation once: fetch Airtable hitlist "fresh" rows, resolve LinkedIn → Unipile, send invites, update Airtable + run_logs. */
export async function runCampaignAutomation(
  project: SupabaseProject,
  automationId: string
): Promise<{ last_run_at: string; last_run_status: string }> {
  const supabase = createClient(project)
  const now = new Date()
  const runDate = now.toISOString().slice(0, 10)

  const { data: automation, error: fetchError } = await supabase
    .from("in_app_campaign_automations")
    .select(
      "id, campaign_id, airtable_base_id, airtable_table_id, default_unipile_sender_id, total_invites_sent, invites_sent_today, total_to_be_messaged, total_rejected, run_logs"
    )
    .eq("id", automationId)
    .single()
  if (fetchError || !automation) throw fetchError ?? new Error("Automation not found")

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
    throw new Error("No Unipile sender: set default_unipile_sender_id on automation or UNIPILE_ACCOUNT_ID in env")
  }

  const token = getAirtableApiKey()
  if (!token) throw new Error("AIRTABLE_API_KEY not set")

  const baseId = automation.airtable_base_id
  const tableId = automation.airtable_table_id
  if (!baseId || !tableId) throw new Error("Automation missing airtable_base_id or airtable_table_id")

  const runEntry = {
    run_date: runDate,
    started_at: now.toISOString(),
    finished_at: "",
    status: "success" as string,
    invited_count: 0,
    to_be_messaged_count: 0,
    rejected_count: 0,
    leads: [] as Array<{
      airtable_record_id?: string
      linkedin_url?: string
      step?: string
      unipile_degree?: string
      decision?: string
      error?: string
      unipile_profile_status?: number
      unipile_profile_response?: string
      unipile_invite_status?: number
      unipile_invite_response?: string
      [k: string]: unknown
    }>,
  }

  try {
    const records = await listAirtableRecords(baseId, token, tableId, {
      filterByFormula: "{status}='fresh'",
      pageSize: 50,
    })

    for (const rec of records as AirtableRecord[]) {
      const fields = rec.fields ?? {}
      const linkedinUrl =
        (fields.LinkedIn != null && String(fields.LinkedIn).trim()) ||
        (fields.Linkedin_Profile != null && String(fields.Linkedin_Profile).trim()) ||
        (fields.URL != null && String(fields.URL).trim()) ||
        (fields.profile_url != null && String(fields.profile_url).trim()) ||
        ""
      const leadLog: (typeof runEntry.leads)[number] = {
        airtable_record_id: rec.id,
        linkedin_url: linkedinUrl || undefined,
        step: "fetch",
      }

      if (!linkedinUrl.trim()) {
        leadLog.step = "skip"
        leadLog.decision = "no_linkedin_url"
        runEntry.rejected_count += 1
        runEntry.leads.push(leadLog)
        continue
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
          leadLog.step = "unipile_profile_error"
          leadLog.error = `${details.statusCode}: ${details.responseSnippet.slice(0, 200)}`
          runEntry.to_be_messaged_count += 1
          runEntry.leads.push(leadLog)
          try {
            await updateAirtableRecord(baseId, token, tableId, rec.id, { status: "to_be_messaged" })
          } catch {
            // non-fatal
          }
          continue
        }
      } catch (e) {
        leadLog.step = "unipile_profile_error"
        leadLog.error = e instanceof Error ? e.message : String(e)
        runEntry.to_be_messaged_count += 1
        runEntry.leads.push(leadLog)
        try {
          await updateAirtableRecord(baseId, token, tableId, rec.id, { status: "to_be_messaged" })
        } catch {
          // non-fatal
        }
        continue
      }

      if (!profile?.provider_id) {
        leadLog.step = "profile_not_found"
        leadLog.decision = "no_provider_id"
        if (leadLog.unipile_degree == null) leadLog.unipile_degree = "—"
        runEntry.to_be_messaged_count += 1
        runEntry.leads.push(leadLog)
        try {
          await updateAirtableRecord(baseId, token, tableId, rec.id, { status: "to_be_messaged" })
        } catch {
          // non-fatal
        }
        continue
      }

      if (leadLog.unipile_degree == null) leadLog.unipile_degree = "resolved"
      const inviteResult = await sendUnipileInviteWithDetails(unipileAccountId, profile.provider_id)
      leadLog.unipile_invite_status = inviteResult.statusCode
      leadLog.unipile_invite_response = inviteResult.responseSnippet
      if (!inviteResult.ok) {
        leadLog.step = "invite_failed"
        leadLog.decision = "to_be_messaged"
        leadLog.error = inviteResult.error
        runEntry.to_be_messaged_count += 1
        runEntry.leads.push(leadLog)
        try {
          await updateAirtableRecord(baseId, token, tableId, rec.id, { status: "to_be_messaged" })
        } catch {
          // non-fatal
        }
        continue
      }

      leadLog.step = "invited"
      leadLog.decision = "invited"
      runEntry.invited_count += 1
      runEntry.leads.push(leadLog)
      try {
        await updateAirtableRecord(baseId, token, tableId, rec.id, { status: "invited" })
      } catch (e) {
        leadLog.error = (e instanceof Error ? e.message : String(e)) + " (Airtable update failed)"
      }
    }

    runEntry.finished_at = new Date().toISOString()
    if (runEntry.leads.some((l) => l.error)) runEntry.status = "partial"
  } catch (e) {
    runEntry.finished_at = new Date().toISOString()
    runEntry.status = "error"
    runEntry.leads.push({
      step: "run_error",
      error: e instanceof Error ? e.message : String(e),
    })
  }

  const existingLogs = Array.isArray(automation.run_logs) ? automation.run_logs : []
  const runLogs = [...existingLogs, runEntry]

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const lastRunAt = automation.last_run_at
  const wasToday = lastRunAt && lastRunAt.slice(0, 10) === runDate
  const prevInvitesToday = wasToday ? (automation.invites_sent_today ?? 0) : 0
  const invitesSentToday = prevInvitesToday + runEntry.invited_count
  const totalInvitesSent = (automation.total_invites_sent ?? 0) + runEntry.invited_count
  const totalToBeMessaged = (automation.total_to_be_messaged ?? 0) + runEntry.to_be_messaged_count
  const totalRejected = (automation.total_rejected ?? 0) + runEntry.rejected_count

  const { error } = await supabase
    .from("in_app_campaign_automations")
    .update({
      last_run_at: runEntry.finished_at || now.toISOString(),
      last_run_status: runEntry.status,
      run_logs: runLogs,
      total_invites_sent: totalInvitesSent,
      invites_sent_today: invitesSentToday,
      total_to_be_messaged: totalToBeMessaged,
      total_rejected: totalRejected,
      updated_at: new Date().toISOString(),
    })
    .eq("id", automationId)
  if (error) throw error

  if (runEntry.invited_count > 0 && automation.campaign_id) {
    const { data: camp } = await supabase
      .from("campaigns")
      .select("invites_sent")
      .eq("id", automation.campaign_id)
      .single()
    const currentInvites = (camp?.invites_sent ?? 0) as number
    const { error: campaignError } = await supabase
      .from("campaigns")
      .update({
        invites_sent: currentInvites + runEntry.invited_count,
        updated_at: new Date().toISOString(),
      })
      .eq("id", automation.campaign_id)
    if (campaignError) {
      console.error("Campaign invites_sent update failed:", campaignError)
    }
  }

  return {
    last_run_at: runEntry.finished_at || now.toISOString(),
    last_run_status: runEntry.status,
  }
}
