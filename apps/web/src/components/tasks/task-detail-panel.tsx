"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Clock3,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AssigneeAvatarStack } from "@/components/tasks/assignee-avatar-stack";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenuItem,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useAuthUser } from "@/hooks/use-auth";
import { commentKeys, taskKeys } from "@/lib/query-keys";
import {
  createTaskComment,
  deleteTaskComment,
  fetchTaskComments,
  updateTaskComment,
  type TaskComment,
} from "@/lib/comments-api";
import { deleteTask, fetchTask, patchTask, type TaskWithRelations } from "@/lib/tasks-api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function toDateInputValue(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function toTimeInputValue(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function toIsoFromLocalDateTime(date: string, time: string) {
  if (!date) return null;
  const t = time && time.trim().length > 0 ? time : "00:00";
  const local = new Date(`${date}T${t}:00`);
  if (Number.isNaN(local.getTime())) return null;
  return local.toISOString();
}

function stripMentions(text: string) {
  // Removes simple "@Name" or "@First Last" patterns and collapses whitespace.
  // This is UI-only (does not mutate stored task.description).
  return text
    .replace(/@\w+(?:\s+\w+)?/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
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

function priorityPillClass(priority: string) {
  switch (priority) {
    case "high":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70";
    case "urgent":
      return "bg-red-50 text-red-700 ring-1 ring-red-200/70";
    case "medium":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200/70";
    case "low":
      return "bg-sky-50 text-sky-700 ring-1 ring-sky-200/70";
    default:
      return "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200/70";
  }
}

type TaskDetailPanelProps = {
  workspaceId: string | null;
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectNameById?: Map<string, string>;
};

export function TaskDetailPanel({
  workspaceId,
  taskId,
  open,
  onOpenChange,
  projectNameById,
}: TaskDetailPanelProps) {
  const qc = useQueryClient();
  const { data: authUser } = useAuthUser();
  const enabled = Boolean(open && workspaceId && taskId);
  const [tab, setTab] = useState<"comments" | "updates">("comments");
  const [commentDraft, setCommentDraft] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [startDateDraft, setStartDateDraft] = useState("");
  const [startTimeDraft, setStartTimeDraft] = useState("");
  const [endDateDraft, setEndDateDraft] = useState("");
  const [endTimeDraft, setEndTimeDraft] = useState("");

  const { data: task, isLoading, isError, error } = useQuery({
    queryKey:
      workspaceId && taskId
        ? taskKeys.detail(workspaceId, taskId)
        : ["tasks", "detail", "skip"],
    queryFn: () => fetchTask(workspaceId!, taskId!),
    enabled,
  });

  // Deadline countdown (tick every second when dueDate exists)
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  const commentsEnabled = Boolean(
    open && workspaceId && taskId && tab === "comments",
  );
  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey:
      workspaceId && taskId
        ? commentKeys.list(workspaceId, taskId)
        : ["comments", "list", "skip"],
    queryFn: () => fetchTaskComments(workspaceId!, taskId!),
    enabled: commentsEnabled,
  });

  const projectName = task
    ? projectNameById?.get(task.projectId) ?? "Unknown project"
    : undefined;
  const due = task?.dueDate ? new Date(task.dueDate).getTime() : null;
  const deadline = useMemo(() => {
    if (!due) return null;
    const diff = due - nowMs;
    const abs = Math.abs(diff);
    const s = Math.floor(abs / 1000);
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;
    return {
      diff,
      label: `${String(days).padStart(2, "0")}:${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
      isOverdue: diff < 0,
    };
  }, [due, nowMs]);

  useEffect(() => {
    if (!task) return;
    setStartDateDraft(toDateInputValue(task.dueDate));
    setStartTimeDraft(toTimeInputValue(task.dueDate));
    setEndDateDraft(toDateInputValue(task.endDate));
    setEndTimeDraft(toTimeInputValue(task.endDate));
  }, [task]);

  const updatePriority = useMutation({
    mutationFn: async (priority: string) => {
      if (!workspaceId || !taskId) return null;
      return patchTask(workspaceId, taskId, { priority });
    },
    onSuccess: (next) => {
      if (!workspaceId || !taskId || !next) return;
      qc.setQueryData<TaskWithRelations>(taskKeys.detail(workspaceId, taskId), next);
      qc.setQueriesData(
        { queryKey: taskKeys.all },
        (prev: TaskWithRelations[] | TaskWithRelations | undefined) => {
          if (!prev) return prev;
          if (Array.isArray(prev)) {
            return prev.map((t) => (t.id === next.id ? { ...t, ...next } : t));
          }
          return (prev as TaskWithRelations).id === next.id ? { ...(prev as TaskWithRelations), ...next } : prev;
        },
      );
      void qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });

  const updateSchedule = useMutation({
    mutationFn: async (input: { dueDate: string | null; endDate: string | null }) => {
      if (!workspaceId || !taskId) return null;
      return patchTask(workspaceId, taskId, {
        dueDate: input.dueDate,
        endDate: input.endDate,
      });
    },
    onSuccess: (next) => {
      if (!workspaceId || !taskId || !next) return;
      qc.setQueryData<TaskWithRelations>(taskKeys.detail(workspaceId, taskId), next);
      qc.setQueriesData(
        { queryKey: taskKeys.all },
        (prev: TaskWithRelations[] | TaskWithRelations | undefined) => {
          if (!prev) return prev;
          if (Array.isArray(prev)) {
            return prev.map((t) => (t.id === next.id ? { ...t, ...next } : t));
          }
          return (prev as TaskWithRelations).id === next.id
            ? { ...(prev as TaskWithRelations), ...next }
            : prev;
        },
      );
      void qc.invalidateQueries({ queryKey: taskKeys.all });
      setStartDateDraft(toDateInputValue(next.dueDate));
      setStartTimeDraft(toTimeInputValue(next.dueDate));
      setEndDateDraft(toDateInputValue(next.endDate));
      setEndTimeDraft(toTimeInputValue(next.endDate));
      toast.success("Task schedule updated.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not update schedule.");
    },
  });

  const createComment = useMutation({
    mutationFn: async (content: string) => {
      if (!workspaceId || !taskId) throw new Error("Missing workspace/task");
      return createTaskComment(workspaceId, taskId, { content });
    },
    onSuccess: (created) => {
      if (!workspaceId || !taskId) return;
      qc.setQueryData<TaskComment[]>(
        commentKeys.list(workspaceId, taskId),
        (prev) => [...(prev ?? []), created],
      );
      setCommentDraft("");
    },
  });

  const saveComment = useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
      if (!workspaceId || !taskId) throw new Error("Missing workspace/task");
      return updateTaskComment(workspaceId, taskId, commentId, { content });
    },
    onSuccess: (updated) => {
      if (!workspaceId || !taskId) return;
      qc.setQueryData<TaskComment[]>(
        commentKeys.list(workspaceId, taskId),
        (prev) => (prev ?? []).map((c) => (c.id === updated.id ? updated : c)),
      );
      setEditingCommentId(null);
      setEditingValue("");
    },
  });

  const removeComment = useMutation({
    mutationFn: async (commentId: string) => {
      if (!workspaceId || !taskId) throw new Error("Missing workspace/task");
      await deleteTaskComment(workspaceId, taskId, commentId);
      return commentId;
    },
    onSuccess: (deletedId) => {
      if (!workspaceId || !taskId) return;
      qc.setQueryData<TaskComment[]>(
        commentKeys.list(workspaceId, taskId),
        (prev) => (prev ?? []).filter((c) => c.id !== deletedId),
      );
    },
  });

  const removeTask = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !taskId) throw new Error("Missing workspace/task");
      await deleteTask(workspaceId, taskId);
    },
    onSuccess: () => {
      if (!workspaceId || !taskId) return;
      void qc.invalidateQueries({ queryKey: taskKeys.all });
      void qc.invalidateQueries({ queryKey: commentKeys.all });
      onOpenChange(false);
      toast.success("Task deleted.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not delete task.");
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-hidden p-0" showClose>
        <div className="flex max-h-[100dvh] flex-col overflow-hidden">
          <SheetHeader className="shrink-0">
            {isLoading ? (
              <>
                <SheetTitle className="flex items-center gap-2 text-neutral-400">
                  <Loader2 className="size-5 animate-spin" strokeWidth={2} />
                  Loading…
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Loading task details
                </SheetDescription>
              </>
            ) : isError ? (
              <>
                <SheetTitle>Could not load task</SheetTitle>
                <SheetDescription>
                  {error instanceof Error ? error.message : "Something went wrong."}
                </SheetDescription>
              </>
            ) : task ? (
              <>
                <SheetTitle className="line-clamp-2">{task.title}</SheetTitle>
                <SheetDescription className="sr-only">
                  Task details including status, priority, and assignees.
                </SheetDescription>
              </>
            ) : (
              <>
                <SheetTitle>Task</SheetTitle>
                <SheetDescription>Select a task from the list.</SheetDescription>
              </>
            )}
          </SheetHeader>

          {task && !isLoading && !isError ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-5">
              <div className="space-y-5">
              {/* Header block (project name + big title + pills) */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-neutral-500">
                      {projectName ?? "Project"}
                    </p>
                    <h2 className="mt-1.5 line-clamp-3 text-[22px] font-semibold leading-tight tracking-tight text-neutral-950">
                      {task.title}
                    </h2>
                  </div>
                  <div className="shrink-0 pt-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-lg"
                          title="More"
                          aria-label="More"
                        >
                          <MoreHorizontal className="size-4" strokeWidth={1.75} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-700"
                          disabled={removeTask.isPending}
                          onClick={() => {
                            const confirmed = window.confirm(
                              "Delete this task? This action cannot be undone.",
                            );
                            if (!confirmed) return;
                            removeTask.mutate();
                          }}
                        >
                          {removeTask.isPending ? (
                            <Loader2
                              className="mr-2 size-4 animate-spin"
                              strokeWidth={2}
                            />
                          ) : (
                            <Trash2 className="mr-2 size-4" strokeWidth={1.75} />
                          )}
                          Delete task
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold transition hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
                          priorityPillClass(task.priority),
                        )}
                        aria-label="Change priority"
                        aria-busy={updatePriority.isPending}
                        disabled={updatePriority.isPending}
                      >
                        {updatePriority.isPending ? (
                          <Loader2 className="mr-1 size-3.5 animate-spin" strokeWidth={2} />
                        ) : null}
                        {priorityLabel(task.priority)} priority
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuLabel>Priority</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup
                        value={task.priority}
                        onValueChange={(v) => {
                          if (v && v !== task.priority) updatePriority.mutate(v);
                        }}
                      >
                        <DropdownMenuRadioItem value="low">Low</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="medium">Medium</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="high">High</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="urgent">Urgent</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[12px] font-medium text-neutral-700 ring-1 ring-neutral-200">
                    <Calendar className="size-4 text-neutral-500" strokeWidth={1.75} />
                    {formatDate(task.dueDate)}
                  </span>
                </div>
              </div>

              {/* Deadline countdown (or flexible deadline message) */}
              <Card className="rounded-2xl border-neutral-200 bg-gradient-to-r from-violet-50 via-purple-50 to-fuchsia-50 shadow-sm">
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex size-9 items-center justify-center rounded-xl bg-black/5 text-neutral-700">
                      <Clock3 className="size-4" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium text-neutral-600">
                        {task.dueDate ? "Time left until deadline" : "Deadline"}
                      </p>
                    </div>
                  </div>
                  {task.dueDate && deadline ? (
                    <p
                      className={cn(
                        "shrink-0 font-mono text-[18px] font-semibold",
                        deadline.isOverdue ? "text-red-700" : "text-neutral-900",
                      )}
                    >
                      {deadline.label}
                    </p>
                  ) : (
                    <p className="shrink-0 text-sm font-medium text-neutral-600">
                      Flexible deadline for this task
                    </p>
                  )}
                </div>
              </Card>

              {/* Description */}
              <div>
                <h3 className="text-[13px] font-semibold text-neutral-900">Schedule</h3>
                <div className="mt-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-neutral-600">Start day</p>
                      <Input
                        type="date"
                        value={startDateDraft}
                        onChange={(e) => setStartDateDraft(e.target.value)}
                        className="h-9 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-neutral-600">Start time</p>
                      <Input
                        type="time"
                        value={startTimeDraft}
                        onChange={(e) => setStartTimeDraft(e.target.value)}
                        className="h-9 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-neutral-600">End day</p>
                      <Input
                        type="date"
                        value={endDateDraft}
                        onChange={(e) => setEndDateDraft(e.target.value)}
                        className="h-9 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-neutral-600">End time</p>
                      <Input
                        type="time"
                        value={endTimeDraft}
                        onChange={(e) => setEndTimeDraft(e.target.value)}
                        className="h-9 rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg"
                      onClick={() => {
                        updateSchedule.mutate({ dueDate: null, endDate: null });
                      }}
                      disabled={updateSchedule.isPending}
                    >
                      Clear
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 rounded-lg"
                      disabled={updateSchedule.isPending}
                      onClick={() => {
                        const dueDateIso = toIsoFromLocalDateTime(
                          startDateDraft,
                          startTimeDraft,
                        );
                        const endDateIso = toIsoFromLocalDateTime(endDateDraft, endTimeDraft);
                        if (dueDateIso && endDateIso) {
                          const start = new Date(dueDateIso).getTime();
                          const end = new Date(endDateIso).getTime();
                          if (end < start) {
                            toast.error("End time must be after start time.");
                            return;
                          }
                        }
                        updateSchedule.mutate({
                          dueDate: dueDateIso,
                          endDate: endDateIso,
                        });
                      }}
                    >
                      {updateSchedule.isPending ? (
                        <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                      ) : null}
                      Save schedule
                    </Button>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-[13px] font-semibold text-neutral-900">
                  Description
                </h3>
                <div className="mt-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                  {task.description?.trim() ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
                      {stripMentions(task.description)}
                    </p>
                  ) : (
                    <p className="text-sm text-neutral-500">
                      No description yet.
                    </p>
                  )}
                </div>
                {task.assignees.length > 0 ? (
                  <div className="mt-2 flex items-center justify-end">
                    <AssigneeAvatarStack
                      assignees={task.assignees}
                      size="md"
                      max={4}
                    />
                  </div>
                ) : null}
              </div>

              {/* Attachments (UI placeholder for now) */}
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[13px] font-semibold text-neutral-900">
                    Attachments
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => {}}
                  >
                    <Paperclip className="size-4" strokeWidth={1.75} />
                    Add
                  </Button>
                </div>

                <div className="mt-2 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-600">
                  No attachments yet.
                </div>
              </div>

              {/* Comments / Updates */}
              <div>
                <div className="flex items-center gap-4 border-b border-neutral-200">
                  <button
                    type="button"
                    className={cn(
                      "relative -mb-px px-1 pb-3 text-sm font-semibold transition-colors",
                      tab === "comments"
                        ? "text-neutral-950"
                        : "text-neutral-500 hover:text-neutral-900",
                    )}
                    onClick={() => setTab("comments")}
                  >
                    Comments
                    {tab === "comments" ? (
                      <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-neutral-900" />
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "relative -mb-px px-1 pb-3 text-sm font-semibold transition-colors",
                      tab === "updates"
                        ? "text-neutral-950"
                        : "text-neutral-500 hover:text-neutral-900",
                    )}
                    onClick={() => setTab("updates")}
                  >
                    Updates
                    {tab === "updates" ? (
                      <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-neutral-900" />
                    ) : null}
                  </button>
                </div>

                {tab === "comments" ? (
                  <div className="mt-4 space-y-4 pb-36">
                    {commentsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-neutral-500">
                        <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                        Loading comments…
                      </div>
                    ) : comments.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-600">
                        No comments yet.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {comments.map((c) => {
                          const displayName =
                            c.user.fullName?.trim() || c.user.email;
                          const isMine = authUser?.id === c.userId;
                          const isEditing = editingCommentId === c.id;
                          return (
                            <div key={c.id} className="flex items-start gap-3">
                              {c.user.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={c.user.avatarUrl}
                                  alt=""
                                  className="size-9 shrink-0 rounded-full object-cover ring-2 ring-white"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-700 ring-2 ring-white">
                                  {displayName.slice(0, 1).toUpperCase()}
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="truncate text-sm font-semibold text-neutral-900">
                                    {displayName}
                                  </p>
                                  {isMine ? (
                                    <div className="flex shrink-0 items-center gap-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2 text-xs"
                                        onClick={() => {
                                          setEditingCommentId(c.id);
                                          setEditingValue(c.content);
                                        }}
                                      >
                                        Edit
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2 text-xs text-red-600 hover:text-red-700"
                                        onClick={() => removeComment.mutate(c.id)}
                                        disabled={removeComment.isPending}
                                      >
                                        Delete
                                      </Button>
                                    </div>
                                  ) : null}
                                </div>

                                {isEditing ? (
                                  <div className="mt-2">
                                    <textarea
                                      className="min-h-[84px] w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus-visible:ring-2 focus-visible:ring-primary/35"
                                      value={editingValue}
                                      onChange={(e) => setEditingValue(e.target.value)}
                                    />
                                    <div className="mt-2 flex justify-end gap-2">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setEditingCommentId(null);
                                          setEditingValue("");
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() =>
                                          saveComment.mutate({
                                            commentId: c.id,
                                            content: editingValue,
                                          })
                                        }
                                        disabled={saveComment.isPending || editingValue.trim().length === 0}
                                      >
                                        Save
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                                    {c.content}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-600">
                    Updates will appear here.
                  </div>
                )}
              </div>
              </div>
              </div>

              {tab === "comments" ? (
                <div className="shrink-0 border-t border-neutral-200 bg-white px-6 py-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                      <MessageSquare className="size-4" strokeWidth={1.75} />
                      Add a comment
                  </div>
                  <div className="mt-2 relative">
                    <textarea
                      className="min-h-[46px] max-h-32 w-full resize-none rounded-2xl border border-neutral-200 bg-white px-4 py-3 pr-24 text-sm text-neutral-900 outline-none transition focus-visible:ring-2 focus-visible:ring-primary/35"
                      placeholder="Write a comment…"
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                    />
                    <Button
                      type="button"
                      className="absolute right-2 top-1/2 h-9 -translate-y-1/2 rounded-xl px-4"
                      onClick={() => createComment.mutate(commentDraft.trim())}
                      disabled={
                        createComment.isPending || commentDraft.trim().length === 0
                      }
                    >
                      {createComment.isPending ? (
                        <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                      ) : null}
                      Send
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
