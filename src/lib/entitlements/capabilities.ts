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
