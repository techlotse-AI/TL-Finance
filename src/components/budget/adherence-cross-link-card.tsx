import { TrendingUp } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";

/**
 * Budget must not compute or own adherence (planned-vs-actual is an
 * Analyze-tier concept, see AGENTS.md tier boundaries) — this only cross-links
 * to it, so Budget users know it exists without duplicating the calculation.
 */
export function AdherenceCrossLinkCard() {
  return (
    <Card className="flex items-center gap-3 p-4 text-sm">
      <TrendingUp aria-hidden="true" className="size-5 shrink-0 text-brand-teal" strokeWidth={1.5} />
      <p>
        See how actual spending tracks against this plan in{" "}
        <Link className="font-medium text-brand-teal hover:underline" href="/analysis">
          Analyze → Adherence
        </Link>
        .
      </p>
    </Card>
  );
}
