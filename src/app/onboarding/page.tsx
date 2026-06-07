import { Badge } from "@/components/ui/badge";
import { OnboardingForm } from "@/components/onboarding-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default function OnboardingPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        description="Create the tenant boundary and copy an editable category preset."
        title="Household setup"
      />
      <Card className="p-6">
        <div className="mb-5 rounded border bg-muted/40 p-4 text-sm text-subdued">
          <Badge tone="success">Transactional onboarding</Badge>
          <p className="mt-3">The selected editable category preset is copied into the new household.</p>
        </div>
        <OnboardingForm />
      </Card>
    </div>
  );
}
