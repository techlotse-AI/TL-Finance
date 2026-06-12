const MASKED_REFERENCE = /^•{1,8}[A-Z0-9]{4}$/;
const RAW_REFERENCE = /^(?=.*\d)[A-Z0-9]{7,34}$/;

export function normalizeAccountReference(value: string): string {
  return value.trim().toUpperCase().replace(/[\s.\-]/g, "");
}

export function isValidAccountReference(value: string): boolean {
  const normalized = normalizeAccountReference(value);
  return MASKED_REFERENCE.test(normalized) || RAW_REFERENCE.test(normalized);
}

export function maskAccountReference(value: string): string {
  const normalized = normalizeAccountReference(value);
  if (MASKED_REFERENCE.test(normalized)) return normalized;
  return `${"•".repeat(Math.min(normalized.length - 4, 8))}${normalized.slice(-4)}`;
}
