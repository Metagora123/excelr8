import { NextResponse } from "next/server"
import { getSendGridApiKey, getSendGridFromEmail, getSendGridFromName } from "@/lib/env"

function base64Encode(str: string): string {
  return Buffer.from(str, "utf-8").toString("base64")
}

export async function POST(req: Request) {
  try {
    const apiKey = getSendGridApiKey()
    if (!apiKey) {
      return NextResponse.json({ error: "SENDGRID_API_KEY not set" }, { status: 500 })
    }

    const body = await req.json().catch(() => ({})) as {
      to: string[]
      sendRunDoc?: boolean
      sendHtmlAttachment?: boolean
      sendHtmlBody?: boolean
      html?: string
      runDoc?: string
      date?: string
    }

    const {
      to,
      sendRunDoc = false,
      sendHtmlAttachment = false,
      sendHtmlBody = false,
      html = "",
      runDoc = "",
      date = "",
    } = body

    if (!Array.isArray(to) || to.length === 0) {
      return NextResponse.json({ error: "Missing or empty 'to' (recipients)" }, { status: 400 })
    }

    const validTo = to.filter((e) => typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()))
    if (validTo.length === 0) {
      return NextResponse.json({ error: "No valid email addresses in 'to'" }, { status: 400 })
    }

    if (!sendRunDoc && !sendHtmlAttachment && !sendHtmlBody) {
      return NextResponse.json(
        { error: "At least one of sendRunDoc, sendHtmlAttachment, sendHtmlBody must be true" },
        { status: 400 }
      )
    }

    const fromEmail = getSendGridFromEmail()
    const fromName = getSendGridFromName()
    const subject = date ? `Newsletter ${date}` : "Newsletter"

    const attachments: { content: string; filename: string; type: string }[] = []
    if (sendRunDoc && runDoc) {
      attachments.push({
        content: base64Encode(runDoc),
        filename: date ? `newsletter-run-${date}.md` : "newsletter-run.md",
        type: "text/markdown",
      })
    }
    if (sendHtmlAttachment && html) {
      attachments.push({
        content: base64Encode(html),
        filename: date ? `newsletter-${date}.html` : "newsletter.html",
        type: "text/html",
      })
    }

    const content: { type: string; value: string }[] = []
    if (sendHtmlBody && html) {
      content.push({ type: "text/html", value: html })
    } else if (attachments.length > 0) {
      content.push({
        type: "text/plain",
        value: "Please see the attached file(s).",
      })
    } else {
      content.push({ type: "text/plain", value: "Newsletter." })
    }

    const payload = {
      personalizations: [{ to: validTo.map((email) => ({ email: email.trim() })) }],
      from: { email: fromEmail, name: fromName },
      subject,
      content,
      ...(attachments.length > 0 && { attachments }),
    }

    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text()
      const isAuthError = res.status === 401 || res.status === 403
      if (isAuthError) {
        const prefix = apiKey.slice(0, 6)
        console.warn("[newsletter/send] SendGrid 401/403: key present, prefix:", prefix + "…")
      }
      const message = isAuthError
        ? "SendGrid rejected the key. The app loads .env at startup—restart the Next.js dev server (stop and run npm run dev again) so it picks up SENDGRID_API_KEY. If you use .env.local, set SENDGRID_API_KEY there too (it overrides .env). Then run: node scripts/test-sendgrid.js"
        : "SendGrid error"
      return NextResponse.json(
        { error: message, detail: text },
        { status: isAuthError ? 401 : 502 }
      )
    }

    return NextResponse.json({ ok: true, sentTo: validTo.length })
  } catch (err) {
    console.error("Newsletter send API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed" },
      { status: 500 }
    )
  }
}
