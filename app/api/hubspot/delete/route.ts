import { NextResponse } from "next/server"
import { getHubSpotAccessToken } from "@/lib/env"
import { deleteContactsByIds, findContactsCreatedSince } from "@/lib/hubspot"

type DeleteBody =
  | { mode: "run"; contactIds: string[] }
  | { mode: "24h" }

export async function POST(req: Request) {
  try {
    if (!getHubSpotAccessToken()) {
      return NextResponse.json(
        { error: "HUBSPOT_ACCESS_TOKEN is not set. Add it in .env or app settings." },
        { status: 400 }
      )
    }

    const bodyJson = (await req.json().catch(() => null)) as DeleteBody | null
    if (!bodyJson || (bodyJson.mode !== "run" && bodyJson.mode !== "24h")) {
      return NextResponse.json(
        { error: "Invalid request body. Expected { mode: 'run' | '24h', ... }." },
        { status: 400 }
      )
    }

    if (bodyJson.mode === "run") {
      const ids = Array.isArray(bodyJson.contactIds) ? bodyJson.contactIds : []
      if (!ids.length) {
        return NextResponse.json(
          { error: "No contactIds provided for mode 'run'." },
          { status: 400 }
        )
      }
      const { deleted, failed } = await deleteContactsByIds(ids)
      return NextResponse.json({
        ok: true,
        mode: "run",
        requested: ids.length,
        deleted,
        failed,
      })
    }

    // mode === "24h"
    const ids = await findContactsCreatedSince(24 * 60 * 60 * 1000)
    if (!ids.length) {
      return NextResponse.json({
        ok: true,
        mode: "24h",
        requested: 0,
        deleted: 0,
        failed: 0,
        message: "No contacts found created in last 24 hours.",
      })
    }
    const { deleted, failed } = await deleteContactsByIds(ids)
    return NextResponse.json({
      ok: true,
      mode: "24h",
      requested: ids.length,
      deleted,
      failed,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "HubSpot delete failed"
    console.error("HubSpot delete error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

