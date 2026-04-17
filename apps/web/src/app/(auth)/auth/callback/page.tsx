"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { authKeys } from "@/lib/query-keys";
import { setStoredAccessToken } from "@/lib/auth-storage";

function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    const token = searchParams.get("access_token");
    if (!token) {
      setMessage("Missing access token. Close this tab and try Google sign-in again.");
      return;
    }
    setStoredAccessToken(token);
    void queryClient.invalidateQueries({ queryKey: authKeys.user() });
    // Full navigation so the proxy sees the new session cookie (soft nav can race middleware).
    window.location.replace("/");
  }, [searchParams, queryClient]);

  return (
    <p className="text-center text-sm text-muted-foreground">{message}</p>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-[#fff] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200/80 bg-white px-6 py-8 shadow-sm">
        <Suspense
          fallback={
            <p className="text-center text-sm text-muted-foreground">
              Loading…
            </p>
          }
        >
          <AuthCallbackContent />
        </Suspense>
      </div>
    </div>
  );
}
