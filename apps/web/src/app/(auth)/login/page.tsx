import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in · Zovate",
  description: "Sign in to your Zovate workspace",
};

export default function LoginPage() {
  return (
    <AuthSplitShell
      title="Welcome back"
      description="Sign in with your email or Google to pick up where you left off."
    >
      <Suspense
        fallback={
          <p className="text-sm text-neutral-500">Loading sign-in…</p>
        }
      >
        <LoginForm />
      </Suspense>
    </AuthSplitShell>
  );
}
