export const capabilities = [
  "budget.read",
  "budget.write",
  "analysis.read",
  "analysis.write",
  "optimize.read",
  "optimize.run",
  "admin.tiers.manage",
] as const;

export type Capability = (typeof capabilities)[number];
export type ProductTier = "budget" | "analyze" | "optimize";

const tierCapabilities: Record<ProductTier, ReadonlySet<Capability>> = {
  budget: new Set(["budget.read", "budget.write"]),
  analyze: new Set(["budget.read", "budget.write", "analysis.read", "analysis.write"]),
  optimize: new Set([
    "budget.read",
    "budget.write",
    "analysis.read",
    "analysis.write",
    "optimize.read",
    "optimize.run",
  ]),
};

export function hasCapability(
  tier: ProductTier,
  capability: Capability,
  isInstanceAdmin = false,
): boolean {
  return capability === "admin.tiers.manage"
    ? isInstanceAdmin
    : tierCapabilities[tier].has(capability);
}

/**
 * Sprint 1 (2026-09-25, see docs/strategy/ROADMAP.md): paid plans are off the
 * product surface until 1.0.0 ships, so every household is served the
 * Optimize tier regardless of its stored entitlement. This is the single
 * place that decision is applied — `requireAuthenticatedContext` in
 * `src/lib/auth/context.ts` is the only caller. Everything upstream of it
 * (the `TierEntitlement` model, the entitlement lookup, `hasCapability`, and
 * the admin entitlement API) is unchanged, so restoring tiering later is one
 * line: return `storedTier` instead of the constant.
 */
export function resolveEffectiveTier(storedTier: ProductTier): ProductTier {
  void storedTier;
  return "optimize";
}
