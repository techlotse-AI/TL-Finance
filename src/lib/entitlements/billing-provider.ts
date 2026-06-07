import type { ProductTier } from "@/lib/entitlements/capabilities";

export interface BillingEntitlement {
  householdId: string;
  tier: ProductTier;
  source: string;
  externalReference?: string;
  effectiveAt: Date;
  expiresAt?: Date;
}

/**
 * Boundary for a future billing integration. v0.1.0 uses manual administrator
 * assignment and intentionally provides no payment-provider implementation.
 */
export interface BillingProvider {
  readonly key: string;
  getEntitlement(householdId: string): Promise<BillingEntitlement | null>;
  parseEntitlementUpdates(
    payload: Uint8Array,
    signature: string,
  ): Promise<readonly BillingEntitlement[]>;
}
