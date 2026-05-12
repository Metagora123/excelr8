import { NextResponse } from "next/server"
import {
  parseCsvToNormalizedRows,
  generateCampaignId,
  buildCampaignName,
  createCampaignRow,
  upsertLeadsAndFillLeadCampaigns,
  mergeNormalizedWithSupabaseLeadFields,
  createHitlistTableAndAppendLeads,
  createAutoLikeTable,
  appendAutoLikeRecordsFromLeadPosts,
  duplicateN8nWorkflow,
  updateCampaignAirtableUrls,
  updateCampaignLeadCount,
  createCampaignAutomationRow,
  createAutoCommentAutomationRow,
} from "@/lib/campaign-manager-inline"
import { runEnrichmentForCampaign } from "@/lib/enrichment-engine"
import {
  getAirtableApiKey,
  getAirtableBaseId,
  getAirtableBaseIdForAccount,
  getN8nApiUrl,
  getN8nAutoLikeWorkflowId,
  getN8nHitlistWorkflowId,
  getUnipileApiKey,
} from "@/lib/env"
import type { SupabaseProject } from "@/lib/supabase"

// Enrichment is the long-tail step (~10–30s per lead on Unipile). We keep all
// enrichment in-process now (no n8n hand-off), so the runtime budget needs to
// cover the worst-case CSV. Vercel Pro allows up to 300s; the UI streams
// per-lead progress so the user sees forward motion well before the deadline.
export const maxDuration = 300

type Checkpoint =
  | "campaign_created"
  | "leads_parsed"
  | "leads_upserted"
  | "lead_campaigns_filled"
  | "leads_enriched"
  | "airtable_auto_like_table_created"
  | "airtable_hitlist_table_created"
  | "n8n_auto_like_workflow_duplicated"
  | "n8n_hitlist_workflow_duplicated"
  | "completed"

function streamLine(controller: ReadableStreamDefaultController<Uint8Array>, obj: Record<string, unknown>) {
  controller.enqueue(new TextEncoder().encode(JSON.stringify(obj) + "\n"))
}

function parseProject(v: string | null): SupabaseProject {
  return v === "prod2k26" ? "prod2k26" : "sales2k25"
}

function isAirtablePermissionError(detail: string): boolean {
  return /Airtable create table:\s*403|INVALID_PERMISSIONS/i.test(detail)
}

export async function POST(req: Request) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  const campaignName = (formData.get("campaignName") as string)?.trim() ?? ""
  const clientId = (formData.get("clientId") as string)?.trim() ?? ""
  const category = (formData.get("category") as string)?.trim() ?? ""
  const managedBy = (formData.get("managedBy") as string)?.trim() ?? ""
  const project = parseProject(formData.get("supabaseProject") as string)
  const enableAutoLike = formData.get("enableAutoLike") === "true"
  const enableHitlist = formData.get("enableHitlist") === "true"
  const enableAutoLikeWorkflow = formData.get("enableAutoLikeWorkflow") === "true"
  const enableHitlistWorkflow = formData.get("enableHitlistWorkflow") === "true"
  const enableCampaignAutomation = formData.get("enableCampaignAutomation") === "true"
  let excludeRows: number[] = []
  try {
    const raw = formData.get("excludeRows") as string | null
    if (raw) excludeRows = JSON.parse(raw) as number[]
  } catch {
    excludeRows = []
  }

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "CSV file is required" }, { status: 400 })
  }
  if (!clientId) {
    return NextResponse.json({ error: "Client is required for in-app flow" }, { status: 400 })
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const campaignId = generateCampaignId()
        // Per-campaign secret used to authenticate Airtable button clicks. Same
        // UUID is stamped on every Hitlist row's Button_Token and stored on the
        // automation row, so the trigger endpoint can verify clicks without
        // trusting Airtable.
        const airtableButtonToken = (typeof globalThis.crypto?.randomUUID === "function"
          ? globalThis.crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36))
        const dateStr = new Date().toISOString().slice(0, 10)
        const campaignDisplayName = buildCampaignName({
          campaignName: campaignName || "Campaign",
          managedBy: managedBy || "—",
          category: category || "—",
          date: dateStr,
          campaignId,
        })

        // 1) Create campaign row
        await createCampaignRow({
          project,
          campaignId,
          campaignName: campaignName || campaignDisplayName,
          category: category || "—",
          managedBy: managedBy || "—",
          clientId,
        })
        streamLine(controller, { checkpoint: "campaign_created" as Checkpoint, campaignId })

        // 2) Parse CSV
        const csvText = await file.text()
        let normalized = parseCsvToNormalizedRows(csvText)
        if (excludeRows.length > 0) {
          normalized = normalized.filter((_, i) => !excludeRows.includes(i))
          streamLine(controller, { checkpoint: "leads_parsed" as Checkpoint, count: normalized.length, excluded: excludeRows.length })
        } else {
          streamLine(controller, { checkpoint: "leads_parsed" as Checkpoint, count: normalized.length })
        }

        if (normalized.length === 0) {
          streamLine(controller, { error: "No valid leads in CSV (need full_name or profile_url)" })
          controller.close()
          return
        }

        // 3) Upsert leads and fill lead_campaigns
        const { inserted, updated, leadIdsByProfileUrl } = await upsertLeadsAndFillLeadCampaigns(
          project,
          normalized,
          campaignId,
          clientId
        )
        streamLine(controller, {
          checkpoint: "leads_upserted" as Checkpoint,
          inserted,
          updated,
        })
        streamLine(controller, { checkpoint: "lead_campaigns_filled" as Checkpoint })
        try {
          await updateCampaignLeadCount(project, campaignId, leadIdsByProfileUrl.size)
        } catch (e) {
          streamLine(controller, {
            error: "Updating campaign lead count failed",
            detail: e instanceof Error ? e.message : String(e),
          })
        }

        // 4) Enrichment: always in-app now. The old `>25 leads → n8n` branch
        //    was removed once `maxDuration` was bumped to 300s; the UI shows a
        //    live progress bar via the `enrichment_progress` stream so even
        //    100-lead CSVs feel responsive.
        let enrichmentSummary: { enrichedCount: number; failedCount: number; skipCount: number; logs: Array<{ type: string; profile_url: string; full_name: string | null; message: string; postsStored?: number }> } | null = null

        if (getUnipileApiKey()) {
          try {
            enrichmentSummary = await runEnrichmentForCampaign(
              project,
              normalized,
              leadIdsByProfileUrl,
              (obj) => streamLine(controller, obj)
            )
            streamLine(controller, { checkpoint: "leads_enriched" as Checkpoint })
          } catch (e) {
            streamLine(controller, {
              error: "Enrichment failed",
              detail: e instanceof Error ? e.message : String(e),
            })
            streamLine(controller, { checkpoint: "leads_enriched" as Checkpoint, skipped: true })
          }
        } else {
          streamLine(controller, {
            enrichment_log: {
              type: "skip",
              profile_url: "",
              full_name: null,
              message: "Enrichment skipped: UNIPILE_API_KEY not set",
            },
          })
          streamLine(controller, { checkpoint: "leads_enriched" as Checkpoint, skipped: true })
        }

        // 4b) Refresh in-memory lead rows from Supabase so Airtable append sees
        //     Unipile headline (`description`) and any filled about_summary, etc.
        try {
          await mergeNormalizedWithSupabaseLeadFields(project, normalized, leadIdsByProfileUrl)
        } catch (e) {
          streamLine(controller, {
            error: "Merge enriched lead fields failed (non-fatal for campaign)",
            detail: e instanceof Error ? e.message : String(e),
          })
        }

        const airtableToken = getAirtableApiKey()
        const fallbackAirtableBaseId = getAirtableBaseId()
        const resolvedAirtableBase = getAirtableBaseIdForAccount(managedBy || "")
        let airtableBaseId = resolvedAirtableBase.baseId
        if (resolvedAirtableBase.source === "account") {
          streamLine(controller, {
            airtableBaseSelection: "account",
            managedBy: managedBy || undefined,
            envKey: resolvedAirtableBase.envKey,
            baseId: airtableBaseId,
          })
        } else {
          streamLine(controller, {
            airtableBaseSelection: "default_fallback",
            managedBy: managedBy || undefined,
            baseId: airtableBaseId || undefined,
          })
        }
        let airtableHitlistUrl = ""
        let airtableAutoLikeUrl = ""
        let airtableHitlistTableId = ""
        let airtableAutoLikeTableId = ""
        let n8nAutoLikeWorkflowId = ""
        let n8nHitlistWorkflowId = ""
        let airtableUrlsSaved = false

        const tableNameSuffix = `${campaignName || "Campaign"}-${managedBy}-${category}-${dateStr}-${campaignId}`

        // 5) Airtable: Auto Like table (optional)
        if (enableAutoLike && airtableToken && airtableBaseId) {
          try {
            const autoLikeTableName = `AUTO-LIKE-COMMENT-${tableNameSuffix}`
            let result = await createAutoLikeTable(airtableBaseId, airtableToken, autoLikeTableName, project)
            if (
              !result.tableId &&
              resolvedAirtableBase.source === "account" &&
              fallbackAirtableBaseId &&
              fallbackAirtableBaseId !== airtableBaseId
            ) {
              result = await createAutoLikeTable(fallbackAirtableBaseId, airtableToken, autoLikeTableName, project)
              airtableBaseId = fallbackAirtableBaseId
            }
            airtableAutoLikeUrl = result.url
            airtableAutoLikeTableId = result.tableId
            streamLine(controller, {
              checkpoint: "airtable_auto_like_table_created" as Checkpoint,
              tableName: autoLikeTableName,
              url: result.url,
              tableId: result.tableId,
              schemaSource: result.schemaSource,
              schemaError: result.schemaError,
              fields: result.fields,
            })
            const { appended: autoLikeAppended, removedEmptyRow } = await appendAutoLikeRecordsFromLeadPosts(
              project,
              campaignId,
              airtableBaseId,
              airtableToken,
              result.tableId
            )
            streamLine(controller, {
              checkpoint: "airtable_auto_like_table_created" as Checkpoint,
              autoLikeRowsAppended: autoLikeAppended,
              autoLikeRemovedEmptyRow: removedEmptyRow,
              autoLikeZeroRowsMessage:
                autoLikeAppended === 0
                  ? "0 rows appended (no lead_posts yet—enrichment may still be running or on-demand). Rows will appear when enrichment fills lead_posts; you can run Auto Comment automation then."
                  : undefined,
            })
          } catch (e) {
            const detail = e instanceof Error ? e.message : String(e)
            const canFallbackOnPermissionError =
              resolvedAirtableBase.source === "account" &&
              fallbackAirtableBaseId &&
              fallbackAirtableBaseId !== airtableBaseId &&
              isAirtablePermissionError(detail)
            if (canFallbackOnPermissionError) {
              try {
                const autoLikeTableName = `AUTO-LIKE-COMMENT-${tableNameSuffix}`
                const result = await createAutoLikeTable(
                  fallbackAirtableBaseId,
                  airtableToken,
                  autoLikeTableName,
                  project
                )
                airtableBaseId = fallbackAirtableBaseId
                airtableAutoLikeUrl = result.url
                airtableAutoLikeTableId = result.tableId
                streamLine(controller, {
                  checkpoint: "airtable_auto_like_table_created" as Checkpoint,
                  tableName: autoLikeTableName,
                  url: result.url,
                  tableId: result.tableId,
                  schemaSource: result.schemaSource,
                  schemaError: result.schemaError,
                  fields: result.fields,
                  airtableBaseFallbackUsed: true,
                })
              } catch (fallbackErr) {
                const fallbackDetail =
                  fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)
                const hint = /404/.test(fallbackDetail)
                  ? " Fix: check AIRTABLE_BASE_ID in env (base may not exist or you may not have access)."
                  : ""
                streamLine(controller, {
                  error: "Airtable Auto Like table failed",
                  detail: fallbackDetail + hint,
                })
              }
            } else {
              console.error("[inline] Airtable Auto Like table failed:", detail, "(404 = wrong AIRTABLE_BASE_ID or base not found.)")
              const hint = /404/.test(detail)
                ? " Fix: check AIRTABLE_BASE_ID in env (base may not exist or you may not have access)."
                : ""
              streamLine(controller, {
                error: "Airtable Auto Like table failed",
                detail: detail + hint,
              })
            }
          }
        } else {
          streamLine(controller, { checkpoint: "airtable_auto_like_table_created" as Checkpoint, skipped: true })
        }

        // 6) Airtable: Hitlist table + append leads (optional)
        if (enableHitlist && airtableToken && airtableBaseId) {
          try {
            const hitlistTableName = `HITLIST-${tableNameSuffix}`
            const result = await createHitlistTableAndAppendLeads(
              airtableBaseId,
              airtableToken,
              hitlistTableName,
              normalized,
              project,
              campaignId,
              airtableButtonToken
            )
            airtableHitlistUrl = result.url
            airtableHitlistTableId = result.tableId
            streamLine(controller, {
              checkpoint: "airtable_hitlist_table_created" as Checkpoint,
              tableName: hitlistTableName,
              url: result.url,
              tableId: result.tableId,
              schemaSource: result.schemaSource,
              schemaError: result.schemaError,
              fields: result.fields,
            })
          } catch (e) {
            const detail = e instanceof Error ? e.message : String(e)
            const canFallbackOnPermissionError =
              resolvedAirtableBase.source === "account" &&
              fallbackAirtableBaseId &&
              fallbackAirtableBaseId !== airtableBaseId &&
              isAirtablePermissionError(detail)
            if (canFallbackOnPermissionError) {
              try {
                const hitlistTableName = `HITLIST-${tableNameSuffix}`
                const result = await createHitlistTableAndAppendLeads(
                  fallbackAirtableBaseId,
                  airtableToken,
                  hitlistTableName,
                  normalized,
                  project,
                  campaignId,
                  airtableButtonToken
                )
                airtableBaseId = fallbackAirtableBaseId
                airtableHitlistUrl = result.url
                airtableHitlistTableId = result.tableId
                streamLine(controller, {
                  checkpoint: "airtable_hitlist_table_created" as Checkpoint,
                  tableName: hitlistTableName,
                  url: result.url,
                  tableId: result.tableId,
                  schemaSource: result.schemaSource,
                  schemaError: result.schemaError,
                  fields: result.fields,
                  airtableBaseFallbackUsed: true,
                })
              } catch (fallbackErr) {
                const fallbackDetail =
                  fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)
                const hint = /404/.test(fallbackDetail)
                  ? " Fix: check AIRTABLE_BASE_ID in env (base may not exist or you may not have access)."
                  : ""
                streamLine(controller, {
                  error: "Airtable Hitlist table failed",
                  detail: fallbackDetail + hint,
                })
              }
            } else {
              console.error("[inline] Airtable Hitlist table failed:", detail, "(404 usually means wrong AIRTABLE_BASE_ID or base not found.)")
              const hint = /404/.test(detail)
                ? " Fix: check AIRTABLE_BASE_ID in env (base may not exist or you may not have access)."
                : ""
              streamLine(controller, {
                error: "Airtable Hitlist table failed",
                detail: detail + hint,
              })
            }
          }
        } else {
          streamLine(controller, { checkpoint: "airtable_hitlist_table_created" as Checkpoint, skipped: true })
        }

        // 7) n8n: Duplicate Auto Like workflow (optional)
        const autoLikeWfId = getN8nAutoLikeWorkflowId()
        if (enableAutoLikeWorkflow && autoLikeWfId) {
          try {
            const { id } = await duplicateN8nWorkflow(autoLikeWfId, `AutoLike-${tableNameSuffix}`)
            n8nAutoLikeWorkflowId = id
            streamLine(controller, {
              checkpoint: "n8n_auto_like_workflow_duplicated" as Checkpoint,
              workflowId: id,
            })
          } catch (e) {
            const detail = e instanceof Error ? e.message : String(e)
            console.error("[inline] n8n Auto Like workflow duplicate failed:", detail)
            streamLine(controller, {
              error: "n8n Auto Like workflow duplicate failed",
              detail,
            })
          }
        } else {
          streamLine(controller, { checkpoint: "n8n_auto_like_workflow_duplicated" as Checkpoint, skipped: true })
        }

        // 8) n8n: Duplicate Hitlist workflow (optional)
        const hitlistWfId = getN8nHitlistWorkflowId()
        if (enableHitlistWorkflow && hitlistWfId) {
          try {
            const { id } = await duplicateN8nWorkflow(hitlistWfId, `Hitlist-${tableNameSuffix}`)
            n8nHitlistWorkflowId = id
            streamLine(controller, {
              checkpoint: "n8n_hitlist_workflow_duplicated" as Checkpoint,
              workflowId: id,
            })
          } catch (e) {
            const detail = e instanceof Error ? e.message : String(e)
            console.error("[inline] n8n Hitlist workflow duplicate failed:", detail)
            streamLine(controller, {
              error: "n8n Hitlist workflow duplicate failed",
              detail,
            })
          }
        } else {
          streamLine(controller, { checkpoint: "n8n_hitlist_workflow_duplicated" as Checkpoint, skipped: true })
        }

        // 9) Persist Airtable URLs on campaign row (if we have them)
        try {
          await updateCampaignAirtableUrls(project, campaignId, {
            airtableHitlistUrl: airtableHitlistUrl || undefined,
            airtableAutoLikeCommentUrl: airtableAutoLikeUrl || undefined,
          })
          airtableUrlsSaved = true
        } catch (e) {
          const detail = e instanceof Error ? e.message : String(e)
          console.error("[inline] Updating campaign Airtable URLs failed:", detail)
          streamLine(controller, {
            error: "Updating campaign Airtable URLs failed",
            detail,
          })
        }

        // 10) In-app campaign automation row (when checkbox enabled and hitlist table exists)
        if (enableCampaignAutomation && airtableHitlistTableId && airtableBaseId) {
          try {
            await createCampaignAutomationRow(
              project,
              campaignId,
              airtableBaseId,
              airtableHitlistTableId,
              airtableButtonToken
            )
            streamLine(controller, { campaign_automation_created: true })
          } catch (e) {
            const detail = e instanceof Error ? e.message : String(e)
            console.error("[inline] Campaign automation row failed:", detail)
            streamLine(controller, {
              error: "Campaign automation row failed (ensure in_app_campaign_automations table exists)",
              detail,
            })
          }
        }

        // 10b) In-app Auto Comment automation row (when Auto Like table exists – generate 4 comments per post)
        if (airtableAutoLikeTableId && airtableBaseId) {
          try {
            await createAutoCommentAutomationRow(project, campaignId, airtableBaseId, airtableAutoLikeTableId)
            streamLine(controller, { auto_comment_automation_created: true })
          } catch (e) {
            const detail = e instanceof Error ? e.message : String(e)
            console.error("[inline] Auto Comment automation row failed:", detail)
            streamLine(controller, {
              error: "Auto Comment automation row failed (ensure in_app_auto_comment_automations table exists)",
              detail,
            })
          }
        }

        streamLine(controller, {
          checkpoint: "completed" as Checkpoint,
          campaignId,
          airtableHitlistUrl: airtableHitlistUrl || undefined,
          airtableAutoLikeUrl: airtableAutoLikeUrl || undefined,
          airtableUrlsSaved: airtableUrlsSaved || undefined,
          leadsCount: normalized.length,
          enrichmentSummary: enrichmentSummary ?? undefined,
          // Rollback: IDs for deleting tables and workflows from this run
          rollback: {
            airtableBaseId: airtableBaseId || undefined,
            airtableHitlistTableId: airtableHitlistTableId || undefined,
            airtableAutoLikeTableId: airtableAutoLikeTableId || undefined,
            n8nAutoLikeWorkflowId: n8nAutoLikeWorkflowId || undefined,
            n8nHitlistWorkflowId: n8nHitlistWorkflowId || undefined,
          },
          // n8n workflow editor URLs (same base as API)
          n8nAutoLikeWorkflowUrl:
            n8nAutoLikeWorkflowId && getN8nApiUrl()
              ? `${getN8nApiUrl().replace(/\/$/, "")}/workflow/${n8nAutoLikeWorkflowId}`
              : undefined,
          n8nHitlistWorkflowUrl:
            n8nHitlistWorkflowId && getN8nApiUrl()
              ? `${getN8nApiUrl().replace(/\/$/, "")}/workflow/${n8nHitlistWorkflowId}`
              : undefined,
        })
      } catch (e) {
        streamLine(controller, {
          error: e instanceof Error ? e.message : String(e),
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
