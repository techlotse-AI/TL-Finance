import { ApiError } from "@/lib/api/errors";

interface WindowState {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowState>();

export function enforceRateLimit(identifier: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const current = windows.get(identifier);

  if (!current || current.resetAt <= now) {
    windows.set(identifier, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (current.count >= limit) {
    throw new ApiError(429, "rate_limited", "Too many requests. Try again later.");
  }

  current.count += 1;
}

export function clearRateLimitsForTests(): void {
  windows.clear();
}
