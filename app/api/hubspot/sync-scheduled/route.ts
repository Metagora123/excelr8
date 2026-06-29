import { NextResponse } from "next/server"
import type { SupabaseProject } from "@/lib/supabase"
import { getCronSecret, getHubSpotAccessToken } from "@/lib/env"
import { runHubSpotSync } from "@/lib/hubspotSync"

export const maxDuration = 300

const PROJECTS: SupabaseProject[] = ["sales2k25", "prod2k26"]

/**
 * GET (or POST) /api/hubspot/sync-scheduled
 * Called by Vercel Cron once per day. Runs the full HubSpot sync for each project and
 * records a row in hubspot_sync_runs. Secured by CRON_SECRET (Bearer token).
 */
export async function GET(req: Request) {
  // #region agent log
  fetch('http://127.0.0.1:7422/ingest/3787d631-f834-43a2-be39-08d50feb8a38',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cd9fd3'},body:JSON.stringify({sessionId:'cd9fd3',location:'sync-scheduled/route.ts:GET:entry',message:'hubspot sync-scheduled invoked',data:{hasAuthHeader:!!req.headers.get('authorization')},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  const secret = getCronSecret()
  if (!secret) {
    // #region agent log
    fetch('http://127.0.0.1:7422/ingest/3787d631-f834-43a2-be39-08d50feb8a38',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cd9fd3'},body:JSON.stringify({sessionId:'cd9fd3',location:'sync-scheduled/route.ts:GET:no-secret',message:'CRON_SECRET missing',data:{},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 })
  }
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${secret}`) {
    // #region agent log
    fetch('http://127.0.0.1:7422/ingest/3787d631-f834-43a2-be39-08d50feb8a38',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cd9fd3'},body:JSON.stringify({sessionId:'cd9fd3',location:'sync-scheduled/route.ts:GET:unauthorized',message:'cron auth failed',data:{authPrefix:auth?.slice(0,12)??null},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const hubspotTokenSet = !!getHubSpotAccessToken()
  if (!hubspotTokenSet) {
    // #region agent log
    fetch('http://127.0.0.1:7422/ingest/3787d631-f834-43a2-be39-08d50feb8a38',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cd9fd3'},body:JSON.stringify({sessionId:'cd9fd3',location:'sync-scheduled/route.ts:GET:no-token',message:'HUBSPOT_ACCESS_TOKEN missing',data:{},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    return NextResponse.json({ error: "HUBSPOT_ACCESS_TOKEN is not set" }, { status: 400 })
  }

  console.log("[hubspot/sync-scheduled] triggered at", new Date().toISOString())
  // #region agent log
  fetch('http://127.0.0.1:7422/ingest/3787d631-f834-43a2-be39-08d50feb8a38',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cd9fd3'},body:JSON.stringify({sessionId:'cd9fd3',location:'sync-scheduled/route.ts:GET:pre-sync',message:'auth ok, starting sync loop',data:{projectCount:PROJECTS.length},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  const results: { project: string; status: string; contacts?: number; deals?: number; error?: string }[] = []
  for (const project of PROJECTS) {
    const projectStartedAt = Date.now()
    try {
      const r = await runHubSpotSync(project, "scheduled")
      // #region agent log
      fetch('http://127.0.0.1:7422/ingest/3787d631-f834-43a2-be39-08d50feb8a38',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cd9fd3'},body:JSON.stringify({sessionId:'cd9fd3',location:'sync-scheduled/route.ts:GET:project-ok',message:'project sync completed',data:{project,contacts:r.contacts,deals:r.deals,durationMs:Date.now()-projectStartedAt},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      results.push({ project, status: "ok", contacts: r.contacts, deals: r.deals })
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      // #region agent log
      fetch('http://127.0.0.1:7422/ingest/3787d631-f834-43a2-be39-08d50feb8a38',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cd9fd3'},body:JSON.stringify({sessionId:'cd9fd3',location:'sync-scheduled/route.ts:GET:project-error',message:'project sync failed',data:{project,error:errMsg.slice(0,200),durationMs:Date.now()-projectStartedAt},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      results.push({ project, status: "error", error: errMsg })
    }
  }

  // #region agent log
  fetch('http://127.0.0.1:7422/ingest/3787d631-f834-43a2-be39-08d50feb8a38',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cd9fd3'},body:JSON.stringify({sessionId:'cd9fd3',location:'sync-scheduled/route.ts:GET:done',message:'sync-scheduled finished',data:{results},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  return NextResponse.json({ ran: results.length, results })
}

export async function POST(req: Request) {
  return GET(req)
}
