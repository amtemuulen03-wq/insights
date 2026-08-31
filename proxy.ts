import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  verifyAccessToken,
} from "./lib/insight-auth";

function applicationPath(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const basePath = request.nextUrl.basePath || "/insights";

  if (pathname.startsWith(basePath)) {
    return pathname.slice(basePath.length) || "/";
  }

  return pathname;
}

export function proxy(request: NextRequest) {
  const pathname = applicationPath(request);

  const isStaticResource =
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    /\.[a-zA-Z0-9]+$/.test(pathname);

  const isLoginPage = pathname === "/login";
  const isAuthenticationApi =
    pathname === "/api/auth/login";

  if (
    isStaticResource ||
    isLoginPage ||
    isAuthenticationApi
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(
    AUTH_COOKIE_NAME,
  )?.value;

  if (verifyAccessToken(token)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { message: "Authentication required." },
      { status: 401 },
    );
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";

  return NextResponse.redirect(loginUrl);
}