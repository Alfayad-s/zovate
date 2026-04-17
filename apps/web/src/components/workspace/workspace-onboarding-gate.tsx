"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuthUser } from "@/hooks/use-auth";
import { useWorkspace } from "@/contexts/workspace-context";

export const CREATE_WORKSPACE_PATH = "/create/workspace";

function GateLoading() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-8 text-sm text-muted-foreground">
      <Loader2 className="size-8 animate-spin text-neutral-400" strokeWidth={2} />
      <p>Loading workspace…</p>
    </div>
  );
}

/**
 * Authenticated users must create a workspace before using the app shell routes.
 * Redirects to {@link CREATE_WORKSPACE_PATH} when the list is empty; redirects away
 * from that page once a workspace exists.
 */
export function WorkspaceOnboardingGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: user, isPending: authPending } = useAuthUser();
  const { workspaces, isLoading: workspacesLoading } = useWorkspace();

  const onCreatePath = pathname === CREATE_WORKSPACE_PATH;

  useEffect(() => {
    if (authPending) return;
    if (!user) {
      if (onCreatePath) {
        const q = new URLSearchParams({ from: CREATE_WORKSPACE_PATH });
        router.replace(`/login?${q.toString()}`);
      }
      return;
    }
    if (workspacesLoading) return;

    if (workspaces.length === 0 && !onCreatePath) {
      router.replace(CREATE_WORKSPACE_PATH);
      return;
    }
    if (workspaces.length > 0 && onCreatePath) {
      router.replace("/");
    }
  }, [
    authPending,
    user,
    workspacesLoading,
    workspaces.length,
    onCreatePath,
    router,
  ]);

  if (authPending) {
    return <GateLoading />;
  }

  if (!user) {
    if (onCreatePath) {
      return <GateLoading />;
    }
    return <>{children}</>;
  }

  if (workspacesLoading) {
    return <GateLoading />;
  }

  if (workspaces.length === 0 && !onCreatePath) {
    return <GateLoading />;
  }

  if (workspaces.length > 0 && onCreatePath) {
    return <GateLoading />;
  }

  return <>{children}</>;
}
