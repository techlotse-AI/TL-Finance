import { TokenCompleteForm } from "@/components/account-token-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <div className="mx-auto max-w-md space-y-6"><PageHeader title="Set a new password" description="Completing this reset revokes every existing session." /><Card className="p-6"><TokenCompleteForm kind="password-reset" token={token} /></Card></div>;
}
