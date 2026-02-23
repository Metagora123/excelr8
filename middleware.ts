import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const COOKIE_NAME = "excelr8_session"
const LOGIN = "/login"

export function middleware(request: NextRequest) {
  const session = request.cookies.get(COOKIE_NAME)?.value
  const { pathname } = request.nextUrl

  if (pathname === LOGIN) {
    if (session) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
    return NextResponse.next()
  }

  if (!session) {
    const loginUrl = new URL(LOGIN, request.url)
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/dashboard", "/dashboard/:path*", "/ingestion", "/dossiers", "/radar", "/campaign-manager", "/kpi", "/newsletter", "/login"],
}
