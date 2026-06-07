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
        <p className="mt-5 text-center text-sm text-subdued"><Link className="text-brand-teal" href="/signup">Create an account</Link></p>
      </Card>
    </div>
  );
}
