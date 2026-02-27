import { NextResponse } from "next/server"
import OpenAI from "openai"
import { getOpenAiApiKey } from "@/lib/env"
import { getR2ObjectBody } from "@/lib/r2"
import { getToneDetails } from "@/lib/newsletter-tone"
import { getContentPrompt, getHtmlPrompt, buildImagePrompt } from "@/lib/newsletter-prompts"
import {
  formatArticlesForPrompt,
  parseContentResponse,
  cleanHtml,
  buildRunDoc,
} from "@/lib/newsletter-pipeline"
import { createClient } from "@/lib/supabase"
import { getSupabaseUrl } from "@/lib/env"

export const maxDuration = 300

type Checkpoint =
  | "files_fetched"
  | "tone_selected"
  | "ai_content_sent"
  | "ai_content_response"
  | "images_generated"
  | "final_html_sent"

function streamLine(
  controller: ReadableStreamDefaultController<Uint8Array>,
  obj: Record<string, unknown>
) {
  controller.enqueue(
    new TextEncoder().encode(JSON.stringify(obj) + "\n")
  )
}

export async function POST(req: Request) {
  const apiKey = getOpenAiApiKey()
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not set" },
      { status: 500 }
    )
  }

  let body: {
    date: string
    selectedKeys: string[]
    tone: string
    customToneText?: string
    customImagePrompt?: string
    customHtmlPrompt?: string
    origin?: string
    imageModel?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { date, selectedKeys, tone, customToneText, customImagePrompt, customHtmlPrompt, origin, imageModel } = body
  const selectedImageModel = imageModel === "gpt-image-1" ? "gpt-image-1" : "dall-e-3"
  if (!date || !Array.isArray(selectedKeys) || selectedKeys.length === 0 || !tone) {
    return NextResponse.json(
      { error: "Missing date, selectedKeys, or tone" },
      { status: 400 }
    )
  }

  const runId = `run-${Date.now()}`

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // --- Files fetched ---
        const items: { key: string; body: string }[] = []
        for (const key of selectedKeys) {
          const bodyText = await getR2ObjectBody(key)
          items.push({ key, body: bodyText })
        }
        streamLine(controller, { checkpoint: "files_fetched" })

        // --- Tone ---
        const { tone_name: toneName, tone_details: toneDetails } = getToneDetails(
          tone,
          customToneText
        )
        streamLine(controller, {
          checkpoint: "tone_selected",
          toneName,
          toneDetails,
        })

        const formattedArticles = formatArticlesForPrompt(items)
        const contentPrompt = getContentPrompt(formattedArticles)

        // --- Content AI ---
        streamLine(controller, {
          checkpoint: "ai_content_sent",
          contentPrompt,
        })
        const openai = new OpenAI({ apiKey })
        const contentCompletion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: contentPrompt }],
          max_tokens: 4096,
        })
        const contentRaw =
          contentCompletion.choices[0]?.message?.content ?? ""
        let contentParsed: ReturnType<typeof parseContentResponse>
        try {
          contentParsed = parseContentResponse(contentRaw)
        } catch (e) {
          streamLine(controller, {
            error: "Content JSON parse failed",
            detail: e instanceof Error ? e.message : String(e),
          })
          controller.close()
          return
        }
        streamLine(controller, {
          checkpoint: "ai_content_response",
          contentResponse: contentRaw,
          contentParsed: {
            newsletter_headline: contentParsed.newsletter_headline,
            subject_line: contentParsed.subject_line,
            pre_header_text: contentParsed.pre_header_text,
            top_stories: contentParsed.top_stories,
            selection_reasoning: contentParsed.selection_reasoning,
          },
        })

        const topStories = contentParsed.top_stories ?? []
        const imagePrompts: Array<{ title: string; summary: string; prompt: string }> = []
        const imageTags: string[] = []
        const imageUrlsOrBase64: string[] = []
        const supabaseUrl = getSupabaseUrl()

        for (let i = 0; i < topStories.length; i++) {
          const story = topStories[i]
          const title = (story.title ?? "Story") as string
          const summary = (story.summary ?? "") as string
          const prompt = buildImagePrompt(title, summary, customImagePrompt)
          imagePrompts.push({ title, summary, prompt })

          try {
            const isDallE = selectedImageModel === "dall-e-3"
            const imgOptions: Parameters<OpenAI["images"]["generate"]>[0] = isDallE
              ? {
                  model: "dall-e-3",
                  prompt,
                  n: 1,
                  size: "1792x1024",
                  response_format: "url",
                  quality: "standard",
                }
              : {
                  model: "gpt-image-1",
                  prompt,
                  n: 1,
                  size: "1536x1024",
                  quality: "high",
                }
            const imgRes = await openai.images.generate(imgOptions)
            const data = "data" in imgRes && Array.isArray(imgRes.data) ? imgRes.data : []
            const first = data[0]
            const imageUrl = first?.url
            const b64 = first && "b64_json" in first ? (first as { b64_json?: string }).b64_json : undefined

            let publicUrl: string
            if (imageUrl) {
              publicUrl = imageUrl
            } else if (b64) {
              publicUrl = `data:image/png;base64,${b64}`
            } else {
              imageTags.push("")
              imageUrlsOrBase64.push("")
              continue
            }
            // Upload to Supabase for persistent URL (optional)
            try {
              const supabase = createClient()
              const bucket = "newsletter-images"
              const path = `${runId}/${i}-${Date.now()}.png`
              let buf: Buffer
              if (publicUrl.startsWith("data:")) {
                const base64 = publicUrl.split(",")[1]
                buf = base64 ? Buffer.from(base64, "base64") : Buffer.from([])
              } else {
                const imageResp = await fetch(publicUrl)
                buf = Buffer.from(await imageResp.arrayBuffer())
              }
              if (buf.length > 0) {
                const { error } = await supabase.storage
                  .from(bucket)
                  .upload(path, buf, { contentType: "image/png", upsert: true })
                if (!error && supabaseUrl) {
                  publicUrl = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${path}`
                }
              }
            } catch {
              // Keep existing publicUrl if Supabase upload fails
            }

            imageUrlsOrBase64.push(publicUrl)
            const tag = `<img src="${publicUrl}" alt="${title}" style="max-width:100%;height:auto;" />`
            imageTags.push(tag)
          } catch (e) {
            imageTags.push("")
            imageUrlsOrBase64.push("")
          }
        }

        streamLine(controller, {
          checkpoint: "images_generated",
          imageUrls: imageUrlsOrBase64,
          imagePrompts: imagePrompts.map((p) => ({ title: p.title, summary: p.summary })),
        })

        const allImageTags = imageTags.filter(Boolean).join(",")
        const topStoriesSegmentMarkdown = topStories
          .map((s) => (s.segment_markdown ?? "").trim())
          .filter(Boolean)
          .join("\n\n<<<STORY>>>\n\n")

        const htmlPrompt = getHtmlPrompt({
          newsletterHeadline: contentParsed.newsletter_headline ?? "",
          subjectLine: contentParsed.subject_line ?? "",
          preHeaderText: contentParsed.pre_header_text ?? "",
          topStoriesSegmentMarkdown,
          allImageTags: allImageTags,
          tone,
          toneName,
          toneDetails,
          customHtmlPrompt: customHtmlPrompt?.trim() || undefined,
        })

        streamLine(controller, {
          checkpoint: "final_html_sent",
          htmlPrompt,
        })

        const htmlCompletion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: htmlPrompt }],
          max_tokens: 16000,
        })
        const htmlRaw = htmlCompletion.choices[0]?.message?.content ?? ""
        const htmlCleaned = cleanHtml(htmlRaw)

        const runDoc = buildRunDoc({
          runId,
          date,
          selectedKeys,
          tone,
          toneName,
          toneDetails,
          contentPrompt,
          contentResponse: contentRaw,
          contentParsed,
          imagePrompts,
          imageUrlsOrBase64,
          htmlPrompt,
          htmlRaw,
          htmlCleaned,
        })

        // Save run doc to local folder (project root / newsletter-runs)
        try {
          const fs = await import("fs")
          const path = await import("path")
          const dir = path.join(process.cwd(), "newsletter-runs")
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
          }
          const filePath = path.join(dir, `${runId}.md`)
          fs.writeFileSync(filePath, runDoc, "utf-8")
        } catch {
          // Ignore (e.g. read-only filesystem on Vercel)
        }

        streamLine(controller, { html: htmlCleaned, runDoc, runId })
      } catch (err) {
        streamLine(controller, {
          error: err instanceof Error ? err.message : String(err),
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    },
  })
}
