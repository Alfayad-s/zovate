"use client";

import {
  Building2,
  Check,
  ChevronsUpDown,
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
import { useWorkspace } from "@/contexts/workspace-context";
import type { Workspace } from "@/lib/workspaces-api";
import { cn } from "@/lib/utils";

function WorkspaceGlyph({
  workspace,
  size = "md",
}: {
  workspace: Pick<Workspace, "name" | "logoUrl">;
  size?: "md" | "sm";
}) {
  const box = size === "sm" ? "size-6" : "size-7";
  const initial = (workspace.name?.[0] ?? "?").toUpperCase();
  if (workspace.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={workspace.logoUrl}
        alt=""
        className={cn(box, "shrink-0 rounded-md object-contain")}
      />
    );
  }
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

export function WorkspaceSwitcher({
  collapsed,
  onCreateWorkspace,
}: {
  collapsed: boolean;
  onCreateWorkspace: () => void;
}) {
  const {
    workspaces,
    currentWorkspace,
    currentWorkspaceId,
    setCurrentWorkspaceId,
    isLoading,
  } = useWorkspace();

  if (isLoading && workspaces.length === 0) {
    return (
      <div
        className={cn(
          "flex min-h-8 items-center gap-2 text-neutral-400",
          collapsed ? "justify-center px-0" : "px-1",
        )}
      >
        <Loader2 className="size-4 shrink-0 animate-spin" />
        {!collapsed && (
          <span className="truncate text-xs">Workspaces…</span>
        )}
      </div>
    );
  }

  const label = currentWorkspace?.name ?? "Select workspace";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "h-auto min-h-8 w-full justify-between gap-1.5 rounded-lg px-1.5 py-1 text-left font-normal hover:bg-neutral-100",
            collapsed && "size-8 min-w-0 shrink-0 justify-center p-0",
          )}
          title={collapsed ? label : undefined}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            {currentWorkspace ? (
              <WorkspaceGlyph workspace={currentWorkspace} />
            ) : (
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-700">
                <Building2 className="size-3.5" strokeWidth={1.75} aria-hidden />
              </span>
            )}
            {!collapsed && (
              <span className="min-w-0 flex-1 truncate text-left text-[12px] font-semibold leading-tight text-neutral-900">
                {label}
              </span>
            )}
          </span>
          {!collapsed && (
            <ChevronsUpDown className="size-3.5 shrink-0 text-neutral-400" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[240px]">
        <DropdownMenuLabel className="normal-case text-neutral-500">
          Workspaces
        </DropdownMenuLabel>
        {workspaces.length === 0 ? (
          <div className="px-2 py-2 text-xs text-neutral-500">
            No workspaces yet. Create one to get started.
          </div>
        ) : (
          workspaces.map((w) => (
            <DropdownMenuItem
              key={w.id}
              className="cursor-pointer gap-2"
              onClick={() => setCurrentWorkspaceId(w.id)}
            >
              <WorkspaceGlyph workspace={w} size="sm" />
              <span className="flex-1 truncate">{w.name}</span>
              {w.id === currentWorkspaceId ? (
                <Check className="size-4 shrink-0 text-primary" />
              ) : null}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-neutral-900"
          onClick={() => onCreateWorkspace()}
        >
          <Plus className="size-4" />
          Create workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
