import { TrendingUp } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import type { ProductTier } from "@/lib/entitlements/capabilities";

/**
 * Budget must not compute or own adherence (planned-vs-actual is an
 * Analyze-tier concept, see AGENTS.md tier boundaries) — this only cross-links
 * to it, gated by entitlement, so Budget users know it exists without
 * duplicating the calculation.
 */
export function AdherenceCrossLinkCard({ tier }: { tier: ProductTier }) {
  const unlocked = tier !== "budget";
  return (
    <Card className="flex items-center gap-3 p-4 text-sm">
      <TrendingUp aria-hidden="true" className="size-5 shrink-0 text-brand-teal" strokeWidth={1.5} />
      {unlocked ? (
        <p>
          See how actual spending tracks against this plan in{" "}
          <Link className="font-medium text-brand-teal hover:underline" href="/analysis">
            Analyze → Adherence
          </Link>
          .
        </p>
      ) : (
        <p>
          Planned-versus-actual adherence tracking is part of the{" "}
          <Link className="font-medium text-brand-teal hover:underline" href="/analysis">
            Analyze tier
          </Link>
          .
        </p>
      )}
    </Card>
  );
}
