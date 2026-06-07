import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "tl_finance_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
