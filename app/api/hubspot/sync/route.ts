import { NextResponse } from "next/server"
import type { SupabaseProject } from "@/lib/supabase"
import { getAllLeads } from "@/lib/leadQueries"
import {
  getAllCampaigns,
  getLeadCampaigns,
} from "@/lib/campaignQueries"
import { getLeadPostsByLead } from "@/lib/hubspotSyncData"
import { getHubSpotAccessToken, getHubSpotApiBase } from "@/lib/env"
import {
  upsertContact,
  upsertDeal,
  associateContactToDeal,
  createNoteOnContact,
  type LeadForHubSpot,
  type CampaignForHubSpot,
} from "@/lib/hubspot"

function parseProject(v: string | null): SupabaseProject {
  return v === "prod2k26" ? "prod2k26" : "sales2k25"
}

function leadToHubSpot(l: {
  id: string
  name?: string | null
  email?: string | null
  title?: string | null
  company?: string | null
  phone?: string | null
  location?: string | null
  status?: string | null
  profile_url?: string | null
  about_summary?: string | null
  dossier_url?: string | null
}): LeadForHubSpot {
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

export async function POST(req: Request) {
  try {
    if (!getHubSpotAccessToken()) {
      return NextResponse.json(
        { error: "HUBSPOT_ACCESS_TOKEN is not set. Add it in .env or app settings." },
        { status: 400 }
      )
    }
    const { searchParams } = new URL(req.url)
    const project = parseProject(searchParams.get("project"))
    const apiBase = getHubSpotApiBase()
    const logs: string[] = []

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

    let processedLeads = 0
    for (const lead of leads) {
      const id = await upsertContact(leadToHubSpot(lead))
      contactIdByLeadId.set(lead.id, id)
      processedLeads += 1
      if (processedLeads % 200 === 0) {
        logs.push(`Contacts: upserted ${processedLeads}/${leads.length}`)
      }
    }
    logs.push(`Contacts: upserted ${processedLeads} total.`)

    let processedDeals = 0
    for (const campaign of campaigns) {
      const id = await upsertDeal(campaignToHubSpot(campaign))
      dealIdByCampaignId.set(campaign.id, id)
      processedDeals += 1
    }
    logs.push(`Deals: upserted ${processedDeals} total.`)

    for (const lc of leadCampaigns) {
      const cid = contactIdByLeadId.get(lc.lead_id)
      const did = dealIdByCampaignId.get(lc.campaign_id)
      if (!cid || !did) {
        assocFailed += 1
        logs.push(
          `Association skipped: missing contact or deal for lead ${lc.lead_id}, campaign ${lc.campaign_id}.`
        )
        continue
      }
      try {
        await associateContactToDeal(cid, did)
        assocOk += 1
      } catch (e) {
        assocFailed += 1
        const msg =
          e instanceof Error ? e.message.slice(0, 160) : "Unknown association error"
        logs.push(
          `Association failed for contact ${cid} -> deal ${did}: ${msg}`
        )
      }
    }
    logs.push(
      `Associations: ${assocOk} created, ${assocFailed} failed or skipped.`
    )

    for (const lead of leads) {
      const cid = contactIdByLeadId.get(lead.id)
      if (!cid) continue
      if ((lead.dossier_url ?? "").trim()) {
        await createNoteOnContact(cid, `Dossier: ${lead.dossier_url!.trim()}`)
        dossierNotes += 1
      }
      const posts = postsByLead.get(lead.id)
      if (posts && posts.count > 0) {
        const line = posts.firstPostUrl
          ? `LinkedIn: ${posts.count} post(s). Latest: ${posts.firstPostUrl}`
          : `LinkedIn: ${posts.count} post(s)`
        await createNoteOnContact(cid, line)
        postNotes += 1
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

    return NextResponse.json({
      ok: true,
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
        dossierNotes,
        postNotes,
        assocOk,
        assocFailed,
      },
      logs,
      preview: {
        campaigns: previewCampaigns,
        leads: previewLeads,
      },
      contactIds: Array.from(contactIdByLeadId.values()),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "HubSpot sync failed"
    console.error("HubSpot sync error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
