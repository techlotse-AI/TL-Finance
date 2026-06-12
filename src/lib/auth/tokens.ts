import { createHash, randomBytes } from "node:crypto";

export function createOneTimeToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashOneTimeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function publicAppUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) throw new Error("NEXT_PUBLIC_APP_URL is required.");
  return new URL(path, baseUrl).toString();
}
