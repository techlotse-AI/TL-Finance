/**
 * Deterministic account-lockout policy for failed sign-in attempts. This is a
 * pure module with no I/O: the signin route persists the returned state. It
 * layers an account-targeted lock on top of the existing IP/volume rate limit.
 *
 * Policy: after `threshold` consecutive failures the account locks for an
 * escalating, time-based backoff (the last backoff value caps further
 * escalations). A successful sign-in or a completed password reset clears the
 * state. Locks always expire on their own; there is no permanent lock.
 */
export interface LockoutPolicy {
  /** Consecutive failures allowed before the first lock. */
  threshold: number;
  /** Escalating lock durations in minutes; the final entry caps escalation. */
  backoffMinutes: number[];
}

export const DEFAULT_LOCKOUT_POLICY: LockoutPolicy = {
  threshold: 5,
  backoffMinutes: [15, 30, 60, 120],
};

export interface LockState {
  failedLoginCount: number;
  lockedUntil: Date | null;
}

export const CLEARED_LOCK_STATE: LockState = { failedLoginCount: 0, lockedUntil: null };

/**
 * Resolves policy from environment, falling back to the defaults. Configure with
 * LOGIN_LOCKOUT_THRESHOLD and LOGIN_LOCKOUT_BACKOFF_MINUTES (comma-separated).
 */
export function lockoutPolicyFromEnv(
  env: Record<string, string | undefined> = process.env,
): LockoutPolicy {
  const threshold = Number.parseInt(env.LOGIN_LOCKOUT_THRESHOLD ?? "", 10);
  const backoff = (env.LOGIN_LOCKOUT_BACKOFF_MINUTES ?? "")
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0);

  return {
    threshold: Number.isInteger(threshold) && threshold > 0 ? threshold : DEFAULT_LOCKOUT_POLICY.threshold,
    backoffMinutes: backoff.length > 0 ? backoff : DEFAULT_LOCKOUT_POLICY.backoffMinutes,
  };
}

/**
 * Records one failed attempt against the current count and returns the new
 * lock state. The account locks once the failure count reaches the threshold;
 * each subsequent failure escalates the backoff up to the capped maximum.
 */
export function registerFailedAttempt(
  currentCount: number,
  now: Date,
  policy: LockoutPolicy = DEFAULT_LOCKOUT_POLICY,
): LockState & { newlyLocked: boolean } {
  const failedLoginCount = Math.max(0, Math.trunc(currentCount)) + 1;

  if (failedLoginCount < policy.threshold) {
    return { failedLoginCount, lockedUntil: null, newlyLocked: false };
  }

  const escalationIndex = failedLoginCount - policy.threshold;
  const cappedIndex = Math.min(escalationIndex, policy.backoffMinutes.length - 1);
  const minutes = policy.backoffMinutes[cappedIndex];
  const lockedUntil = new Date(now.getTime() + minutes * 60_000);
  return { failedLoginCount, lockedUntil, newlyLocked: true };
}

/** Whether the account is currently locked at the given instant. */
export function isLocked(state: { lockedUntil: Date | null }, now: Date): boolean {
  return state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime();
}

/** Whole seconds remaining on a lock, or 0 if not locked. */
export function lockRemainingSeconds(lockedUntil: Date | null, now: Date): number {
  if (!lockedUntil) return 0;
  return Math.max(0, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000));
}
