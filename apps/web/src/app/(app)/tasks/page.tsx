"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { TaskCalendarView } from "@/components/tasks/task-calendar-view";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { TaskKanbanBoard } from "@/components/tasks/task-kanban-board";
import { TaskListView } from "@/components/tasks/task-list-view";
import { parseTaskViewParam } from "@/components/tasks/task-view-tabs";
import { useWorkspace } from "@/contexts/workspace-context";
import { projectKeys } from "@/lib/query-keys";
import { fetchProjects } from "@/lib/projects-api";
import { cn } from "@/lib/utils";

function TasksPageContent() {
  const { currentWorkspaceId } = useWorkspace();
  const searchParams = useSearchParams();
  const view = parseTaskViewParam(searchParams.get("view"));
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: projectKeys.list(currentWorkspaceId ?? "__none__", {}),
    queryFn: () => fetchProjects(currentWorkspaceId!, {}),
    enabled: !!currentWorkspaceId,
  });

  const projectNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) {
      m.set(p.id, p.name);
    }
    return m;
  }, [projects]);

  return (
    <div
      className={cn(
        "p-3 md:p-4",
        (view === "kanban" || view === "calendar") && "flex h-full min-h-0 flex-col",
      )}
    >
      {view === "table" ? (
        <TaskListView
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
        />
      ) : null}
      {view === "kanban" ? (
        <TaskKanbanBoard
          className="min-h-0 flex-1"
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
        />
      ) : null}
      {view === "calendar" ? (
        <TaskCalendarView
          className="min-h-0 flex-1"
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
        />
      ) : null}

      <TaskDetailPanel
        workspaceId={currentWorkspaceId}
        taskId={selectedTaskId}
        open={selectedTaskId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedTaskId(null);
        }}
        projectNameById={projectNameById}
      />
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center p-6 text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <TasksPageContent />
    </Suspense>
  );
}
