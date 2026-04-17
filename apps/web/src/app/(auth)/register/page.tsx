import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Create account · Zovate",
  description: "Create a Zovate workspace account",
};

export default function RegisterPage() {
  return (
    <AuthSplitShell
      title="Create your workspace"
      description="Set up your account in a minute. You can invite your team later."
    >
      <Suspense
        fallback={
          <p className="text-sm text-neutral-500">Loading registration…</p>
        }
      >
        <RegisterForm />
      </Suspense>
    </AuthSplitShell>
  );
}
