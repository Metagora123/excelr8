import { getSupabase } from "./supabase"

export type ClientRow = { id: string; name: string | null }

export type CampaignRow = {
  id: string
  name: string | null
  status: string | null
  created_at: string | null
  messages_sent: number | null
  invites_sent: number | null
  replies_received: number | null
  comments_made: number | null
  likes_reactions: number | null
}

export type KpiTotals = {
  campaigns: number
  messages_sent: number
  invites_sent: number
  replies_received: number
  comments_made: number
  likes_reactions: number
}

export async function getClients(): Promise<ClientRow[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("clients")
    .select("id, name")
    .order("name")
  if (error) throw error
  return (data ?? []) as ClientRow[]
}

export async function getAllCampaigns(): Promise<CampaignRow[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, name, status, created_at, messages_sent, invites_sent, replies_received, comments_made, likes_reactions")
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as CampaignRow[]
}

export async function getKpiTotals(): Promise<KpiTotals> {
  const campaigns = await getAllCampaigns()
  const totals: KpiTotals = {
    campaigns: campaigns.length,
    messages_sent: 0,
    invites_sent: 0,
    replies_received: 0,
    comments_made: 0,
    likes_reactions: 0,
  }
  for (const c of campaigns) {
    totals.messages_sent += c.messages_sent ?? 0
    totals.invites_sent += c.invites_sent ?? 0
    totals.replies_received += c.replies_received ?? 0
    totals.comments_made += c.comments_made ?? 0
    totals.likes_reactions += c.likes_reactions ?? 0
  }
  return totals
}
