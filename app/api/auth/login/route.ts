import { NextRequest, NextResponse } from "next/server"

const USERNAME = "admin"
const PASSWORD = "admin123"
const COOKIE_NAME = "excelr8_session"
const COOKIE_MAX_AGE = 60 * 60 * 24 // 24 hours

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const username = typeof body.username === "string" ? body.username.trim() : ""
    const password = typeof body.password === "string" ? body.password : ""

    if (username !== USERNAME || password !== PASSWORD) {
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
