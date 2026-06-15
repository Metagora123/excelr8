/**
 * HubSpot sync pipeline (Supabase -> HubSpot contacts, deals, associations, notes).
 * Shared by the manual route (/api/hubspot/sync) and the daily cron (/api/hubspot/sync-scheduled).
 * Records each run into hubspot_sync_runs.
 */

import type { SupabaseProject } from "./supabase"
import { getAllLeads, type LeadRow } from "./leadQueries"
import { getAllCampaigns, getLeadCampaigns } from "./campaignQueries"
import { getLeadPostsByLead } from "./hubspotSyncData"
import { getHubSpotApiBase } from "./env"
import {
  upsertContact,
  upsertDeal,
  associateContactToDeal,
  createNoteOnContact,
  type LeadForHubSpot,
  type CampaignForHubSpot,
} from "./hubspot"
import { recordSyncRun, type SyncRunTrigger } from "./syncRuns"

function leadToHubSpot(l: LeadRow): LeadForHubSpot {
  return {
    id: l.id,
    name: l.name ?? undefined,
    email: l.email ?? undefined,
    title: l.title ?? undefined,
    company: l.company ?? undefined,
    phone: l.phone ?? undefined,
    location: l.location ?? undefined,
    status: l.status ?? undefined,
    profile_url: l.profile_url ?? undefined,
    about_summary: l.about_summary ?? undefined,
    company_info: l.company_info ?? undefined,
    icp_scores: l.icp_scores ?? undefined,
  }
}

function campaignToHubSpot(c: {
  id: string
  name: string | null
  status: string | null
  description?: string | null
  messages_sent?: number | null
  invites_sent?: number | null
  replies_received?: number | null
  created_at?: string | null
}): CampaignForHubSpot {
  return {
    id: c.id,
    name: c.name,
    status: c.status ?? undefined,
    description: c.description ?? undefined,
    messages_sent: c.messages_sent ?? undefined,
    invites_sent: c.invites_sent ?? undefined,
    replies_received: c.replies_received ?? undefined,
    started_at: c.created_at ?? undefined,
  }
}

export type HubSpotSyncResult = {
  contacts: number
  deals: number
  associations: number
  stats: Record<string, unknown>
  logs: string[]
  preview: {
    campaigns: { id: string; name: string; status: string | null; leadCount: number }[]
    leads: { id: string; name: string; email: string; company: string; status: string }[]
  }
  contactIds: string[]
}

/** Run the full sync for a single project and record the run. Throws on fatal errors (after recording). */
export async function runHubSpotSync(
  project: SupabaseProject,
  trigger: SyncRunTrigger
): Promise<HubSpotSyncResult> {
  const startedAt = Date.now()
  const apiBase = getHubSpotApiBase()
  const logs: string[] = []

  try {
    const [leads, campaigns, leadCampaigns, postsByLead] = await Promise.all([
      getAllLeads(project),
      getAllCampaigns(project),
      getLeadCampaigns(project),
      getLeadPostsByLead(project),
    ])

    logs.push(
      `Loaded from Supabase (${project}): ${leads.length} leads, ${campaigns.length} campaigns, ${leadCampaigns.length} lead-campaign links, ${postsByLead.size} leads with posts.`
    )

    const contactIdByLeadId = new Map<string, string>()
    const dealIdByCampaignId = new Map<string, string>()
    let dossierNotes = 0
    let postNotes = 0
    let assocOk = 0
    let assocFailed = 0
    let dealFailures = 0
    let dossierNoteFailures = 0
    let postNoteFailures = 0
    const leadOutcome = { successful: 0, failed: 0, skipped: 0 }
    const leadReasonCounts = new Map<string, number>()
    const bumpLeadReason = (reason: string) => {
      leadReasonCounts.set(reason, (leadReasonCounts.get(reason) ?? 0) + 1)
    }

    let processedLeads = 0
    let skippedLeadsMissingEssentials = 0
    for (const lead of leads) {
      const fullName = (lead.name ?? "").trim()
      const linkedinUrl = (lead.profile_url ?? "").trim()
      if (!fullName || !linkedinUrl) {
        skippedLeadsMissingEssentials += 1
        leadOutcome.skipped += 1
        bumpLeadReason(!fullName ? "missing_full_name" : "missing_linkedin_url")
        logs.push(`Contact skipped for lead ${lead.id}: missing ${!fullName ? "full name" : "LinkedIn URL"}.`)
        continue
      }
      try {
        const id = await upsertContact(leadToHubSpot(lead))
        contactIdByLeadId.set(lead.id, id)
        processedLeads += 1
        leadOutcome.successful += 1
      } catch (e) {
        leadOutcome.failed += 1
        bumpLeadReason("contact_upsert_error")
        const msg = e instanceof Error ? e.message.slice(0, 180) : "Unknown contact upsert error"
        logs.push(`Contact failed for lead ${lead.id}: ${msg}`)
      }
      if (processedLeads % 200 === 0) logs.push(`Contacts: upserted ${processedLeads}/${leads.length}`)
    }
    logs.push(`Contacts: upserted ${processedLeads} total, skipped ${skippedLeadsMissingEssentials} missing essentials.`)

    let processedDeals = 0
    for (const campaign of campaigns) {
      try {
        const id = await upsertDeal(campaignToHubSpot(campaign))
        dealIdByCampaignId.set(campaign.id, id)
        processedDeals += 1
      } catch (e) {
        dealFailures += 1
        const msg = e instanceof Error ? e.message.slice(0, 180) : "Unknown deal upsert error"
        logs.push(`Deal failed for campaign ${campaign.id}: ${msg}`)
      }
    }
    logs.push(`Deals: upserted ${processedDeals} total, failed ${dealFailures}.`)

    for (const lc of leadCampaigns) {
      const cid = contactIdByLeadId.get(lc.lead_id)
      const did = dealIdByCampaignId.get(lc.campaign_id)
      if (!cid || !did) {
        assocFailed += 1
        logs.push(`Association skipped: missing contact or deal for lead ${lc.lead_id}, campaign ${lc.campaign_id}.`)
        continue
      }
      try {
        await associateContactToDeal(cid, did)
        assocOk += 1
      } catch (e) {
        assocFailed += 1
        const msg = e instanceof Error ? e.message.slice(0, 160) : "Unknown association error"
        logs.push(`Association failed for contact ${cid} -> deal ${did}: ${msg}`)
      }
    }
    logs.push(`Associations: ${assocOk} created, ${assocFailed} failed or skipped.`)

    for (const lead of leads) {
      const cid = contactIdByLeadId.get(lead.id)
      if (!cid) continue
      if ((lead.dossier_url ?? "").trim()) {
        try {
          await createNoteOnContact(cid, `Dossier: ${lead.dossier_url!.trim()}`)
          dossierNotes += 1
        } catch (e) {
          dossierNoteFailures += 1
          const msg = e instanceof Error ? e.message.slice(0, 180) : "Unknown dossier note error"
          logs.push(`Dossier note failed for lead ${lead.id}: ${msg}`)
        }
      }
      const posts = postsByLead.get(lead.id)
      if (posts && posts.count > 0) {
        const line = posts.firstPostUrl
          ? `LinkedIn: ${posts.count} post(s). Latest: ${posts.firstPostUrl}`
          : `LinkedIn: ${posts.count} post(s)`
        try {
          await createNoteOnContact(cid, line)
          postNotes += 1
        } catch (e) {
          postNoteFailures += 1
          const msg = e instanceof Error ? e.message.slice(0, 180) : "Unknown post note error"
          logs.push(`Post note failed for lead ${lead.id}: ${msg}`)
        }
      }
    }

    const previewCampaigns = campaigns.slice(0, 5).map((c) => ({
      id: c.id,
      name: c.name ?? c.id,
      status: c.status ?? null,
      leadCount: leadCampaigns.filter((lc) => lc.campaign_id === c.id).length,
    }))
    const previewLeads = leads.slice(0, 5).map((l) => ({
      id: l.id,
      name: l.name ?? "",
      email: l.email ?? "",
      company: l.company ?? "",
      status: l.status ?? "",
    }))

    const errors =
      leadOutcome.failed + dealFailures + assocFailed + dossierNoteFailures + postNoteFailures
    const durationMs = Date.now() - startedAt

    await recordSyncRun({
      project,
      trigger,
      status: errors > 0 ? "partial" : "success",
      contacts_synced: contactIdByLeadId.size,
      deals_synced: dealIdByCampaignId.size,
      associations: assocOk,
      dossier_notes: dossierNotes,
      post_notes: postNotes,
      errors,
      duration_ms: durationMs,
      message: errors > 0 ? `${errors} item-level failure(s); see logs.` : null,
    })

    return {
      contacts: contactIdByLeadId.size,
      deals: dealIdByCampaignId.size,
      associations: leadCampaigns.length,
      stats: {
        project,
        apiBase,
        leads: leads.length,
        campaigns: campaigns.length,
        leadCampaigns: leadCampaigns.length,
        leadsWithPosts: postsByLead.size,
        skippedLeadsMissingEssentials,
        leadSuccess: leadOutcome.successful,
        leadFailed: leadOutcome.failed,
        leadSkipped: leadOutcome.skipped,
        leadFailureReasons: Object.fromEntries(leadReasonCounts.entries()),
        dossierNotes,
        dossierNoteFailures,
        postNotes,
        postNoteFailures,
        assocOk,
        assocFailed,
        dealFailures,
        durationMs,
      },
      logs,
      preview: { campaigns: previewCampaigns, leads: previewLeads },
      contactIds: Array.from(contactIdByLeadId.values()),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "HubSpot sync failed"
    await recordSyncRun({
      project,
      trigger,
      status: "error",
      contacts_synced: 0,
      deals_synced: 0,
      associations: 0,
      dossier_notes: 0,
      post_notes: 0,
      errors: 1,
      duration_ms: Date.now() - startedAt,
      message: message.slice(0, 300),
    })
    throw err
  }
}
