import { NextRequest, NextResponse } from "next/server"

const COOKIE_NAME = "excelr8_session"
const COOKIE_MAX_AGE = 60 * 60 * 24 // 24 hours

/** Admin username (env: ADMIN_USERNAME; fallback only in development). */
function getAdminUsername(): string {
  const v = process.env.ADMIN_USERNAME?.trim()
  if (v) return v
  if (process.env.NODE_ENV === "development") return "admin"
  return ""
}

/** Admin password (env: ADMIN_PASSWORD; fallback only in development). */
function getAdminPassword(): string {
  const v = process.env.ADMIN_PASSWORD?.trim()
  if (v) return v
  if (process.env.NODE_ENV === "development") return "admin123"
  return ""
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const username = typeof body.username === "string" ? body.username.trim() : ""
    const password = typeof body.password === "string" ? body.password : ""

    const expectedUser = getAdminUsername()
    const expectedPassword = getAdminPassword()
    if (!expectedUser || !expectedPassword) {
      return NextResponse.json(
        { ok: false, error: "Server auth not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD in production." },
        { status: 503 }
      )
    }
    if (username !== expectedUser || password !== expectedPassword) {
      return NextResponse.json({ ok: false, error: "Invalid username or password" }, { status: 401 })
    }

    const res = NextResponse.json({ ok: true })
    res.cookies.set(COOKIE_NAME, "1", {
      path: "/",
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
    return res
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 })
  }
}
