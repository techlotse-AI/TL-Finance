import { createHash, randomBytes } from "node:crypto";

/**
 * One-time TOTP recovery codes. Ten codes of the form XXXXX-XXXXX from an
 * unambiguous alphabet (no 0/O/1/I/L), shown to the user exactly once at
 * enrollment and stored only as sha256 hex — the same one-way discipline as
 * the email-verification and password-reset tokens.
 */

const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const RECOVERY_CODE_COUNT = 10;
const GROUP_LENGTH = 5;

export function generateRecoveryCode(): string {
  const bytes = randomBytes(GROUP_LENGTH * 2);
  let code = "";
  for (let index = 0; index < GROUP_LENGTH * 2; index++) {
    if (index === GROUP_LENGTH) code += "-";
    code += RECOVERY_ALPHABET[bytes[index] % RECOVERY_ALPHABET.length];
  }
  return code;
}

export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, generateRecoveryCode);
}

/** Normalizes user input (case, spacing, optional dash) before hashing. */
export function normalizeRecoveryCode(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]+/g, "");
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}

/** Loose shape check so obviously-not-a-recovery-code input can short-circuit. */
export function looksLikeRecoveryCode(raw: string): boolean {
  return normalizeRecoveryCode(raw).length === GROUP_LENGTH * 2;
}
