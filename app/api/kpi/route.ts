import { NextResponse } from "next/server"
import { getKpiTotals, getAllCampaigns } from "@/lib/campaignQueries"
import { getCampaignAutomations } from "@/lib/campaignAutomationQueries"

function parseProject(v: string | null): "sales2k25" | "prod2k26" {
  return v === "prod2k26" ? "prod2k26" : "sales2k25"
}

/** Campaign row with merged automation metrics (invites_sent includes in-app automation invites). */
export type CampaignKpiRow = {
  id: string
  name: string | null
  status: string | null
  messages_sent: number | null
  invites_sent: number | null
  replies_received: number | null
  comments_made: number | null
  likes_reactions: number | null
  /** From in_app_campaign_automations for this campaign */
  automation_invites_sent: number
  automation_to_be_messaged: number
  automation_rejected: number
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const project = parseProject(searchParams.get("project"))
    const [totalsBase, campaigns, automations] = await Promise.all([
      getKpiTotals(project),
      getAllCampaigns(project),
      getCampaignAutomations(project),
    ])

    const automationByCampaignId = new Map<string, { total_invites_sent: number; total_to_be_messaged: number; total_rejected: number }>()
    let sumAutomationInvites = 0
    let sumToBeMessaged = 0
    let sumRejected = 0
    for (const a of automations) {
      const cur = automationByCampaignId.get(a.campaign_id) ?? {
        total_invites_sent: 0,
        total_to_be_messaged: 0,
        total_rejected: 0,
      }
      cur.total_invites_sent += a.total_invites_sent ?? 0
      cur.total_to_be_messaged += a.total_to_be_messaged ?? 0
      cur.total_rejected += a.total_rejected ?? 0
      automationByCampaignId.set(a.campaign_id, cur)
      sumAutomationInvites += a.total_invites_sent ?? 0
      sumToBeMessaged += a.total_to_be_messaged ?? 0
      sumRejected += a.total_rejected ?? 0
    }

    const totals = {
      ...totalsBase,
      invites_sent: totalsBase.invites_sent + sumAutomationInvites,
      automation_invites_sent: sumAutomationInvites,
      automation_to_be_messaged: sumToBeMessaged,
      automation_rejected: sumRejected,
    }

    const campaignsMerged: CampaignKpiRow[] = campaigns.slice(0, 12).map((c) => {
      const auto = automationByCampaignId.get(c.id) ?? { total_invites_sent: 0, total_to_be_messaged: 0, total_rejected: 0 }
      return {
        ...c,
        invites_sent: (c.invites_sent ?? 0) + auto.total_invites_sent,
        automation_invites_sent: auto.total_invites_sent,
        automation_to_be_messaged: auto.total_to_be_messaged,
        automation_rejected: auto.total_rejected,
      }
    })

    return NextResponse.json({ totals, campaigns: campaignsMerged })
  } catch (err) {
    console.error("KPI API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load KPI data" },
      { status: 500 }
    )
  }
}
