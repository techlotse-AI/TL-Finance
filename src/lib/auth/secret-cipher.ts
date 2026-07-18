import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Reversible encryption for secrets that must be read back (currently only
 * TOTP secrets — passwords and one-time tokens stay one-way hashed). AES-256-
 * GCM with a random 12-byte IV per encryption and a versioned payload
 * (`v1.<iv>.<tag>.<ciphertext>`, base64url parts) so the scheme can rotate.
 *
 * The key derives from the required `TOTP_ENCRYPTION_KEY` env var (>= 32
 * chars, same bar as AUDIT_IP_HASH_SECRET) via sha256, giving an exact
 * 256-bit key regardless of input length. Fail-closed: a missing/short key,
 * a malformed payload, or a failed auth tag all throw — callers treat that
 * as "TOTP unavailable", never as "skip verification".
 */

const PAYLOAD_VERSION = "v1";

function encryptionKey(): Buffer {
  const raw = process.env.TOTP_ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    throw new Error("TOTP_ENCRYPTION_KEY must be set to at least 32 characters.");
  }
  return createHash("sha256").update(raw).digest();
}

export function secretCipherConfigured(): boolean {
  const raw = process.env.TOTP_ENCRYPTION_KEY;
  return Boolean(raw && raw.length >= 32);
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PAYLOAD_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== PAYLOAD_VERSION) {
    throw new Error("Unrecognized encrypted-secret payload.");
  }
  const [, ivPart, tagPart, ciphertextPart] = parts;
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
