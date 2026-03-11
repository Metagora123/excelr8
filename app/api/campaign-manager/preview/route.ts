import { NextResponse } from "next/server"
import { parseCsvToNormalizedRows } from "@/lib/campaign-manager-inline"

export async function POST(req: Request) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }
  const file = formData.get("file") as File | null
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "CSV file is required" }, { status: 400 })
  }
  try {
    const csvText = await file.text()
    const leads = parseCsvToNormalizedRows(csvText)
    return NextResponse.json({ leads, total: leads.length })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to parse CSV" },
      { status: 500 }
    )
  }
}
