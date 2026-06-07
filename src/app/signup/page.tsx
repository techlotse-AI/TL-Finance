import Link from "next/link";

import { AuthForm } from "@/components/auth-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default function SignUpPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageHeader description="Create a local account. Financial data stays in this deployment." title="Sign up" />
      <Card className="p-6">
        <AuthForm mode="signup" />
        <p className="mt-5 text-center text-sm text-subdued"><Link className="text-brand-teal" href="/signin">Sign in</Link></p>
      </Card>
    </div>
  );
}
