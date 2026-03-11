/**
 * HubSpot CRM API helpers for syncing Supabase leads/campaigns to HubSpot.
 * Uses Private App access token (HUBSPOT_ACCESS_TOKEN).
 * @see https://developers.hubspot.com/docs/api/crm/contacts
 * @see https://developers.hubspot.com/docs/api/crm/deals
 */

import { getHubSpotAccessToken, getHubSpotApiBase } from "./env"

function getApiBase(): string {
  return getHubSpotApiBase()
}

function mapLeadStatusToHubSpot(status?: string | null): string | undefined {
  if (!status) return undefined
  const raw = String(status).trim().toLowerCase()
  switch (raw) {
    case "new":
      return "NEW"
    case "interested":
    case "qualified":
    case "enriched":
    case "invited":
    case "messaged":
    case "renewed":
    case "open":
      return "OPEN"
    case "in_progress":
    case "in progress":
      return "IN_PROGRESS"
    case "not interested":
    case "unqualified":
      return "UNQUALIFIED"
    default:
      return undefined
  }
}

function getHeaders(): Record<string, string> {
  const token = getHubSpotAccessToken()
  if (!token) throw new Error("HUBSPOT_ACCESS_TOKEN is not set")
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
}

export type LeadForHubSpot = {
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
}

export type CampaignForHubSpot = {
  id: string
  name: string | null
  description?: string | null
  status?: string | null
  messages_sent?: number | null
  invites_sent?: number | null
  replies_received?: number | null
  total_leads?: number | null
  engaged_leads?: number | null
  started_at?: string | null
  ended_at?: string | null
}

/** Search for a contact by email; returns HubSpot id or null */
export async function findContactByEmail(email: string): Promise<string | null> {
  if (!email?.trim()) return null
  const res = await fetch(`${getApiBase()}/crm/v3/objects/contacts/search`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      filterGroups: [
        {
          filters: [
            { propertyName: "email", operator: "EQ", value: email.trim() },
          ],
        },
      ],
      properties: ["email"],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`HubSpot contact search failed: ${res.status} ${err}`)
  }
  const data = (await res.json()) as { results?: { id: string }[] }
  const id = data.results?.[0]?.id ?? null
  return id
}

/** Create or update a HubSpot contact from a lead. Returns HubSpot contact id. */
export async function upsertContact(lead: LeadForHubSpot): Promise<string> {
  const email = (lead.email ?? "").trim()
  const profileUrl = (lead.profile_url ?? "").trim()
  const name = (lead.name ?? "").trim() || "Unknown"
  const parts = name.split(/\s+/)
  const firstName = parts[0] ?? ""
  const lastName = parts.slice(1).join(" ") ?? ""

  const properties: Record<string, string> = {
    firstname: firstName,
    lastname: lastName,
    company: (lead.company ?? "").trim(),
    jobtitle: (lead.title ?? "").trim(),
    phone: (lead.phone ?? "").trim(),
    address: (lead.location ?? "").trim(),
    linkedinbio: (lead.about_summary ?? "").slice(0, 65535),
  }
  // Only set email if we have a real one; HubSpot validates format strictly.
  if (email) {
    properties.email = email
  }
  if (profileUrl) {
    // Custom property you should create in HubSpot (single-line text):
    // excelr8_profile_url – used for dedupe when email is missing.
    properties.excelr8_profile_url = profileUrl
  }
  const mappedStatus = mapLeadStatusToHubSpot(lead.status)
  if (mappedStatus) {
    properties.hs_lead_status = mappedStatus
  }

  let existingId = email ? await findContactByEmail(email) : null
  if (!existingId && !email && profileUrl) {
    // Fallback: try to find by LinkedIn/profile URL when we don't have email.
    try {
      const byProfile = await findContactByProfileUrl(profileUrl)
      if (byProfile) existingId = byProfile
    } catch {
      // If the custom property doesn't exist yet or search fails, ignore and create a new contact.
    }
  }
  if (existingId) {
    await fetch(`${getApiBase()}/crm/v3/objects/contacts/${existingId}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ properties }),
    })
    return existingId
  }

  const res = await fetch(`${getApiBase()}/crm/v3/objects/contacts`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ properties }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`HubSpot contact create failed: ${res.status} ${err}`)
  }
  const data = (await res.json()) as { id: string }
  return data.id
}

/** Search for a deal by name (first match). Returns HubSpot deal id or null */
export async function findDealByName(name: string): Promise<string | null> {
  if (!name?.trim()) return null
  const res = await fetch(`${getApiBase()}/crm/v3/objects/deals/search`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      filterGroups: [
        {
          filters: [
            { propertyName: "dealname", operator: "EQ", value: name.trim() },
          ],
        },
      ],
      properties: ["dealname"],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`HubSpot deal search failed: ${res.status} ${err}`)
  }
  const data = (await res.json()) as { results?: { id: string }[] }
  return data.results?.[0]?.id ?? null
}

/** Search for a contact by custom LinkedIn/profile URL property. Returns HubSpot id or null. */
export async function findContactByProfileUrl(url: string): Promise<string | null> {
  if (!url?.trim()) return null
  const res = await fetch(`${getApiBase()}/crm/v3/objects/contacts/search`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      filterGroups: [
        {
          filters: [
            { propertyName: "excelr8_profile_url", operator: "EQ", value: url.trim() },
          ],
        },
      ],
      properties: ["excelr8_profile_url"],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`HubSpot contact search by profile_url failed: ${res.status} ${err}`)
  }
  const data = (await res.json()) as { results?: { id: string }[] }
  return data.results?.[0]?.id ?? null
}

/** Create or update a HubSpot deal from a campaign. Returns HubSpot deal id. */
export async function upsertDeal(campaign: CampaignForHubSpot): Promise<string> {
  const name = (campaign.name ?? `Campaign ${campaign.id}`).trim()
  const properties: Record<string, string | number> = {
    dealname: name,
    description: (campaign.description ?? "").slice(0, 65535),
  }
  // Optional: set dealstage to a HubSpot pipeline stage ID via env HUBSPOT_DEAL_STAGE_ID if needed
  const stageId = process.env.HUBSPOT_DEAL_STAGE_ID
  if (stageId) properties.dealstage = stageId

  const existingId = await findDealByName(name)
  if (existingId) {
    const body: Record<string, unknown> = {
      properties: Object.fromEntries(
        Object.entries(properties).map(([k, v]) => [
          k,
          typeof v === "number" ? String(v) : v,
        ])
      ),
    }
    await fetch(`${getApiBase()}/crm/v3/objects/deals/${existingId}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(body),
    })
    return existingId
  }

  const res = await fetch(`${getApiBase()}/crm/v3/objects/deals`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      properties: Object.fromEntries(
        Object.entries(properties).map(([k, v]) => [
          k,
          typeof v === "number" ? String(v) : v,
        ])
      ),
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`HubSpot deal create failed: ${res.status} ${err}`)
  }
  const data = (await res.json()) as { id: string }
  return data.id
}

/** Association type 3 = Contact to Deal (primary). */
const CONTACT_TO_DEAL_ASSOCIATION_TYPE = 3

/** Associate a contact to a deal in HubSpot. */
export async function associateContactToDeal(
  contactId: string,
  dealId: string
): Promise<void> {
  const res = await fetch(
    `${getApiBase()}/crm/v4/objects/contacts/${contactId}/associations/deals/${dealId}`,
    {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify([
        {
          associationCategory: "HUBSPOT_DEFINED",
          associationTypeId: CONTACT_TO_DEAL_ASSOCIATION_TYPE,
        },
      ]),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(
      `HubSpot contact-deal association failed: ${res.status} ${err}`
    )
  }
}

/** Create a note and associate to contact. Body plain text (HubSpot will store in hs_note_body). */
export async function createNoteOnContact(
  contactId: string,
  body: string
): Promise<void> {
  const res = await fetch(`${getApiBase()}/crm/v3/objects/notes`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      properties: {
        hs_note_body: String(body).slice(0, 65535),
        // Required by HubSpot for notes; determines timeline placement.
        // Accepts ms since epoch or an ISO 8601 timestamp.
        hs_timestamp: Date.now(),
      },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`HubSpot note create failed: ${res.status} ${err}`)
  }
  const data = (await res.json()) as { id: string }
  const noteId = data.id
  const assocRes = await fetch(
    `${getApiBase()}/crm/v4/objects/notes/${noteId}/associations/contacts/${contactId}`,
    {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify([
        {
          associationCategory: "HUBSPOT_DEFINED",
          associationTypeId: 202,
        },
      ]),
    }
  )
  if (!assocRes.ok) {
    const err = await assocRes.text()
    throw new Error(`HubSpot note-contact association failed: ${assocRes.status} ${err}`)
  }
}

/** Delete contacts by IDs in batches. Returns counts of deleted/failed. */
export async function deleteContactsByIds(
  ids: string[]
): Promise<{ deleted: number; failed: number }> {
  if (!ids.length) return { deleted: 0, failed: 0 }
  let deleted = 0
  let failed = 0
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += 100) {
    chunks.push(ids.slice(i, i + 100))
  }
  for (const chunk of chunks) {
    const res = await fetch(`${getApiBase()}/crm/v3/objects/contacts/batch/archive`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        inputs: chunk.map((id) => ({ id })),
      }),
    })
    if (res.ok) {
      deleted += chunk.length
    } else {
      failed += chunk.length
    }
  }
  return { deleted, failed }
}

/** Find contact IDs created since (now - msAgo). */
export async function findContactsCreatedSince(
  msAgo: number
): Promise<string[]> {
  const since = Date.now() - msAgo
  const ids: string[] = []
  let after: string | undefined
  while (true) {
    const body: any = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "createdate",
              operator: "GTE",
              value: String(since),
            },
          ],
        },
      ],
      properties: ["createdate"],
      limit: 100,
    }
    if (after) body.after = after
    const res = await fetch(`${getApiBase()}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      break
    }
    const data = (await res.json()) as {
      results?: { id: string }[]
      paging?: { next?: { after: string } }
    }
    const results = data.results ?? []
    for (const r of results) ids.push(r.id)
    const next = data.paging?.next?.after
    if (!next || !results.length) break
    after = next
  }
  return ids
}
