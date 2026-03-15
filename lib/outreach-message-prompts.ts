/**
 * Prompt for generating 3 personalized outreach messages (Message_1, Message_2, Message_3)
 * for campaign hitlist leads. Used by campaign automations with Supabase leads + lead_posts context.
 */

export type OutreachPromptVariables = {
  fullName: string
  company: string
  jobTitle: string
  location: string
  companyDomain: string
  headline: string
  linkedInUrl: string
  numFollowers: string
  aboutSummary?: string
  /** Recent posts from lead_posts (content snippets) for context. */
  recentPostsContext?: string
}

const SYSTEM_PROMPT = `You are an expert at writing personalized, contextual outreach messages for business professionals.

Write THREE short, personalized introductory message variations (2-3 sentences maximum each) for the following lead. Each message should:
- Be warm and professional
- Reference something specific from their background or company
- Provide context for what you do in ONE clear sentence
- DO NOT ask for a meeting in this first email - instead, ask if they'd be interested or open to learning more
- Be written in a language and tone appropriate for their location
- Avoid being overly salesy or generic
- Focus on providing value and solving a pain point, not just pitching
- Build curiosity and rapport as this is the first touchpoint

Message Type: INITIAL_COLD_OUTREACH (Day 1 - First touchpoint)

Tone Guidelines for Initial Outreach:
- Curious and helpful, focused on their challenges
- Lead with value, not product features
- Reference a specific pain point relevant to their industry/role
- Explain what you do in one simple, clear sentence
- End by asking for INTEREST, not a meeting (e.g., "Would this be interesting to you?" or "Would you be open to learning more?")
- Keep it conversational - write like a human, not a marketing bot
- AVOID phrases like: "schedule a call", "book a meeting", "demo", "quick chat"
- USE phrases like: "would this interest you?", "curious if this resonates?", "worth exploring?"

Language Guidelines:
- If location contains "France" or French-speaking region: Write in French
- If location contains "Spain" or Spanish-speaking region: Write in Spanish
- If location contains "Germany" or German-speaking region: Write in German
- Default: Write in English for all other locations

Return ONLY valid JSON with no markdown or extra text. Format:
{ "message_1": "...", "message_2": "...", "message_3": "..." }
Each value must be the full message text (2-3 sentences). Generate three distinct variations that feel human, relevant, and show you've done your research.`

export function buildOutreachUserPrompt(v: OutreachPromptVariables): string {
  let block = `Lead Information:
- Full Name: ${v.fullName}
- Company: ${v.company}
- Job Title/Description: ${v.jobTitle}
- Location: ${v.location}
- Company Domain: ${v.companyDomain}
- Headline: ${v.headline}
- LinkedIn Profile: ${v.linkedInUrl}
- Number of Followers: ${v.numFollowers}
`
  if (v.aboutSummary?.trim()) {
    block += `- About / Summary: ${v.aboutSummary.trim().slice(0, 800)}\n`
  }
  if (v.recentPostsContext?.trim()) {
    block += `\nRecent LinkedIn activity (use for personalization if relevant):\n${v.recentPostsContext.trim().slice(0, 1500)}\n`
  }
  block += `

Generate three personalized message variations (message_1, message_2, message_3) that feel human, relevant, and show you've done your research. Return only the JSON object.`
  return block
}

export { SYSTEM_PROMPT }
