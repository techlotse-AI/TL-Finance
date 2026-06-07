import { LockKeyhole } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

interface LockedTierPageProps {
  title: string;
  tier: "Analyze" | "Optimize";
  description: string;
  capabilities: string[];
}

export function LockedTierPage({
  title,
  tier,
  description,
  capabilities,
}: LockedTierPageProps) {
  return (
    <div className="mx-auto max-w-app space-y-6">
      <PageHeader description={description} eyebrow={`${tier} tier`} title={title} />
      <Card className="mx-auto max-w-2xl p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg border bg-muted">
            <LockKeyhole className="size-5 text-brand-teal" strokeWidth={1.5} />
          </span>
          <div>
            <Badge tone="locked">{tier} · Upgrade required</Badge>
            <h2 className="mt-4 text-lg font-semibold">This household cannot access this tier</h2>
            <p className="mt-2 text-sm leading-6 text-subdued">
              This surface remains visible so the product structure is clear. Server-side
              entitlements are authoritative and no protected data or calculations run here.
            </p>
            <ul className="mt-5 grid gap-2 text-sm text-subdued sm:grid-cols-2">
              {capabilities.map((capability) => (
                <li className="rounded border bg-muted/40 px-3 py-2" key={capability}>
                  {capability}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
