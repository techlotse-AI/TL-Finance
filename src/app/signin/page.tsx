import Link from "next/link";

import { AuthForm } from "@/components/auth-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default function SignInPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageHeader description="Use a revocable database-backed session." title="Sign in" />
      <Card className="p-6">
        <AuthForm mode="signin" />
        <div className="mt-5 grid gap-2 text-center text-sm text-subdued">
          <Link className="text-brand-teal" href="/signup">Create an account</Link>
          <Link className="text-brand-teal" href="/forgot-password">Forgot password?</Link>
          <Link className="text-brand-teal" href="/request-verification">Resend verification email</Link>
        </div>
      </Card>
    </div>
  );
}
