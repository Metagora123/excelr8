/**
 * Generate 4 comments (A–D) for a LinkedIn post using OpenAI.
 * Used by Auto Like / Auto Comment automation.
 */

import { getOpenAiApiKey } from "@/lib/env"
import {
  AUTO_COMMENT_SYSTEM_PROMPT,
  buildAutoCommentUserPrompt,
} from "@/lib/auto-comment-prompts"

export type GenerateCommentsResult =
  | { ok: true; comment_a: string; comment_b: string; comment_c: string; comment_d: string }
  | { ok: false; error: string }

export async function generate4Comments(postContent: string): Promise<GenerateCommentsResult> {
  const apiKey = getOpenAiApiKey()
  if (!apiKey) {
    return { ok: false, error: "OPENAI_API_KEY not set" }
  }

  const userPrompt = buildAutoCommentUserPrompt(postContent)

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: AUTO_COMMENT_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 800,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    let errJson: { error?: { message?: string } } = {}
    try {
      errJson = JSON.parse(errText)
    } catch {
      //
    }
    const message = errJson?.error?.message ?? errText.slice(0, 300)
    return { ok: false, error: `OpenAI ${res.status}: ${message}` }
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data?.choices?.[0]?.message?.content?.trim()
  if (!content) {
    return { ok: false, error: "Empty response from OpenAI" }
  }

  // Strip markdown code fence if present
  const raw = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()
  let parsed: { comment_a?: string; comment_b?: string; comment_c?: string; comment_d?: string }
  try {
    parsed = JSON.parse(raw) as typeof parsed
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` }
  }

  const a = parsed.comment_a != null ? String(parsed.comment_a).trim() : ""
  const b = parsed.comment_b != null ? String(parsed.comment_b).trim() : ""
  const c = parsed.comment_c != null ? String(parsed.comment_c).trim() : ""
  const d = parsed.comment_d != null ? String(parsed.comment_d).trim() : ""

  if (!a || !b || !c || !d) {
    return { ok: false, error: "Response missing one or more comment_a/b/c/d" }
  }

  return { ok: true, comment_a: a, comment_b: b, comment_c: c, comment_d: d }
}
