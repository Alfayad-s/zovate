"use client";

import {
  Check,
  ChevronsUpDown,
  FolderKanban,
  Loader2,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProject } from "@/contexts/project-context";
import { useWorkspace } from "@/contexts/workspace-context";
import type { Project } from "@/lib/projects-api";
import { cn } from "@/lib/utils";

function ProjectGlyph({
  project,
  size = "md",
}: {
  project: Pick<Project, "name">;
  size?: "md" | "sm";
}) {
  const box = size === "sm" ? "size-6" : "size-7";
  const initial = (project.name?.[0] ?? "?").toUpperCase();
  return (
    <span
      className={cn(
        box,
        "flex shrink-0 items-center justify-center rounded-md bg-neutral-100 text-[10px] font-semibold text-neutral-600",
        size === "sm" && "text-[9px]",
      )}
      aria-hidden
    >
      {initial}
    </span>
  );
}

export function ProjectSwitcher({
  onCreateProject,
}: {
  onCreateProject: () => void;
}) {
  const { currentWorkspaceId } = useWorkspace();
  const {
    projects,
    currentProject,
    currentProjectId,
    setCurrentProjectId,
    isLoading,
  } = useProject();

  if (!currentWorkspaceId) {
    return null;
  }

  if (isLoading && projects.length === 0) {
    return (
      <div className="flex min-h-8 items-center gap-2 px-1 text-neutral-400">
        <Loader2 className="size-4 shrink-0 animate-spin" />
        <span className="truncate text-xs">Projects…</span>
      </div>
    );
  }

  const label = currentProject?.name ?? "Select project";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-auto min-h-8 w-full max-w-full justify-between gap-1.5 rounded-lg px-1.5 py-1 text-left font-normal hover:bg-neutral-100"
          title={label}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            {currentProject ? (
              <ProjectGlyph project={currentProject} />
            ) : (
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-700">
                <FolderKanban className="size-3.5" strokeWidth={1.75} aria-hidden />
              </span>
            )}
            <span className="min-w-0 flex-1 truncate text-left text-[12px] font-semibold leading-tight text-neutral-900">
              {label}
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-neutral-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[240px]">
        <DropdownMenuLabel className="normal-case text-neutral-500">
          Projects
        </DropdownMenuLabel>
        {projects.length === 0 ? (
          <div className="px-2 py-2 text-xs text-neutral-500">
            No projects yet. Create one to get started.
          </div>
        ) : (
          projects.map((p) => (
            <DropdownMenuItem
              key={p.id}
              className="cursor-pointer gap-2"
              onClick={() => setCurrentProjectId(p.id)}
            >
              <ProjectGlyph project={p} size="sm" />
              <span className="flex-1 truncate">{p.name}</span>
              {p.id === currentProjectId ? (
                <Check className="size-4 shrink-0 text-primary" />
              ) : null}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-neutral-900"
          onClick={() => onCreateProject()}
        >
          <Plus className="size-4" />
          Create project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
