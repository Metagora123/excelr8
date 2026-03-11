import { NextResponse } from "next/server"
import { deleteAirtableTable, deleteN8nWorkflow } from "@/lib/campaign-manager-inline"
import { getAirtableApiKey, getAirtableBaseId } from "@/lib/env"

export async function POST(req: Request) {
  let body: {
    airtableBaseId?: string
    airtableHitlistTableId?: string
    airtableAutoLikeTableId?: string
    n8nAutoLikeWorkflowId?: string
    n8nHitlistWorkflowId?: string
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const airtableBaseId = body.airtableBaseId?.trim()
  const airtableHitlistTableId = body.airtableHitlistTableId?.trim()
  const airtableAutoLikeTableId = body.airtableAutoLikeTableId?.trim()
  const n8nAutoLikeWorkflowId = body.n8nAutoLikeWorkflowId?.trim()
  const n8nHitlistWorkflowId = body.n8nHitlistWorkflowId?.trim()

  const results: { deleted: string[]; errors: string[] } = { deleted: [], errors: [] }
  const token = getAirtableApiKey()
  const baseId = airtableBaseId || getAirtableBaseId()

  if (baseId && token) {
    if (airtableHitlistTableId) {
      try {
        await deleteAirtableTable(baseId, token, airtableHitlistTableId)
        results.deleted.push("Airtable Hitlist table")
      } catch (e) {
        results.errors.push(`Hitlist table: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    if (airtableAutoLikeTableId) {
      try {
        await deleteAirtableTable(baseId, token, airtableAutoLikeTableId)
        results.deleted.push("Airtable Auto Like table")
      } catch (e) {
        results.errors.push(`Auto Like table: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  } else if (airtableHitlistTableId || airtableAutoLikeTableId) {
    results.errors.push("Airtable base ID or API key not set; skipped table deletion")
  }

  if (n8nAutoLikeWorkflowId) {
    try {
      await deleteN8nWorkflow(n8nAutoLikeWorkflowId)
      results.deleted.push("n8n Auto Like workflow")
    } catch (e) {
      results.errors.push(`n8n Auto Like: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  if (n8nHitlistWorkflowId) {
    try {
      await deleteN8nWorkflow(n8nHitlistWorkflowId)
      results.deleted.push("n8n Hitlist workflow")
    } catch (e) {
      results.errors.push(`n8n Hitlist: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  if (results.deleted.length === 0 && results.errors.length === 0) {
    return NextResponse.json({ error: "Nothing to delete; provide at least one table or workflow ID" }, { status: 400 })
  }

  return NextResponse.json({
    deleted: results.deleted,
    errors: results.errors.length > 0 ? results.errors : undefined,
  })
}
