import { NextResponse } from "next/server"
import type { SupabaseProject } from "@/lib/supabase"
import { getHubSpotAccessToken } from "@/lib/env"
import { runHubSpotSync } from "@/lib/hubspotSync"

function parseProject(v: string | null): SupabaseProject {
  return v === "prod2k26" ? "prod2k26" : "sales2k25"
}

export async function POST(req: Request) {
  const startedAt = Date.now()
  try {
    const tokenSet = !!getHubSpotAccessToken()
    const { searchParams } = new URL(req.url)
    const project = parseProject(searchParams.get("project"))
    // #region agent log
    fetch('http://127.0.0.1:7422/ingest/3787d631-f834-43a2-be39-08d50feb8a38',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cd9fd3'},body:JSON.stringify({sessionId:'cd9fd3',location:'sync/route.ts:POST:entry',message:'manual hubspot sync invoked',data:{project,tokenSet},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    if (!tokenSet) {
      return NextResponse.json(
        { error: "HUBSPOT_ACCESS_TOKEN is not set. Add it in .env or app settings." },
        { status: 400 }
      )
    }
    const result = await runHubSpotSync(project, "manual")
    // #region agent log
    fetch('http://127.0.0.1:7422/ingest/3787d631-f834-43a2-be39-08d50feb8a38',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cd9fd3'},body:JSON.stringify({sessionId:'cd9fd3',location:'sync/route.ts:POST:ok',message:'manual sync completed',data:{project,contacts:result.contacts,deals:result.deals,durationMs:Date.now()-startedAt},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : "HubSpot sync failed"
    // #region agent log
    fetch('http://127.0.0.1:7422/ingest/3787d631-f834-43a2-be39-08d50feb8a38',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cd9fd3'},body:JSON.stringify({sessionId:'cd9fd3',location:'sync/route.ts:POST:error',message:'manual sync failed',data:{error:message.slice(0,200),durationMs:Date.now()-startedAt},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    console.error("HubSpot sync error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
