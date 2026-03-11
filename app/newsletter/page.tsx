"use client"

import * as React from "react"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { MailIcon, CopyIcon, CheckIcon, FileTextIcon, DownloadIcon, CheckCircle2Icon, CircleIcon, XIcon, SendIcon } from "lucide-react"
import { TONE_OPTIONS } from "@/lib/newsletter-tone"
import {
  DEFAULT_IMAGE_PROMPT_PLACEHOLDER,
  DEFAULT_HTML_PROMPT_PLACEHOLDER,
  NEWSLETTER_LANGUAGES,
} from "@/lib/newsletter-prompts"

const CHECKPOINTS: { key: string; label: string }[] = [
  { key: "files_fetched", label: "Newsletter files fetched" },
  { key: "tone_selected", label: "Tone selected" },
  { key: "ai_content_sent", label: "AI Agent data sent" },
  { key: "ai_content_response", label: "AI Agent response generated" },
  { key: "images_generated", label: "Images generated" },
  { key: "final_html_sent", label: "Final HTML OpenAI node data sent" },
]

export default function NewsletterPage() {
  const [dateFolders, setDateFolders] = React.useState<string[]>([])
  const [selectedDate, setSelectedDate] = React.useState("")
  const [dateFoldersLoading, setDateFoldersLoading] = React.useState(true)
  const [filesForDate, setFilesForDate] = React.useState<string[]>([])
  const [filesLoading, setFilesLoading] = React.useState(false)
  const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(new Set())
  const [tone, setTone] = React.useState("Professional/No-Nonsense")
  const [language, setLanguage] = React.useState("English")
  const [customTone, setCustomTone] = React.useState("")
  const [endpoint, setEndpoint] = React.useState<"test" | "prod">("test")
  const [generating, setGenerating] = React.useState(false)
  const [generatedHtml, setGeneratedHtml] = React.useState("")
  const [runDoc, setRunDoc] = React.useState("")
  const [runId, setRunId] = React.useState<string | null>(null)
  const [checkpoints, setCheckpoints] = React.useState<Record<string, boolean>>({})
  const [toneUsed, setToneUsed] = React.useState<{ toneName: string; toneDetails: string } | null>(null)
  const [contentPrompt, setContentPrompt] = React.useState<string | null>(null)
  const [contentResponse, setContentResponse] = React.useState<string | null>(null)
  const [contentParsed, setContentParsed] = React.useState<Record<string, unknown> | null>(null)
  const [imageUrls, setImageUrls] = React.useState<string[]>([])
  const [imagePrompts, setImagePrompts] = React.useState<Array<{ title: string; summary: string }>>([])
  const [htmlPrompt, setHtmlPrompt] = React.useState<string | null>(null)
  const [customImagePrompt, setCustomImagePrompt] = React.useState("")
  const [customHtmlPrompt, setCustomHtmlPrompt] = React.useState("")
  const [imageModel, setImageModel] = React.useState<"dall-e-3" | "gpt-image-1">("dall-e-3")
  const [copiedPromptType, setCopiedPromptType] = React.useState<"image" | "html" | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [status, setStatus] = React.useState<string | null>(null)
  const [inlineError, setInlineError] = React.useState<string | null>(null)

  const [archiveStatus, setArchiveStatus] = React.useState<{ hasNewsletter: boolean; hasRunDoc: boolean } | null>(null)
  const [recipients, setRecipients] = React.useState<string[]>([])
  const [recipientInput, setRecipientInput] = React.useState("")
  const [sendRunDoc, setSendRunDoc] = React.useState(false)
  const [sendHtmlAttachment, setSendHtmlAttachment] = React.useState(false)
  const [sendHtmlBody, setSendHtmlBody] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [sendResult, setSendResult] = React.useState<string | null>(null)

  const [toneLegacy, setToneLegacy] = React.useState("professional")
  const [customToneLegacy, setCustomToneLegacy] = React.useState("")

  const handleGenerate = async () => {
    setGenerating(true)
    setStatus(null)
    setInlineError(null)
    setGeneratedHtml("")
    setRunDoc("")
    setRunId(null)
    setCheckpoints({})
    setToneUsed(null)
    setContentPrompt(null)
    setContentResponse(null)
    setContentParsed(null)
    setImageUrls([])
    setImagePrompts([])
    setHtmlPrompt(null)
    try {
      const res = await fetch("/api/newsletter/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint,
          tone: customToneLegacy || toneLegacy,
          customTone: customToneLegacy || undefined,
          dateFolder: selectedDate || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus(data.error || res.statusText || "Generate failed")
        return
      }
      setGeneratedHtml(data.html ?? "")
      setStatus("Generated. Copy or use the HTML below.")
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Generate failed")
    } finally {
      setGenerating(false)
    }
  }

  const handleGenerateInline = async () => {
    if (!selectedDate || selectedKeys.size === 0) {
      setInlineError("Select a date and at least one file.")
      return
    }
    setGenerating(true)
    setInlineError(null)
    setGeneratedHtml("")
    setRunDoc("")
    setRunId(null)
    setCheckpoints({})
    setToneUsed(null)
    setContentPrompt(null)
    setContentResponse(null)
    setContentParsed(null)
    setImageUrls([])
    setImagePrompts([])
    setHtmlPrompt(null)
    try {
      const res = await fetch("/api/newsletter/generate-inline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          selectedKeys: Array.from(selectedKeys),
          tone,
          customToneText: tone === "CUSTOM" ? customTone : undefined,
          customImagePrompt: customImagePrompt.trim() || undefined,
          customHtmlPrompt: customHtmlPrompt.trim() || undefined,
          imageModel,
          language,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setInlineError(data.error || res.statusText || "Generate failed")
        return
      }
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) {
        setInlineError("No response body")
        return
      }
      let buffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const obj = JSON.parse(line) as Record<string, unknown>
            if ("checkpoint" in obj) {
              setCheckpoints((prev) => ({ ...prev, [obj.checkpoint as string]: true }))
            }
            if ("toneName" in obj && "toneDetails" in obj) {
              setToneUsed({
                toneName: String(obj.toneName),
                toneDetails: String(obj.toneDetails),
              })
            }
            if ("contentPrompt" in obj && typeof obj.contentPrompt === "string") {
              setContentPrompt(obj.contentPrompt)
            }
            if ("contentResponse" in obj && typeof obj.contentResponse === "string") {
              setContentResponse(obj.contentResponse)
            }
            if ("contentParsed" in obj && obj.contentParsed !== null && typeof obj.contentParsed === "object") {
              setContentParsed(obj.contentParsed as Record<string, unknown>)
            }
            if ("imageUrls" in obj && Array.isArray(obj.imageUrls)) {
              setImageUrls(obj.imageUrls as string[])
            }
            if ("imagePrompts" in obj && Array.isArray(obj.imagePrompts)) {
              setImagePrompts(obj.imagePrompts as Array<{ title: string; summary: string }>)
            }
            if ("htmlPrompt" in obj && typeof obj.htmlPrompt === "string") {
              setHtmlPrompt(obj.htmlPrompt)
            }
            if ("html" in obj && typeof obj.html === "string") {
              setGeneratedHtml(obj.html)
            }
            if ("runDoc" in obj && typeof obj.runDoc === "string") {
              setRunDoc(obj.runDoc)
            }
            if ("runId" in obj && typeof obj.runId === "string") {
              setRunId(obj.runId)
            }
            if ("error" in obj) {
              setInlineError(String(obj.error))
            }
          } catch {
            // skip malformed line
          }
        }
      }
      if (buffer.trim()) {
        try {
          const obj = JSON.parse(buffer) as Record<string, unknown>
          if ("checkpoint" in obj) {
            setCheckpoints((prev) => ({ ...prev, [obj.checkpoint as string]: true }))
          }
          if ("toneName" in obj && "toneDetails" in obj) {
            setToneUsed({
              toneName: String(obj.toneName),
              toneDetails: String(obj.toneDetails),
            })
          }
          if ("contentPrompt" in obj && typeof obj.contentPrompt === "string") setContentPrompt(obj.contentPrompt)
          if ("contentResponse" in obj && typeof obj.contentResponse === "string") setContentResponse(obj.contentResponse)
          if ("contentParsed" in obj && obj.contentParsed !== null && typeof obj.contentParsed === "object") {
            setContentParsed(obj.contentParsed as Record<string, unknown>)
          }
          if ("imageUrls" in obj && Array.isArray(obj.imageUrls)) setImageUrls(obj.imageUrls as string[])
          if ("imagePrompts" in obj && Array.isArray(obj.imagePrompts)) {
            setImagePrompts(obj.imagePrompts as Array<{ title: string; summary: string }>)
          }
          if ("htmlPrompt" in obj && typeof obj.htmlPrompt === "string") setHtmlPrompt(obj.htmlPrompt)
          if ("html" in obj && typeof obj.html === "string") setGeneratedHtml(obj.html)
          if ("runDoc" in obj && typeof obj.runDoc === "string") setRunDoc(obj.runDoc)
          if ("runId" in obj && typeof obj.runId === "string") setRunId(obj.runId)
          if ("error" in obj) setInlineError(String(obj.error))
        } catch {
          // ignore
        }
      }
      if (selectedDate) {
        fetch(`/api/newsletter/archive?date=${encodeURIComponent(selectedDate)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data: { hasNewsletter?: boolean; hasRunDoc?: boolean } | null) => {
            if (data && typeof data.hasNewsletter === "boolean" && typeof data.hasRunDoc === "boolean") {
              setArchiveStatus({ hasNewsletter: data.hasNewsletter, hasRunDoc: data.hasRunDoc })
            }
          })
          .catch(() => {})
      }
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : "Generate failed")
    } finally {
      setGenerating(false)
    }
  }

  React.useEffect(() => {
    let cancelled = false
    setDateFoldersLoading(true)
    fetch("/api/newsletter/date-folders")
      .then((res) => (res.ok ? res.json() : []))
      .then((list: string[]) => {
        if (!cancelled && Array.isArray(list)) setDateFolders(list)
      })
      .catch(() => {
        if (!cancelled) setDateFolders([])
      })
      .finally(() => {
        if (!cancelled) setDateFoldersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!selectedDate) {
      setFilesForDate([])
      setSelectedKeys(new Set())
      return
    }
    let cancelled = false
    setFilesLoading(true)
    fetch(`/api/newsletter/files?date=${encodeURIComponent(selectedDate)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((list: string[]) => {
        if (!cancelled && Array.isArray(list)) {
          setFilesForDate(list)
          setSelectedKeys(new Set(list))
        } else if (!cancelled) {
          setFilesForDate([])
          setSelectedKeys(new Set())
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFilesForDate([])
          setSelectedKeys(new Set())
        }
      })
      .finally(() => {
        if (!cancelled) setFilesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedDate])

  React.useEffect(() => {
    if (!selectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      setArchiveStatus(null)
      return
    }
    let cancelled = false
    fetch(`/api/newsletter/archive?date=${encodeURIComponent(selectedDate)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { hasNewsletter?: boolean; hasRunDoc?: boolean } | null) => {
        if (!cancelled && data && typeof data.hasNewsletter === "boolean" && typeof data.hasRunDoc === "boolean") {
          setArchiveStatus({ hasNewsletter: data.hasNewsletter, hasRunDoc: data.hasRunDoc })
        } else if (!cancelled) {
          setArchiveStatus(null)
        }
      })
      .catch(() => {
        if (!cancelled) setArchiveStatus(null)
      })
    return () => {
      cancelled = true
    }
  }, [selectedDate])

  const toggleFile = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectAllFiles = () => {
    setSelectedKeys(new Set(filesForDate))
  }

  const deselectAllFiles = () => {
    setSelectedKeys(new Set())
  }

  const handleCopy = async () => {
    if (!generatedHtml) return
    try {
      await navigator.clipboard.writeText(generatedHtml)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setStatus("Copy failed")
    }
  }

  const downloadHtml = () => {
    if (!generatedHtml) return
    const blob = new Blob([generatedHtml], { type: "text/html" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `newsletter-${selectedDate || "export"}.html`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const downloadRunDoc = () => {
    if (!runDoc) return
    const blob = new Blob([runDoc], { type: "text/markdown" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `newsletter-run-${selectedDate || "export"}-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const downloadArchiveFile = (file: "newsletter.html" | "newsletter-run.md") => {
    if (!selectedDate) return
    const url = `/api/newsletter/archive?date=${encodeURIComponent(selectedDate)}&file=${encodeURIComponent(file)}`
    const a = document.createElement("a")
    a.href = url
    a.download = file === "newsletter.html" ? `newsletter-${selectedDate}.html` : `newsletter-run-${selectedDate}.md`
    a.target = "_blank"
    a.rel = "noopener noreferrer"
    a.click()
  }

  const parseRecipientInput = (value: string) => {
    const list = value
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0)
    const seen = new Set<string>()
    return list.filter((e) => {
      if (seen.has(e)) return false
      seen.add(e)
      return true
    })
  }

  const addRecipientsFromInput = () => {
    const next = parseRecipientInput(recipientInput)
    if (next.length === 0) return
    setRecipients((prev) => {
      const set = new Set(prev)
      next.forEach((e) => set.add(e))
      return Array.from(set)
    })
    setRecipientInput("")
  }

  const removeRecipient = (email: string) => {
    setRecipients((prev) => prev.filter((e) => e !== email))
  }

  const handleSend = async () => {
    const atLeastOne = sendRunDoc || sendHtmlAttachment || sendHtmlBody
    if (!atLeastOne || recipients.length === 0) return
    setSending(true)
    setSendResult(null)
    try {
      let html = generatedHtml
      let runDocContent = runDoc
      if ((sendHtmlBody || sendHtmlAttachment) && !html && selectedDate && archiveStatus?.hasNewsletter) {
        const r = await fetch(`/api/newsletter/archive?date=${encodeURIComponent(selectedDate)}&file=newsletter.html`)
        if (r.ok) html = await r.text()
      }
      if (sendRunDoc && !runDocContent && selectedDate && archiveStatus?.hasRunDoc) {
        const r = await fetch(`/api/newsletter/archive?date=${encodeURIComponent(selectedDate)}&file=newsletter-run.md`)
        if (r.ok) runDocContent = await r.text()
      }
      const res = await fetch("/api/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipients,
          sendRunDoc,
          sendHtmlAttachment,
          sendHtmlBody,
          html: html || "",
          runDoc: runDocContent || "",
          date: selectedDate || "",
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSendResult(data.error || data.detail || res.statusText || "Send failed")
        return
      }
      setSendResult(`Sent to ${data.sentTo ?? recipients.length} recipient(s).`)
    } catch (e) {
      setSendResult(e instanceof Error ? e.message : "Send failed")
    } finally {
      setSending(false)
    }
  }

  const copyDefaultImagePrompt = async () => {
    try {
      await navigator.clipboard.writeText(DEFAULT_IMAGE_PROMPT_PLACEHOLDER)
      setCopiedPromptType("image")
      setTimeout(() => setCopiedPromptType(null), 2000)
    } catch {
      // ignore
    }
  }

  const copyDefaultHtmlPrompt = async () => {
    try {
      await navigator.clipboard.writeText(DEFAULT_HTML_PROMPT_PLACEHOLDER)
      setCopiedPromptType("html")
      setTimeout(() => setCopiedPromptType(null), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <AppShell title="Newsletter">
      <div className="px-4 lg:px-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Newsletter</h2>
          <p className="text-muted-foreground text-sm">
            Generate newsletter via n8n (first card) or in-app with file selection and checkpoints (second card).
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Generate Newsletter (n8n)</CardTitle>
            <CardDescription>Select tone and endpoint. Sends to n8n webhook.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Date folder</Label>
                <Select
                  value={selectedDate || "_"}
                  onValueChange={(v) => setSelectedDate(v === "_" ? "" : v)}
                  disabled={dateFoldersLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={dateFoldersLoading ? "Loading…" : "Select a date folder"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">— (none)</SelectItem>
                    {dateFolders.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedDate && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Files for {selectedDate}</Label>
                  {filesLoading ? (
                    <p className="text-muted-foreground text-sm">Loading files…</p>
                  ) : filesForDate.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No files for this date.</p>
                  ) : (
                    <ul className="rounded-md border bg-muted/30 divide-y divide-border">
                      {filesForDate.map((f) => (
                        <li key={f} className="flex items-center gap-2 px-3 py-2 text-sm">
                          <FileTextIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label>Tone</Label>
                <Select value={toneLegacy} onValueChange={setToneLegacy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-tone">Custom tone (optional)</Label>
              <input
                id="custom-tone"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="e.g. concise, technical"
                value={customToneLegacy}
                onChange={(e) => setCustomToneLegacy(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Endpoint</Label>
              <Select value={endpoint} onValueChange={(v) => setEndpoint(v as "test" | "prod")}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="test">Test</SelectItem>
                  <SelectItem value="prod">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerate} disabled={generating}>
              <MailIcon className="mr-2 h-4 w-4" />
              {generating ? "Generating…" : "Generate"}
            </Button>
            {status && (
              <p className="text-muted-foreground text-sm">{status}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generate In-App</CardTitle>
            <CardDescription>
              Select date, add or remove files for that day, choose tone. Full pipeline runs here with checkpoints; preview and download HTML + run doc.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Date folder</Label>
                <Select
                  value={selectedDate || "_"}
                  onValueChange={(v) => setSelectedDate(v === "_" ? "" : v)}
                  disabled={dateFoldersLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={dateFoldersLoading ? "Loading…" : "Select a date folder"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">— (none)</SelectItem>
                    {dateFolders.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tone</Label>
                <Select value={tone} onValueChange={(v) => setTone(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONE_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Image model</Label>
                <Select
                  value={imageModel}
                  onValueChange={(v) => setImageModel(v as "dall-e-3" | "gpt-image-1")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dall-e-3">DALL-E 3 (testing)</SelectItem>
                    <SelectItem value="gpt-image-1">GPT Image 1 (advanced newsletter)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  DALL-E 3 for testing; GPT Image 1 for higher-quality newsletter images.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={language} onValueChange={(v) => setLanguage(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Output language" />
                  </SelectTrigger>
                  <SelectContent>
                    {NEWSLETTER_LANGUAGES.map((lang) => (
                      <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Newsletter content (headline, subject, segments) will be generated in this language.
                </p>
              </div>
            </div>

            {tone === "CUSTOM" && (
              <div className="space-y-2">
                <Label htmlFor="custom-tone-inline">Custom tone details</Label>
                <textarea
                  id="custom-tone-inline"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Paste or describe your tone (layout, colors, typography, etc.)"
                  value={customTone}
                  onChange={(e) => setCustomTone(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="custom-image-prompt">Custom image prompt (optional)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyDefaultImagePrompt}
                >
                  {copiedPromptType === "image" ? <CheckIcon className="h-4 w-4 mr-1.5" /> : <CopyIcon className="h-4 w-4 mr-1.5" />}
                  {copiedPromptType === "image" ? "Copied!" : "Copy default prompt"}
                </Button>
              </div>
              <textarea
                id="custom-image-prompt"
                className="flex min-h-[220px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder={DEFAULT_IMAGE_PROMPT_PLACEHOLDER}
                value={customImagePrompt}
                onChange={(e) => setCustomImagePrompt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use {"{{title}}"} and {"{{summary}}"} in your template. Leave empty for default.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="custom-html-prompt">Custom HTML prompt (optional)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyDefaultHtmlPrompt}
                >
                  {copiedPromptType === "html" ? <CheckIcon className="h-4 w-4 mr-1.5" /> : <CopyIcon className="h-4 w-4 mr-1.5" />}
                  {copiedPromptType === "html" ? "Copied!" : "Copy default prompt"}
                </Button>
              </div>
              <textarea
                id="custom-html-prompt"
                className="flex min-h-[280px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder={DEFAULT_HTML_PROMPT_PLACEHOLDER}
                value={customHtmlPrompt}
                onChange={(e) => setCustomHtmlPrompt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for default. Use variables: {"{{newsletterHeadline}}"}, {"{{subjectLine}}"}, {"{{preHeaderText}}"}, {"{{topStoriesSegmentMarkdown}}"}, {"{{allImageTags}}"}, {"{{tone}}"}, {"{{toneName}}"}, {"{{toneDetails}}"}, {"{{newsletterDate}}"}, {"{{logoUrl}}"}.
              </p>
            </div>

            {selectedDate && (
              <div className="space-y-2">
                <Label>Files for {selectedDate} (select which to include)</Label>
                {filesLoading ? (
                  <p className="text-muted-foreground text-sm">Loading files…</p>
                ) : filesForDate.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No files for this date.</p>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={selectAllFiles}
                      >
                        Select all
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={deselectAllFiles}
                      >
                        Deselect all
                      </Button>
                    </div>
                    <ul className="rounded-md border bg-muted/30 divide-y divide-border max-h-[200px] overflow-y-auto">
                    {filesForDate.map((f) => (
                      <li key={f} className="flex items-center gap-2 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(f)}
                          onChange={() => toggleFile(f)}
                          className="h-4 w-4 rounded border-input"
                          aria-label={`Include ${f}`}
                        />
                        <FileTextIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{f}</span>
                      </li>
                    ))}
                    </ul>
                  </>
                )}
                {filesForDate.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedKeys.size} of {filesForDate.length} selected
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Checkpoints</Label>
              <ul className="rounded-md border bg-muted/30 divide-y divide-border p-2">
                {CHECKPOINTS.map(({ key, label }) => (
                  <li key={key} className="flex items-center gap-2 py-1.5 text-sm">
                    {checkpoints[key] ? (
                      <CheckCircle2Icon className="h-4 w-4 shrink-0 text-green-600" />
                    ) : (
                      <CircleIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className={checkpoints[key] ? "font-medium" : "text-muted-foreground"}>
                      {label} {checkpoints[key] ? "CHECK" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <Button
              onClick={handleGenerateInline}
              disabled={generating || !selectedDate || selectedKeys.size === 0}
            >
              <MailIcon className="mr-2 h-4 w-4" />
              {generating ? "Generating…" : "Generate In-App"}
            </Button>
            {inlineError && (
              <p className="text-sm text-destructive">{inlineError}</p>
            )}
          </CardContent>
        </Card>

        {selectedDate && (archiveStatus?.hasNewsletter || archiveStatus?.hasRunDoc) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2Icon className="h-5 w-5 text-green-600" />
                Already produced for this day
              </CardTitle>
              <CardDescription>
                Newsletter for {selectedDate} is in the archive. Download below or use the Send section to email.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {archiveStatus.hasNewsletter && (
                <Button variant="outline" size="sm" onClick={() => downloadArchiveFile("newsletter.html")}>
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  Download HTML
                </Button>
              )}
              {archiveStatus.hasRunDoc && (
                <Button variant="outline" size="sm" onClick={() => downloadArchiveFile("newsletter-run.md")}>
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  Download run file (markdown)
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Checkpoint data: tone → content prompt → content response → images → html prompt → preview */}
        {toneUsed && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {checkpoints.tone_selected && <CheckCircle2Icon className="h-5 w-5 text-green-600" />}
                Tone used
              </CardTitle>
              <CardDescription>Applied for this run</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium">{toneUsed.toneName}</p>
              <pre className="max-h-[200px] overflow-auto rounded border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                {toneUsed.toneDetails}
              </pre>
            </CardContent>
          </Card>
        )}

        {contentPrompt && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {checkpoints.ai_content_sent && <CheckCircle2Icon className="h-5 w-5 text-green-600" />}
                Content prompt (sent to AI)
              </CardTitle>
              <CardDescription>Exact prompt used for story selection and segments</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[300px] overflow-auto rounded border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                {contentPrompt}
              </pre>
            </CardContent>
          </Card>
        )}

        {(contentResponse || contentParsed) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {checkpoints.ai_content_response && <CheckCircle2Icon className="h-5 w-5 text-green-600" />}
                AI content response
              </CardTitle>
              <CardDescription>Parsed headline, subject, pre-header, top stories</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {contentParsed && (
                <pre className="max-h-[250px] overflow-auto rounded border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                  {JSON.stringify(contentParsed, null, 2)}
                </pre>
              )}
              {contentResponse && (
                <details>
                  <summary className="text-sm font-medium cursor-pointer">Raw response</summary>
                  <pre className="mt-2 max-h-[200px] overflow-auto rounded border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                    {contentResponse}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        )}

        {imageUrls.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {checkpoints.images_generated && <CheckCircle2Icon className="h-5 w-5 text-green-600" />}
                Images generated
              </CardTitle>
              <CardDescription>
                {imagePrompts.length > 0
                  ? imagePrompts.map((p, i) => `Story ${i + 1}: ${p.title}`).join(" · ")
                  : "Story images"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {imageUrls.map((url, i) => (
                  <div key={i} className="space-y-1">
                    {imagePrompts[i] && (
                      <p className="text-xs font-medium text-muted-foreground truncate">
                        {imagePrompts[i].title}
                      </p>
                    )}
                    {url ? (
                      <img
                        src={url}
                        alt={imagePrompts[i]?.title ?? `Story ${i + 1}`}
                        className="rounded border w-full h-auto max-h-[200px] object-cover"
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">No image</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {htmlPrompt && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {checkpoints.final_html_sent && <CheckCircle2Icon className="h-5 w-5 text-green-600" />}
                Final HTML prompt (sent to AI)
              </CardTitle>
              <CardDescription>Exact prompt used for newsletter HTML generation</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[300px] overflow-auto rounded border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                {htmlPrompt}
              </pre>
            </CardContent>
          </Card>
        )}

        {generatedHtml && (
          <>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle>Preview</CardTitle>
                    <CardDescription>
                      Rendered HTML. Download or copy below.
                      {runId && (
                        <span className="block mt-1 text-muted-foreground">
                          Run saved locally to <code className="text-xs bg-muted px-1 rounded">newsletter-runs/{runId}.md</code>
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopy}>
                      {copied ? <CheckIcon className="h-4 w-4 mr-2" /> : <CopyIcon className="h-4 w-4 mr-2" />}
                      {copied ? "Copied" : "Copy HTML"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadHtml}>
                      <DownloadIcon className="h-4 w-4 mr-2" />
                      Download HTML
                    </Button>
                    {runDoc && (
                      <Button variant="outline" size="sm" onClick={downloadRunDoc}>
                        <DownloadIcon className="h-4 w-4 mr-2" />
                        Download run doc
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded border bg-muted/20 overflow-hidden">
                  <iframe
                    title="Newsletter preview"
                    srcDoc={generatedHtml}
                    className="w-full h-[600px] border-0 bg-white"
                    sandbox="allow-same-origin"
                  />
                </div>
                <details className="rounded border bg-muted/30 p-2">
                  <summary className="text-sm font-medium cursor-pointer">Raw HTML</summary>
                  <pre className="mt-2 max-h-[400px] overflow-auto text-xs whitespace-pre-wrap break-words">
                    {generatedHtml}
                  </pre>
                </details>
              </CardContent>
            </Card>
          </>
        )}

        {selectedDate && (generatedHtml || runDoc || archiveStatus?.hasNewsletter || archiveStatus?.hasRunDoc) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SendIcon className="h-5 w-5" />
                Send newsletter
              </CardTitle>
              <CardDescription>
                Add recipients (paste CSV emails), choose what to send, then click Send.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Recipients</Label>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    className="flex h-9 flex-1 min-w-[200px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="Paste emails: a@b.com, c@d.com"
                    value={recipientInput}
                    onChange={(e) => setRecipientInput(e.target.value)}
                    onBlur={addRecipientsFromInput}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault()
                        addRecipientsFromInput()
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={addRecipientsFromInput}>
                    Add
                  </Button>
                </div>
                {recipients.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {recipients.map((email) => (
                      <Badge key={email} variant="secondary" className="pr-1 gap-1">
                        <span className="max-w-[180px] truncate">{email}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${email}`}
                          className="rounded hover:bg-muted-foreground/20 p-0.5"
                          onClick={() => removeRecipient(email)}
                        >
                          <XIcon className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <Label>Send options</Label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={sendRunDoc}
                      onCheckedChange={(c) => setSendRunDoc(c === true)}
                    />
                    <span className="text-sm">Send markdown run file (attachment)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={sendHtmlAttachment}
                      onCheckedChange={(c) => setSendHtmlAttachment(c === true)}
                    />
                    <span className="text-sm">Send newsletter HTML file (attachment)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={sendHtmlBody}
                      onCheckedChange={(c) => setSendHtmlBody(c === true)}
                    />
                    <span className="text-sm">Send newsletter as HTML (email body)</span>
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSend}
                  disabled={sending || recipients.length === 0 || !(sendRunDoc || sendHtmlAttachment || sendHtmlBody)}
                >
                  <SendIcon className="h-4 w-4 mr-2" />
                  {sending ? "Sending…" : "Send"}
                </Button>
                {sendResult && (
                  <span className={sendResult.startsWith("Sent") ? "text-green-600 text-sm" : "text-destructive text-sm"}>
                    {sendResult}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
