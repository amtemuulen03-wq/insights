import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

export const AUTH_COOKIE_NAME = "insight_access";

const TOKEN_MESSAGE = "insight-access-v1";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function configuredPassword() {
  return process.env.INSIGHT_PASSWORD;
}

export function createAccessToken() {
  const password = configuredPassword();

  if (!password) {
    throw new Error("INSIGHT_PASSWORD is not configured");
  }

  return createHmac("sha256", password)
    .update(TOKEN_MESSAGE)
    .digest("hex");
}

export function verifyPassword(candidate: string) {
  const password = configuredPassword();

  if (!password) {
    return false;
  }

  return safeEqual(candidate, password);
}

export function verifyAccessToken(candidate?: string) {
  if (!candidate || !configuredPassword()) {
    return false;
  }

  return safeEqual(candidate, createAccessToken());
}