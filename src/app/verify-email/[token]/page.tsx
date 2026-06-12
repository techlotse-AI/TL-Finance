import { TokenCompleteForm } from "@/components/account-token-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <div className="mx-auto max-w-md space-y-6"><PageHeader title="Verify email" description="Confirm this address before signing in." /><Card className="p-6"><TokenCompleteForm kind="verify-email" token={token} /></Card></div>;
}
