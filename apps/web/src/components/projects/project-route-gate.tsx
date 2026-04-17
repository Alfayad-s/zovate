"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { CREATE_WORKSPACE_PATH } from "@/components/workspace/workspace-onboarding-gate";
import { useProject } from "@/contexts/project-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAuthUser } from "@/hooks/use-auth";

function GateLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-8 text-sm text-muted-foreground">
      <Loader2 className="size-8 animate-spin text-neutral-400" strokeWidth={2} />
      <p>{label}</p>
    </div>
  );
}

/** Allowed app routes when the current workspace has zero projects. */
export function isAllowedPathWithNoProjects(pathname: string): boolean {
  if (pathname === "/projects" || pathname.startsWith("/projects/")) {
    return true;
  }
  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return true;
  }
  return false;
}

/**
 * With a workspace selected but no projects yet, only `/projects` and `/settings`
 * are reachable; everything else redirects to `/projects`.
 */
export function ProjectRouteGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: user, isPending: authPending } = useAuthUser();
  const { currentWorkspaceId, isLoading: workspacesLoading } = useWorkspace();
  const { projects, isLoading: projectsLoading } = useProject();

  useEffect(() => {
    if (authPending || !user) return;
    if (!currentWorkspaceId || workspacesLoading) return;
    if (projectsLoading) return;
    if (pathname === CREATE_WORKSPACE_PATH) return;

    if (projects.length === 0 && !isAllowedPathWithNoProjects(pathname)) {
      router.replace("/projects");
    }
  }, [
    authPending,
    user,
    currentWorkspaceId,
    workspacesLoading,
    projectsLoading,
    projects.length,
    pathname,
    router,
  ]);

  if (authPending || !user) {
    return <>{children}</>;
  }

  if (!currentWorkspaceId || workspacesLoading) {
    return <>{children}</>;
  }

  if (projectsLoading) {
    return <GateLoading label="Loading projects…" />;
  }

  if (projects.length === 0 && !isAllowedPathWithNoProjects(pathname)) {
    return <GateLoading label="Opening projects…" />;
  }

  return <>{children}</>;
}
