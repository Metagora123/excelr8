/**
 * Format raw markdown bodies (from R2 keys) into the article string for the content AI.
 * Simpler than n8n News Formatter: we only have key + body, no metadata.
 */
export function formatArticlesForPrompt(
  items: { key: string; body: string }[]
): string {
  let out = ""
  items.forEach((item, index) => {
    const n = index + 1
    out += `STORY ${n}\n`
    out += "=".repeat(80) + "\n\n"
    out += `Title: ${item.key}\n`
    out += `Source: ${item.key}\n\n`
    out += `${item.body}\n\n`
    out += "-".repeat(80) + "\n\n\n"
  })
  return out
}

/**
 * Parse AI content response: strip code fences and parse JSON.
 */
export function parseContentResponse(raw: string): {
  newsletter_headline?: string
  subject_line?: string
  pre_header_text?: string
  top_stories?: Array<{
    story_number: number
    title: string
    summary: string
    segment_markdown?: string
    [key: string]: unknown
  }>
  selection_reasoning?: unknown
} {
  const s = raw
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim()
  const parsed = JSON.parse(s) as Record<string, unknown>
  return {
    newsletter_headline: parsed.newsletter_headline as string | undefined,
    subject_line: parsed.subject_line as string | undefined,
    pre_header_text: parsed.pre_header_text as string | undefined,
    top_stories: parsed.top_stories as typeof parseContentResponse.prototype.top_stories,
    selection_reasoning: parsed.selection_reasoning,
  }
}

/**
 * Clean HTML from AI: remove markdown fences, take only up to </html>.
 */
export function cleanHtml(raw: string): string {
  let html = (raw || "").trim()
  html = html.replace(/^```html?\s*/i, "").replace(/```\s*$/g, "")
  const end = html.lastIndexOf("</html>")
  if (end !== -1) html = html.slice(0, end + 7)
  return html.replace(/```[\s\S]*$/g, "").trim()
}

/**
 * Build run documentation markdown for a single run.
 */
export function buildRunDoc(params: {
  runId: string
  date: string
  selectedKeys: string[]
  tone: string
  toneName: string
  toneDetails: string
  contentPrompt: string
  contentResponse: string
  contentParsed: unknown
  imagePrompts: Array<{ title: string; summary: string; prompt: string }>
  imageUrlsOrBase64: string[]
  htmlPrompt: string
  htmlRaw: string
  htmlCleaned: string
}): string {
  const d = new Date().toISOString()
  let md = `# Newsletter Run: ${params.runId}\n\n`
  md += `**Generated:** ${d}\n\n`
  md += `## Config\n\n`
  md += `- **Date:** ${params.date}\n`
  md += `- **Selected files:** ${params.selectedKeys.length}\n`
  params.selectedKeys.forEach((k) => {
    md += `  - \`${k}\`\n`
  })
  md += `- **Tone:** ${params.tone}\n`
  md += `- **Tone name:** ${params.toneName}\n\n`
  md += `### Tone details\n\n\`\`\`\n${params.toneDetails}\n\`\`\`\n\n`

  md += `---\n\n## Content AI\n\n### Prompt (exact)\n\n\`\`\`\n${params.contentPrompt}\n\`\`\`\n\n`
  md += `### Raw response\n\n\`\`\`\n${params.contentResponse}\n\`\`\`\n\n`
  md += `### Parsed (JSON)\n\n\`\`\`json\n${JSON.stringify(params.contentParsed, null, 2)}\n\`\`\`\n\n`

  md += `---\n\n## Images\n\n`
  params.imagePrompts.forEach((img, i) => {
    md += `### Story ${i + 1}: ${img.title}\n\n`
    md += `**Summary:** ${img.summary}\n\n`
    md += `**Image prompt:**\n\`\`\`\n${img.prompt}\n\`\`\`\n\n`
    const url = params.imageUrlsOrBase64[i]
    if (url) {
      if (url.startsWith("data:")) {
        md += `**Image:** (inline base64, ${url.length} chars)\n\n`
      } else {
        md += `**Image URL:** ${url}\n\n`
      }
    }
  })

  md += `---\n\n## HTML AI\n\n### Prompt (exact)\n\n\`\`\`\n${params.htmlPrompt}\n\`\`\`\n\n`
  md += `### Raw response\n\n\`\`\`\n${params.htmlRaw.slice(0, 5000)}${params.htmlRaw.length > 5000 ? "\n...(truncated)" : ""}\n\`\`\`\n\n`
  md += `### Cleaned HTML length\n\n${params.htmlCleaned.length} characters.\n\n`
  md += `---\n\n*End of run document.*\n`
  return md
}
