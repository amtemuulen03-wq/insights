import { NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  createAccessToken,
  verifyPassword,
} from "../../../../lib/insight-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.INSIGHT_PASSWORD) {
    return NextResponse.json(
      { message: "Password authentication is not configured." },
      { status: 500 },
    );
  }

  let password = "";

  try {
    const body = (await request.json()) as {
      password?: unknown;
    };

    if (typeof body.password === "string") {
      password = body.password;
    }
  } catch {
    return NextResponse.json(
      { message: "Invalid request." },
      { status: 400 },
    );
  }

  if (!verifyPassword(password)) {
    // Small delay to discourage rapid repeated attempts.
    await new Promise((resolve) => setTimeout(resolve, 500));

    return NextResponse.json(
      { message: "Incorrect password." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({
    authenticated: true,
  });

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: createAccessToken(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/insights",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}