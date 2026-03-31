import { NextResponse } from "next/server"
import {
  executeRadarPost,
  type RadarTraceStep,
} from "@/app/api/radar/route"

/**
 * Same resolver as POST /api/radar, but the JSON body always includes `trace`:
 * ordered steps showing Supabase / Unipile calls, endpoints (redacted), and payloads.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const url = typeof body.url === "string" ? body.url.trim() : ""
    const trace: RadarTraceStep[] = []
    const out = await executeRadarPost(url, trace)
    if (!out.ok) {
      return NextResponse.json({ error: out.error, trace }, { status: out.status })
    }
    return NextResponse.json({
      postData: out.result.postData,
      source: out.result.source,
      trace,
    })
  } catch (err) {
    console.error("Radar logging API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed", trace: [] as RadarTraceStep[] },
      { status: 500 }
    )
  }
}
