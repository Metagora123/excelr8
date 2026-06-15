/**
 * HubSpot CRM API helpers for syncing Supabase leads/campaigns to HubSpot.
 * Uses Private App access token (HUBSPOT_ACCESS_TOKEN).
 * @see https://developers.hubspot.com/docs/api/crm/contacts
 * @see https://developers.hubspot.com/docs/api/crm/deals
 */

import { getHubSpotAccessToken, getHubSpotApiBase, getHubSpotSyncCompanyProps } from "./env"
import type { CompanyInfo, IcpScores } from "./leadQueries"

const PROFILE_URL_PROPERTY = "excelr8_profile_url"
let canUseProfileUrlProperty = true
// Disabled at runtime if the custom company/score properties don't exist in HubSpot yet.
let canUseCompanyProps = true

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

/** Extract any excelr8_* custom property names HubSpot reports as missing (PROPERTY_DOESNT_EXIST). */
function extractMissingExcelr8Properties(errorText: string): string[] {
  if (!errorText || !errorText.includes("PROPERTY_DOESNT_EXIST")) return []
  const names = new Set<string>()
  const re = /"(excelr8_[a-zA-Z0-9_]+)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(errorText)) !== null) names.add(m[1])
  return [...names]
}

/** Disable a custom property group for the rest of this sync once HubSpot reports it missing. */
function noteDisabledProperty(name: string): void {
  if (name === PROFILE_URL_PROPERTY) canUseProfileUrlProperty = false
  else canUseCompanyProps = false
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
  company_info?: CompanyInfo | null
  icp_scores?: IcpScores | null
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

/** Build the HubSpot contact property map for a lead (incl. opt-in Clay company/score props). */
function buildContactProperties(lead: LeadForHubSpot): Record<string, string> {
  const email = (lead.email ?? "").trim()
  const profileUrl = (lead.profile_url ?? "").trim()
  const name = (lead.name ?? "").trim() || "Unknown"
  const parts = name.split(/\s+/)
  const firstName = parts[0] ?? ""
  const lastName = parts.slice(1).join(" ")

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
  if (email) properties.email = email
  // Custom property (single-line text): excelr8_profile_url - used for dedupe when email is missing.
  if (profileUrl && canUseProfileUrlProperty) properties[PROFILE_URL_PROPERTY] = profileUrl
  const mappedStatus = mapLeadStatusToHubSpot(lead.status)
  if (mappedStatus) properties.hs_lead_status = mappedStatus

  // Clay company intelligence + core scores -> custom contact properties (opt-in).
  if (getHubSpotSyncCompanyProps() && canUseCompanyProps) {
    const setText = (key: string, val: unknown) => {
      const s = val == null ? "" : Array.isArray(val) ? val.join(", ") : String(val)
      if (s.trim()) properties[key] = s.trim().slice(0, 65535)
    }
    const setNum = (key: string, val: unknown) => {
      const n = typeof val === "number" ? val : val != null && val !== "" && Number.isFinite(Number(val)) ? Number(val) : null
      if (n != null) properties[key] = String(n)
    }
    const ci = lead.company_info
    if (ci) {
      setText("excelr8_company_industry", ci.industry)
      setText("excelr8_company_segment", ci.segment)
      setText("excelr8_company_type", ci.type)
      setText("excelr8_company_employee_range", ci.employee_range)
      setNum("excelr8_company_employee_count", ci.employee_count)
      setNum("excelr8_company_year_founded", ci.year_founded)
      setText("excelr8_company_specialties", ci.specialties)
      setText("excelr8_sales_navigator_url", ci.sales_navigator_url)
    }
    const sc = lead.icp_scores
    if (sc) {
      setNum("excelr8_priority_score", sc.priority_score)
      setNum("excelr8_icp_risk_score", sc.icp_risk_score)
    }
  }
  return properties
}

/**
 * Send a contact create/update; on PROPERTY_DOESNT_EXIST for excelr8_* custom props,
 * strip the missing props (and disable that group for the rest of the sync) and retry once.
 */
async function sendContactRequest(
  url: string,
  method: "POST" | "PATCH",
  properties: Record<string, string>
): Promise<{ ok: boolean; status: number; id?: string; errorText?: string }> {
  const doFetch = () =>
    fetch(url, { method, headers: getHeaders(), body: JSON.stringify({ properties }) })

  let res = await doFetch()
  if (!res.ok) {
    const errText = await res.text()
    const missing = extractMissingExcelr8Properties(errText)
    let stripped = false
    for (const p of missing) {
      if (Object.prototype.hasOwnProperty.call(properties, p)) {
        delete properties[p]
        stripped = true
      }
      noteDisabledProperty(p)
    }
    if (!stripped) return { ok: false, status: res.status, errorText: errText }
    res = await doFetch()
    if (!res.ok) {
      const retryErr = await res.text()
      return { ok: false, status: res.status, errorText: retryErr }
    }
  }
  const data = (await res.json()) as { id: string }
  return { ok: true, status: res.status, id: data.id }
}

/** Create or update a HubSpot contact from a lead. Returns HubSpot contact id. */
export async function upsertContact(lead: LeadForHubSpot): Promise<string> {
  const email = (lead.email ?? "").trim()
  const profileUrl = (lead.profile_url ?? "").trim()
  const properties = buildContactProperties(lead)

  let existingId = email ? await findContactByEmail(email) : null
  if (!existingId && !email && profileUrl && canUseProfileUrlProperty) {
    // Fallback: try to find by LinkedIn/profile URL when we don't have email.
    try {
      const byProfile = await findContactByProfileUrl(profileUrl)
      if (byProfile) existingId = byProfile
    } catch {
      // If the custom property doesn't exist yet or search fails, ignore and create a new contact.
    }
  }

  if (existingId) {
    const r = await sendContactRequest(`${getApiBase()}/crm/v3/objects/contacts/${existingId}`, "PATCH", properties)
    if (!r.ok) throw new Error(`HubSpot contact update failed: ${r.status} ${r.errorText}`)
    return existingId
  }

  const r = await sendContactRequest(`${getApiBase()}/crm/v3/objects/contacts`, "POST", properties)
  if (!r.ok) throw new Error(`HubSpot contact create failed: ${r.status} ${r.errorText}`)
  return r.id as string
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
  if (!url?.trim() || !canUseProfileUrlProperty) return null
  const res = await fetch(`${getApiBase()}/crm/v3/objects/contacts/search`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      filterGroups: [
        {
          filters: [
            { propertyName: PROFILE_URL_PROPERTY, operator: "EQ", value: url.trim() },
          ],
        },
      ],
      properties: [PROFILE_URL_PROPERTY],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    if (extractMissingExcelr8Properties(err).includes(PROFILE_URL_PROPERTY)) {
      canUseProfileUrlProperty = false
      return null
    }
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
    const updateRes = await fetch(`${getApiBase()}/crm/v3/objects/deals/${existingId}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(body),
    })
    if (!updateRes.ok) {
      const err = await updateRes.text()
      throw new Error(`HubSpot deal update failed: ${updateRes.status} ${err}`)
    }
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
    const body: {
      filterGroups: Array<{
        filters: Array<{ propertyName: string; operator: string; value: string }>
      }>
      properties: string[]
      limit: number
      after?: string
    } = {
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
