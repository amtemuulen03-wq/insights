import { createHash, timingSafeEqual } from "node:crypto";

export const INSIGHT_COOKIE_NAME = "insight_session";

export function configuredInsightPassword() {
  return process.env.INSIGHT_PASSWORD ?? "";
}

export function insightSessionToken(password: string) {
  return createHash("sha256")
    .update(`marketing-insight-session:${password}`)
    .digest("hex");
}

export function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function hasValidInsightSession(
  suppliedToken: string | undefined,
  password: string,
) {
  return Boolean(
    password &&
      suppliedToken &&
      safeEqual(suppliedToken, insightSessionToken(password)),
  );
}
