/**
 * Generate Message_1, Message_2, Message_3 for campaign hitlist leads using
 * Supabase leads + lead_posts and OpenAI. Used inside campaign automations.
 */

import { createClient, type SupabaseProject } from "@/lib/supabase"
import { getOpenAiApiKey } from "@/lib/env"
import { resolveIdentifierFromProfileUrl } from "@/lib/enrichment-engine"
import {
  buildOutreachUserPrompt,
  SYSTEM_PROMPT,
  type OutreachPromptVariables,
} from "@/lib/outreach-message-prompts"

export type AirtableRecordFields = Record<string, unknown>

/** Get string from Airtable record (supports "Location_Name" or "Location Name" style). */
function field(fields: AirtableRecordFields, ...keys: string[]): string {
  for (const k of keys) {
    const v = fields[k]
    if (v != null && String(v).trim() !== "") return String(v).trim()
  }
  return ""
}

/** Fetch lead by profile_url (match by LinkedIn identifier). */
export async function getLeadByProfileUrl(
  project: SupabaseProject,
  profileUrl: string
): Promise<{ id: string; about_summary?: string | null; [k: string]: unknown } | null> {
  const { identifier } = resolveIdentifierFromProfileUrl(profileUrl)
  if (!identifier) return null
  const supabase = createClient(project)
  const { data, error } = await supabase
    .from("leads")
    .select("id, full_name, title, company_name, expertise, about_summary, location, profile_url, followers_count")
    .ilike("profile_url", `%${identifier}%`)
    .limit(2)
  if (error || !data?.length) return null
  const normalizedInput = (profileUrl || "").trim().toLowerCase().replace(/\/$/, "")
  const lead = (data as Array<{ id: string; profile_url?: string | null; about_summary?: string | null; [k: string]: unknown }>).find(
    (r) => (r.profile_url || "").toLowerCase().replace(/\/$/, "") === normalizedInput || (r.profile_url || "").toLowerCase().includes(identifier)
  )
  return lead ?? (data[0] as { id: string; about_summary?: string | null; [k: string]: unknown })
}

/** Fetch lead_posts for a lead (content for context). */
export async function getLeadPostsContext(
  project: SupabaseProject,
  leadId: string,
  maxPosts = 5
): Promise<string> {
  const supabase = createClient(project)
  const { data, error } = await supabase
    .from("lead_posts")
    .select("content, topic, reactions, comments")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(maxPosts)
  if (error || !data?.length) return ""
  return data
    .map((p) => {
      const content = (p.content || "").toString().trim().slice(0, 400)
      const topic = (p.topic || "").toString().trim()
      const meta = [topic, (p.reactions != null ? `${p.reactions} reactions` : ""), (p.comments != null ? `${p.comments} comments` : "")].filter(Boolean).join(" · ")
      return meta ? `[${meta}]\n${content}` : content
    })
    .filter(Boolean)
    .join("\n\n---\n\n")
}

export type GenerateOutreachMessagesInput = {
  project: SupabaseProject
  airtableFields: AirtableRecordFields
  /** If provided, we fetch about_summary and lead_posts for context. */
  leadId?: string | null
}

export type GenerateOutreachMessagesResult =
  | { ok: true; message_1: string; message_2: string; message_3: string }
  | { ok: false; error: string }

/**
 * Generate 3 outreach messages for a hitlist record using Airtable fields +
 * optional Supabase lead and lead_posts. Calls OpenAI; returns the three messages or error.
 */
export async function generateOutreachMessages(
  input: GenerateOutreachMessagesInput
): Promise<GenerateOutreachMessagesResult> {
  const apiKey = getOpenAiApiKey()
  if (!apiKey?.trim()) {
    return { ok: false, error: "OPENAI_API_KEY not set" }
  }

  const f = input.airtableFields
  const fullName = field(f, "Name", "Enrich_person", "full_name")
  const company = field(f, "Org", "Company_Experience", "company_name")
  const jobTitle = field(f, "Title", "Title_Experience", "title")
  const location = field(f, "Location_Name", "Location Name", "location")
  const companyDomain = field(f, "Company_Domain", "Company Domain", "company_domain")
  const headline = field(f, "Headline", "headline", "expertise")
  const linkedInUrl = field(f, "LinkedIn", "Linkedin_Profile", "profile_url", "URL")
  const numFollowers = field(f, "Num_Followers", "Num Followers", "followers_count") || "0"

  let aboutSummary: string | undefined
  let recentPostsContext: string | undefined
  if (input.leadId) {
    const supabase = createClient(input.project)
    const { data: leadRow } = await supabase
      .from("leads")
      .select("about_summary")
      .eq("id", input.leadId)
      .single()
    if (leadRow?.about_summary) aboutSummary = String(leadRow.about_summary).trim()
    recentPostsContext = await getLeadPostsContext(input.project, input.leadId)
  }

  const variables: OutreachPromptVariables = {
    fullName: fullName || "—",
    company: company || "—",
    jobTitle: jobTitle || "—",
    location: location || "—",
    companyDomain: companyDomain || "—",
    headline: headline || "—",
    linkedInUrl: linkedInUrl || "—",
    numFollowers,
    aboutSummary: aboutSummary || undefined,
    recentPostsContext: recentPostsContext || undefined,
  }

  const userPrompt = buildOutreachUserPrompt(variables)

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return { ok: false, error: `OpenAI ${res.status}: ${errText.slice(0, 300)}` }
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const content = data.choices?.[0]?.message?.content
    if (!content?.trim()) {
      return { ok: false, error: "OpenAI returned empty content" }
    }

    const parsed = JSON.parse(content) as Record<string, unknown>
    const message_1 = String(parsed.message_1 ?? "").trim()
    const message_2 = String(parsed.message_2 ?? "").trim()
    const message_3 = String(parsed.message_3 ?? "").trim()
    if (!message_1 || !message_2 || !message_3) {
      return { ok: false, error: "OpenAI response missing message_1, message_2, or message_3" }
    }

    return { ok: true, message_1, message_2, message_3 }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
