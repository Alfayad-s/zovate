import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth-session.constants";

/** Paths that never require a session (exact match). */
const PUBLIC_PATHS = new Set([
  "/login",
  "/register",
  "/auth/callback",
]);

/** App shell routes that require a valid JWT cookie. */
const PROTECTED_PATHS = new Set(["/", "/projects", "/tasks", "/settings"]);

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.has(pathname);
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const raw = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!raw) return false;
  let token: string;
  try {
    token = decodeURIComponent(raw);
  } catch {
    return false;
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    });
    return true;
  } catch {
    return false;
  }
}

/** Next.js 16 proxy (replaces middleware.ts). */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionOk = await hasValidSession(request);

  if (isPublicPath(pathname)) {
    if (sessionOk && (pathname === "/login" || pathname === "/register")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (isProtectedPath(pathname)) {
    if (!sessionOk) {
      const login = new URL("/login", request.url);
      login.searchParams.set("from", pathname);
      return NextResponse.redirect(login);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
