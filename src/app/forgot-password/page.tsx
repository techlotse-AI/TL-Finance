import Link from "next/link";

import { AccountEmailRequestForm } from "@/components/account-token-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default function ForgotPasswordPage() {
  return <div className="mx-auto max-w-md space-y-6">
    <PageHeader title="Reset password" description="Request a one-hour password-reset link." />
    <Card className="p-6"><AccountEmailRequestForm kind="password-reset" /><p className="mt-5 text-center text-sm"><Link className="text-brand-teal" href="/signin">Return to sign in</Link></p></Card>
  </div>;
}
