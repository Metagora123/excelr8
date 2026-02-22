import { NextResponse } from "next/server"
import { getOpenAiApiKey } from "@/lib/env"

export type IcpConfig = {
  companySize?: string[]
  industries?: string[]
  jobTitles?: string[]
  locations?: string[]
  revenueRange?: string[]
  techStack?: string[]
  additionalCriteria?: string
}

export type IcpPersonInput = {
  index: number
  name: string
  headline?: string
  profile_url?: string
  type: "commentator" | "reactioner"
}

export type IcpMatchResult = {
  matchScore: number
  reasoning: string
  matchedCriteria: string[]
}

function buildIcpCriteriaString(config: IcpConfig): string {
  const parts: string[] = []
  if (config.companySize?.length) parts.push(`Company size: ${config.companySize.join(", ")}`)
  if (config.industries?.length) parts.push(`Industries: ${config.industries.join(", ")}`)
  if (config.jobTitles?.length) parts.push(`Job titles: ${config.jobTitles.join(", ")}`)
  if (config.locations?.length) parts.push(`Locations: ${config.locations.join(", ")}`)
  if (config.revenueRange?.length) parts.push(`Revenue range: ${config.revenueRange.join(", ")}`)
  if (config.techStack?.length) parts.push(`Tech stack: ${config.techStack.join(", ")}`)
  if (config.additionalCriteria?.trim()) parts.push(`Additional: ${config.additionalCriteria.trim()}`)
  return parts.join(". ") || "No specific criteria; score based on relevance to B2B sales and leadership."
}

/** POST: body { icpConfig, people: IcpPersonInput[], batchSize?: number }.
 * Returns { matchResults: Record<string, IcpMatchResult> } keyed by profile_url or "index:N".
 */
export async function POST(req: Request) {
  try {
    const apiKey = getOpenAiApiKey()
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured. Set OPENAI_API_KEY or VITE_OPENAI_API_KEY." },
        { status: 503 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const icpConfig = body.icpConfig as IcpConfig | undefined
    const people = Array.isArray(body.people) ? body.people as IcpPersonInput[] : []
    const batchSize = Math.min(Math.max(Number(body.batchSize) || 20, 1), 50)

    if (!people.length) {
      return NextResponse.json({ matchResults: {} })
    }

    const criteria = buildIcpCriteriaString(icpConfig ?? {})

    const resultsByKey: Record<string, IcpMatchResult> = {}

    for (let start = 0; start < people.length; start += batchSize) {
      const batch = people.slice(start, start + batchSize)
      const batchPeopleJson = JSON.stringify(
        batch.map((p) => ({
          index: p.index,
          name: p.name,
          headline: p.headline ?? "",
          profile_url: p.profile_url ?? "",
          type: p.type,
        }))
      )

      const systemPrompt = `You are an expert at matching B2B leads to an Ideal Customer Profile (ICP). Given a list of people (commentators or reactioners on a LinkedIn post), score each person from 0 to 100 on how well they match the ICP criteria. Return only valid JSON with no markdown or extra text.`
      const userPrompt = `ICP criteria:\n${criteria}\n\nPeople to score (JSON array):\n${batchPeopleJson}\n\nReturn a JSON object with a single key "results" which is an array of objects, one per person, with: "index" (number, the person's index), "matchScore" (0-100), "reasoning" (short string), "matchedCriteria" (array of strings - which criteria they matched).`

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        return NextResponse.json(
          { error: `OpenAI API error: ${res.status} ${errText}` },
          { status: 502 }
        )
      }

      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
      const content = data.choices?.[0]?.message?.content
      if (!content) {
        return NextResponse.json({ error: "Empty response from OpenAI" }, { status: 502 })
      }

      let parsed: { results?: { index: number; matchScore: number; reasoning: string; matchedCriteria: string[] }[] }
      try {
        parsed = JSON.parse(content) as { results?: { index: number; matchScore: number; reasoning: string; matchedCriteria: string[] }[] }
      } catch {
        return NextResponse.json({ error: "Invalid JSON from OpenAI" }, { status: 502 })
      }

      const results = Array.isArray(parsed.results) ? parsed.results : []
      for (const r of results) {
        const person = batch.find((p) => p.index === r.index) ?? batch[results.indexOf(r)]
        const key = (person?.profile_url && person.profile_url.trim()) ? person.profile_url : `index:${r.index}`
        const score = Math.max(0, Math.min(100, Number(r.matchScore) || 0))
        resultsByKey[key] = {
          matchScore: score,
          reasoning: String(r.reasoning ?? ""),
          matchedCriteria: Array.isArray(r.matchedCriteria) ? r.matchedCriteria : [],
        }
      }
    }

    return NextResponse.json({ matchResults: resultsByKey })
  } catch (err) {
    console.error("Radar ICP API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ICP filter failed" },
      { status: 500 }
    )
  }
}
