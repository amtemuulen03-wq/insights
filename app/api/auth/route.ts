import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  configuredInsightPassword,
  hasValidInsightSession,
  INSIGHT_COOKIE_NAME,
  insightSessionToken,
  safeEqual,
} from "../../lib/insight-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unavailable() {
  return NextResponse.json(
    { message: "INSIGHT_PASSWORD is not configured." },
    { status: 503 },
  );
}

export async function GET(request: NextRequest) {
  const password = configuredInsightPassword();

  if (!password) return unavailable();

  const suppliedToken = request.cookies.get(INSIGHT_COOKIE_NAME)?.value;
  const authenticated = hasValidInsightSession(suppliedToken, password);

  return NextResponse.json(
    { authenticated },
    {
      status: authenticated ? 200 : 401,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function POST(request: NextRequest) {
  const password = configuredInsightPassword();

  if (!password) return unavailable();

  let suppliedPassword = "";

  try {
    const payload = (await request.json()) as { password?: unknown };
    suppliedPassword =
      typeof payload.password === "string" ? payload.password : "";
  } catch {
    return NextResponse.json(
      { message: "Invalid request." },
      { status: 400 },
    );
  }

  if (!safeEqual(suppliedPassword, password)) {
    return NextResponse.json(
      { message: "Incorrect password." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ authenticated: true });
  response.cookies.set({
    name: INSIGHT_COOKIE_NAME,
    value: insightSessionToken(password),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  response.headers.set("Cache-Control", "no-store");

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set({
    name: INSIGHT_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  response.headers.set("Cache-Control", "no-store");

  return response;
}
