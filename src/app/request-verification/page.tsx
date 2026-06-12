import Link from "next/link";

import { AccountEmailRequestForm } from "@/components/account-token-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default function RequestVerificationPage() {
  return <div className="mx-auto max-w-md space-y-6">
    <PageHeader title="Verify email" description="Request a new email-verification link." />
    <Card className="p-6"><AccountEmailRequestForm kind="verify-email" /><p className="mt-5 text-center text-sm"><Link className="text-brand-teal" href="/signin">Return to sign in</Link></p></Card>
  </div>;
}
