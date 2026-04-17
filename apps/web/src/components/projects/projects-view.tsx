"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CreateProjectModal } from "@/components/projects/create-project-modal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useProject } from "@/contexts/project-context";
import { useWorkspace } from "@/contexts/workspace-context";
import type { ProjectListFilters } from "@/lib/query-keys";
import type { Project } from "@/lib/projects-api";
import { projectKeys } from "@/lib/query-keys";
import { fetchProjects } from "@/lib/projects-api";
import { cn } from "@/lib/utils";

function formatUpdated(iso: string) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
    }).format(d);
  } catch {
    return iso;
  }
}

export function ProjectsView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setCurrentProjectId } = useProject();
  const { currentWorkspaceId, isLoading: workspaceLoading } = useWorkspace();
  const [createOpen, setCreateOpen] = useState(false);

  const listFilters = useMemo(
    (): ProjectListFilters => ({
      sortBy: "updatedAt",
      sortOrder: "desc",
    }),
    [],
  );

  const {
    data: projects = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: projectKeys.list(currentWorkspaceId ?? "__none__", listFilters),
    queryFn: () => fetchProjects(currentWorkspaceId!, listFilters),
    enabled: !!currentWorkspaceId,
  });

  const noWorkspace = !workspaceLoading && !currentWorkspaceId;

  function handleProjectCreated(project: Project) {
    if (!currentWorkspaceId) return;
    const listKey = projectKeys.list(currentWorkspaceId, {});
    const countBefore =
      queryClient.getQueryData<Project[]>(listKey)?.length ?? 0;
    queryClient.setQueryData<Project[]>(listKey, (prev) => {
      const list = prev ?? [];
      if (list.some((p) => p.id === project.id)) return list;
      return [...list, project];
    });
    setCurrentProjectId(project.id);
    void queryClient.invalidateQueries({ queryKey: projectKeys.all });
    if (countBefore === 0) {
      router.replace("/");
    }
  }

  return (
    <div className="p-6 md:p-10">
      <div className="flex justify-end">
        <Button
          type="button"
          className="shrink-0 gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={!currentWorkspaceId}
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-4" strokeWidth={2} />
          New project
        </Button>
      </div>

      <CreateProjectModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={currentWorkspaceId}
        onCreated={handleProjectCreated}
      />

      {noWorkspace ? (
        <div className="mt-10 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/80 px-6 py-12 text-center">
          <FolderKanban
            className="mx-auto size-10 text-neutral-300"
            strokeWidth={1.25}
          />
          <p className="mt-4 text-sm font-medium text-neutral-800">
            No workspace selected
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Use the workspace menu in the top bar to select or create a
            workspace.
          </p>
        </div>
      ) : null}

      {currentWorkspaceId && isLoading ? (
        <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Loading projects…
        </div>
      ) : null}

      {currentWorkspaceId && isError ? (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error instanceof Error ? error.message : "Could not load projects."}
        </p>
      ) : null}

      {currentWorkspaceId && !isLoading && !isError ? (
        <>
          {projects.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/80 px-6 py-12 text-center">
              <FolderKanban
                className="mx-auto size-10 text-neutral-300"
                strokeWidth={1.25}
              />
              <p className="mt-4 text-sm font-medium text-neutral-800">
                Create your first project
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Projects organize tasks and collaborators in this workspace.
                You&apos;ll go to the overview after you create one.
              </p>
              <Button
                type="button"
                className="mt-6 gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="size-4" strokeWidth={2} />
                Create your first project
              </Button>
            </div>
          ) : null}
          {projects.length > 0 ? (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((p) => (
                <li key={p.id}>
                  <Card className="shadow-none transition-colors hover:border-neutral-300">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base leading-snug">
                        {p.name}
                      </CardTitle>
                      {p.description ? (
                        <CardDescription className="line-clamp-2">
                          {p.description}
                        </CardDescription>
                      ) : null}
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span
                          className={cn(
                            "rounded-md border px-1.5 py-0.5 font-medium capitalize",
                            p.visibility === "private"
                              ? "border-amber-200/80 bg-amber-50 text-amber-900"
                              : p.visibility === "public"
                                ? "border-sky-200/80 bg-sky-50 text-sky-900"
                                : "border-neutral-200 bg-neutral-50 text-neutral-700",
                          )}
                        >
                          {p.visibility}
                        </span>
                        {p.isArchived ? (
                          <span className="rounded-md border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-600">
                            Archived
                          </span>
                        ) : null}
                        <span className="ml-auto">
                          Updated {formatUpdated(p.updatedAt)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
