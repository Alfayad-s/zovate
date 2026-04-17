"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckSquare, Loader2 } from "lucide-react";
import { useMemo } from "react";

import { useWorkspace } from "@/contexts/workspace-context";
import {
  projectKeys,
  taskKeys,
  type TaskListFilters,
} from "@/lib/query-keys";
import { workspaceLiveQueryOptions } from "@/lib/realtime-query";
import { fetchProjects } from "@/lib/projects-api";
import { AssigneeAvatarStack } from "@/components/tasks/assignee-avatar-stack";
import { cn } from "@/lib/utils";
import { fetchTasks, type TaskWithRelations } from "@/lib/tasks-api";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function priorityLabel(p: string) {
  const labels: Record<string, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
    urgent: "Urgent",
  };
  return labels[p] ?? p;
}

type TaskListViewProps = {
  selectedTaskId: string | null;
  onSelectTask: (taskId: string | null) => void;
};

export function TaskListView({
  selectedTaskId,
  onSelectTask,
}: TaskListViewProps) {
  const { currentWorkspaceId, isLoading: workspaceLoading } = useWorkspace();

  const listFilters = useMemo((): TaskListFilters => ({}), []);

  const {
    data: tasks = [],
    isLoading: tasksLoading,
    isError: tasksError,
    error: tasksErr,
  } = useQuery({
    queryKey: taskKeys.list(currentWorkspaceId ?? "__none__", listFilters),
    queryFn: () => fetchTasks(currentWorkspaceId!, listFilters),
    enabled: !!currentWorkspaceId,
    ...workspaceLiveQueryOptions,
  });

  const { data: projects = [] } = useQuery({
    queryKey: projectKeys.list(currentWorkspaceId ?? "__none__", {}),
    queryFn: () => fetchProjects(currentWorkspaceId!, {}),
    enabled: !!currentWorkspaceId,
  });

  const projectNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p.id, p.name);
    return m;
  }, [projects]);

  const noWorkspace = !workspaceLoading && !currentWorkspaceId;

  return (
    <div className="space-y-6">
      {noWorkspace ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/80 px-6 py-12 text-center">
          <CheckSquare
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

      {currentWorkspaceId && tasksLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" strokeWidth={2} />
          Loading tasks…
        </div>
      ) : null}

      {currentWorkspaceId && tasksError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {tasksErr instanceof Error ? tasksErr.message : "Failed to load tasks."}
        </div>
      ) : null}

      {currentWorkspaceId && !tasksLoading && !tasksError ? (
        tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-white px-6 py-14 text-center">
            <p className="text-sm font-medium text-neutral-800">No tasks yet</p>
            <p className="mt-1 text-sm text-neutral-500">
              Tasks will appear here when they exist in this workspace.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/90">
                    <th className="px-4 py-3 font-semibold text-neutral-700">
                      Title
                    </th>
                    <th className="px-4 py-3 font-semibold text-neutral-700">
                      Project
                    </th>
                    <th className="px-4 py-3 font-semibold text-neutral-700">
                      Status
                    </th>
                    <th className="px-4 py-3 font-semibold text-neutral-700">
                      Priority
                    </th>
                    <th className="px-4 py-3 font-semibold text-neutral-700">
                      Due
                    </th>
                    <th className="px-4 py-3 font-semibold text-neutral-700">
                      Assignees
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      projectName={projectNameById.get(task.projectId) ?? "—"}
                      selected={task.id === selectedTaskId}
                      onSelect={() =>
                        onSelectTask(task.id === selectedTaskId ? null : task.id)
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}

function TaskRow({
  task,
  projectName,
  selected,
  onSelect,
}: {
  task: TaskWithRelations;
  projectName: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "cursor-pointer border-b border-neutral-100 transition-colors last:border-b-0",
        selected
          ? "bg-primary/5 hover:bg-primary/10"
          : "hover:bg-neutral-50/80",
      )}
    >
      <td className="max-w-[min(28rem,40vw)] px-4 py-3">
        <span className="font-medium text-neutral-900 line-clamp-2">
          {task.title}
        </span>
        {task.isArchived ? (
          <span className="ml-2 inline-block rounded-md bg-neutral-200/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
            Archived
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-neutral-700">{projectName}</td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5">
          {task.status.color ? (
            <span
              className="size-2 shrink-0 rounded-full border border-neutral-200/80"
              style={{ backgroundColor: task.status.color }}
              aria-hidden
            />
          ) : null}
          {task.status.name}
        </span>
      </td>
      <td className="px-4 py-3 capitalize text-neutral-700">
        {priorityLabel(task.priority)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-neutral-600">
        {formatDate(task.dueDate)}
      </td>
      <td className="max-w-[12rem] px-4 py-3 text-neutral-600">
        {task.assignees.length === 0 ? (
          "—"
        ) : (
          <AssigneeAvatarStack assignees={task.assignees} size="sm" max={4} />
        )}
      </td>
    </tr>
  );
}
