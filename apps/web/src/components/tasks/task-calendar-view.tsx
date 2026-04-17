"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Calendar as CalendarIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useProject } from "@/contexts/project-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { projectKeys, taskKeys, type TaskListFilters } from "@/lib/query-keys";
import { workspaceLiveQueryOptions } from "@/lib/realtime-query";
import { fetchProjects } from "@/lib/projects-api";
import { AssigneeAvatarStack } from "@/components/tasks/assignee-avatar-stack";
import { cn } from "@/lib/utils";
import { createTask, fetchTaskStatuses, fetchTasks } from "@/lib/tasks-api";
import { toast } from "sonner";

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type CalendarMode = "month" | "week" | "day" | "3d" | "1day";

function startOfDay(d: Date) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function startOfWeek(d: Date) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - out.getDay());
  return out;
}

function buildMonthCells(anchor: Date): (Date | null)[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const lastDay = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  const startPad = first.getDay();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let day = 1; day <= lastDay; day++) {
    cells.push(new Date(anchor.getFullYear(), anchor.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function addDays(d: Date, days: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function secondsSinceStart(d: Date) {
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

function formatTimeFromSecond(secondOfDay: number) {
  const base = new Date(2000, 0, 1, 0, 0, 0, 0);
  base.setSeconds(clamp(secondOfDay, 0, 24 * 60 * 60 - 1));
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(base);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function positionValue(p: unknown): number {
  if (p === null || p === undefined) return 0;
  if (typeof p === "number") return p;
  if (typeof p === "string") return parseFloat(p) || 0;
  if (typeof p === "object" && p !== null && "toString" in p) {
    const s = String(p);
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

type TaskCalendarViewProps = {
  className?: string;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string | null) => void;
};

export function TaskCalendarView({
  className,
  selectedTaskId,
  onSelectTask,
}: TaskCalendarViewProps) {
  const queryClient = useQueryClient();
  const { currentWorkspaceId, isLoading: workspaceLoading } = useWorkspace();
  const { currentProjectId } = useProject();
  const [mode, setMode] = useState<CalendarMode>("week");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setSeconds(0, 0);
    return d;
  });

  const headerMonthLabel = useMemo(() => {
    return new Intl.DateTimeFormat(undefined, {
      month: "long",
      year: "numeric",
    }).format(cursor);
  }, [cursor]);

  const listFilters: TaskListFilters = {};
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
  const { data: statuses = [] } = useQuery({
    queryKey: taskKeys.statuses(currentWorkspaceId ?? "__none__"),
    queryFn: () => fetchTaskStatuses(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
    ...workspaceLiveQueryOptions,
  });

  const projectNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p.id, p.name);
    return m;
  }, [projects]);

  const noWorkspace = !workspaceLoading && !currentWorkspaceId;
  const createTaskProjectId =
    currentProjectId && projects.some((p) => p.id === currentProjectId)
      ? currentProjectId
      : projects[0]?.id ?? null;
  const defaultStatusId = useMemo(() => {
    const sorted = [...statuses].sort(
      (a, b) => positionValue(a.position) - positionValue(b.position),
    );
    return sorted[0]?.id ?? null;
  }, [statuses]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekStart = useMemo(() => startOfWeek(cursor), [cursor]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const timeMaxSeconds = 24 * 60 * 60;

  function prev() {
    setCursor((d) => {
      if (mode === "day") return addDays(d, -1);
      if (mode === "1day") return addDays(d, -1);
      if (mode === "3d") return addDays(d, -3);
      if (mode === "week") return addDays(d, -7);
      // month
      return new Date(d.getFullYear(), d.getMonth() - 1, 1);
    });
  }
  function next() {
    setCursor((d) => {
      if (mode === "day") return addDays(d, 1);
      if (mode === "1day") return addDays(d, 1);
      if (mode === "3d") return addDays(d, 3);
      if (mode === "week") return addDays(d, 7);
      return new Date(d.getFullYear(), d.getMonth() + 1, 1);
    });
  }
  function goToday() {
    const d = new Date();
    d.setSeconds(0, 0);
    setCursor(d);
  }
  function goTomorrow() {
    const d = addDays(new Date(), 1);
    d.setSeconds(0, 0);
    setCursor(d);
  }

  const monthCells = useMemo(() => buildMonthCells(cursor), [cursor]);
  const monthWeeks = useMemo(() => {
    const rows: (Date | null)[][] = [];
    for (let i = 0; i < monthCells.length; i += 7) {
      rows.push(monthCells.slice(i, i + 7));
    }
    return rows;
  }, [monthCells]);

  const daysToRender = useMemo(() => {
    if (mode === "day") return [startOfDay(cursor)];
    if (mode === "1day") return [startOfDay(cursor)];
    if (mode === "3d") {
      const start = startOfDay(cursor);
      return [start, addDays(start, 1), addDays(start, 2)];
    }
    return weekDays;
  }, [mode, cursor, weekDays]);

  const stripDays = useMemo(() => {
    if (mode === "week" || mode === "day") return weekDays;
    return daysToRender;
  }, [mode, weekDays, daysToRender]);

  const visibleTasks = useMemo(() => {
    const start = new Date(startOfDay(daysToRender[0] ?? cursor));
    const end = addDays(startOfDay(daysToRender[daysToRender.length - 1] ?? cursor), 1);
    return tasks.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d >= start && d < end;
    });
  }, [tasks, daysToRender, cursor]);

  const [hourRowPx, setHourRowPx] = useState(() => {
    if (typeof window === "undefined") return 96;
    const raw = window.localStorage.getItem("zovate:calendar:hourRowPx");
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    // Larger default + larger min/max so rows feel "square" and readable.
    return Number.isFinite(parsed) ? Math.max(72, Math.min(220, parsed)) : 96;
  });
  const wheelZoomCarryRef = useRef(0);
  const timeGridScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem("zovate:calendar:hourRowPx", String(hourRowPx));
    } catch {
      /* ignore */
    }
  }, [hourRowPx]);

  const handleNativeWheel = useCallback((e: WheelEvent) => {
    if (!e.shiftKey) return;
    // Need a non-passive listener for preventDefault.
    e.preventDefault();
    e.stopPropagation();
    // On some trackpads/browsers, Shift+wheel maps to horizontal delta.
    const delta =
      Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    wheelZoomCarryRef.current += delta;
    const step = 60;
    const steps = Math.trunc(wheelZoomCarryRef.current / step);
    if (steps === 0) return;
    wheelZoomCarryRef.current -= steps * step;
    setHourRowPx((cur) => {
      const next = cur + steps * 6;
      return Math.max(72, Math.min(220, next));
    });
  }, []);

  useEffect(() => {
    const el = timeGridScrollRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleNativeWheel as EventListener);
    };
  }, [handleNativeWheel]);

  const tickMinutes = useMemo(() => {
    // Zoomed out: hourly. Mid: half-hour. Zoomed in: 10-minute / 1-minute ticks.
    if (hourRowPx >= 170) return 1;
    if (hourRowPx >= 120) return 10;
    if (hourRowPx >= 88) return 30;
    return 60;
  }, [hourRowPx]);

  const effectiveHourRowPx = useMemo(() => {
    // Keep each tick row visually tall (fixed-ish) across zoom levels.
    // 1-minute mode gets smaller minimum than 10/30/60 to avoid extreme day height.
    const minTickRowPx = tickMinutes === 1 ? 12 : 34;
    const minHourByTicks = (minTickRowPx * 60) / tickMinutes;
    return Math.ceil(Math.max(hourRowPx, minHourByTicks));
  }, [hourRowPx, tickMinutes]);

  const timeTicks = useMemo(() => {
    const out: { minute: number; label: string }[] = [];
    const fmt = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    for (let m = 0; m < 24 * 60; m += tickMinutes) {
      out.push({ minute: m, label: fmt.format(new Date(2000, 0, 1, 0, m)) });
    }
    return out;
  }, [tickMinutes]);

  const totalGridHeightPx = useMemo(
    () => 24 * effectiveHourRowPx,
    [effectiveHourRowPx],
  );
  const pxPerMinute = useMemo(() => totalGridHeightPx / (24 * 60), [totalGridHeightPx]);
  const pxPerSecond = useMemo(
    () => totalGridHeightPx / (24 * 60 * 60),
    [totalGridHeightPx],
  );

  const dayColumnRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [newTaskDurationById, setNewTaskDurationById] = useState<
    Record<string, number>
  >({});
  const [newTaskSpanDaysById, setNewTaskSpanDaysById] = useState<
    Record<string, number>
  >({});
  const [newTaskEndIsoById, setNewTaskEndIsoById] = useState<
    Record<string, string>
  >({});
  const drawHintAtMsRef = useRef(0);
  const dragStateRef = useRef<{
    pointerId: number;
    startDay: number;
    startSecond: number;
    completed: boolean;
  } | null>(null);
  const [dragSelection, setDragSelection] = useState<{
    startDay: number;
    endDay: number;
    startSecond: number;
    endSecond: number;
  } | null>(null);
  const dragSelectionRef = useRef<typeof dragSelection>(null);
  dragSelectionRef.current = dragSelection;

  const createFromRange = useMutation({
    mutationFn: async (input: {
      dayStart: number;
      dayEnd: number;
      secondStart: number;
      secondEnd: number;
    }) => {
      if (!currentWorkspaceId || !createTaskProjectId || !defaultStatusId) {
        throw new Error("Missing workspace, project, or status.");
      }
      const startDay = daysToRender[input.dayStart];
      const endDay = daysToRender[input.dayEnd];
      if (!startDay) throw new Error("Invalid day selection.");
      if (!endDay) throw new Error("Invalid day end selection.");
      const due = new Date(startDay);
      due.setSeconds(input.secondStart, 0);
      const endAt = new Date(endDay);
      endAt.setSeconds(clamp(input.secondEnd, 1, timeMaxSeconds - 1), 0);
      const created = await createTask(currentWorkspaceId, {
        title: "New task",
        projectId: createTaskProjectId,
        statusId: defaultStatusId,
        dueDate: due.toISOString(),
        endDate: endAt.toISOString(),
      });
      return {
        created,
        durationSeconds: Math.max(30, input.secondEnd - input.secondStart),
        spanDays: Math.max(1, input.dayEnd - input.dayStart + 1),
        endIso: endAt.toISOString(),
      };
    },
    onSuccess: ({ created, durationSeconds, spanDays, endIso }) => {
      if (!currentWorkspaceId) return;
      void queryClient.invalidateQueries({
        queryKey: taskKeys.list(currentWorkspaceId, listFilters),
      });
      setNewTaskDurationById((prev) => {
        const next = { ...prev };
        next[created.id] = durationSeconds;
        return next;
      });
      setNewTaskSpanDaysById((prev) => {
        const next = { ...prev };
        next[created.id] = spanDays;
        return next;
      });
      setNewTaskEndIsoById((prev) => {
        const next = { ...prev };
        next[created.id] = created.endDate ?? endIso;
        return next;
      });
      onSelectTask(created.id);
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Could not create task from range.",
      );
    },
  });

  const getDayIndexFromClientX = useCallback(
    (x: number) => {
      const refs = dayColumnRefs.current;
      if (refs.length === 0) return 0;
      for (let i = 0; i < refs.length; i++) {
        const el = refs[i];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (x >= r.left && x <= r.right) return i;
      }
      const first = refs[0]?.getBoundingClientRect();
      const last = refs[refs.length - 1]?.getBoundingClientRect();
      if (first && x < first.left) return 0;
      if (last && x > last.right) return refs.length - 1;
      return 0;
    },
    [],
  );

  const getSecondFromClient = useCallback(
    (dayIndex: number, clientY: number) => {
      const el = dayColumnRefs.current[dayIndex];
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const localY = clamp(clientY - rect.top, 0, rect.height);
      const secondRaw = (localY / Math.max(1, rect.height)) * timeMaxSeconds;
      return clamp(Math.round(secondRaw), 0, timeMaxSeconds - 1);
    },
    [timeMaxSeconds],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const active = dragStateRef.current;
      if (!active || active.pointerId !== e.pointerId) return;
      const dayIdx = getDayIndexFromClientX(e.clientX);
      const second = getSecondFromClient(dayIdx, e.clientY);
      setDragSelection({
        startDay: Math.min(active.startDay, dayIdx),
        endDay: Math.max(active.startDay, dayIdx),
        startSecond: Math.min(active.startSecond, second),
        endSecond: Math.max(active.startSecond, second) + 1,
      });
    };
    const onUp = (e: PointerEvent) => {
      const active = dragStateRef.current;
      if (!active || active.pointerId !== e.pointerId) return;
      if (active.completed) return;
      active.completed = true;
      // Compute final range from pointer-up position as the source of truth,
      // so quick drags still capture the correct day span/height.
      const endDay = getDayIndexFromClientX(e.clientX);
      const endSecond = getSecondFromClient(endDay, e.clientY);
      const finalSelection = {
        startDay: Math.min(active.startDay, endDay),
        endDay: Math.max(active.startDay, endDay),
        startSecond: Math.min(active.startSecond, endSecond),
        endSecond: Math.max(active.startSecond, endSecond) + 1,
      };
      dragStateRef.current = null;
      setDragSelection(null);
      if (!finalSelection) return;
      if (createFromRange.isPending) return;
      createFromRange.mutate({
        dayStart: finalSelection.startDay,
        dayEnd: finalSelection.endDay,
        secondStart: finalSelection.startSecond,
        secondEnd: finalSelection.endSecond,
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [createFromRange, getDayIndexFromClientX, getSecondFromClient]);

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
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
          Loading calendar…
        </div>
      ) : null}

      {currentWorkspaceId && tasksError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {tasksErr instanceof Error ? tasksErr.message : "Failed to load tasks."}
        </div>
      ) : null}

      {currentWorkspaceId && !tasksLoading && !tasksError ? (
        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-neutral-200/80 bg-white/90 shadow-sm">
          {/* Header row */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 md:px-4">
            <div className="text-lg font-semibold tracking-tight text-neutral-900">
              {headerMonthLabel}
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 p-1">
                {(["month", "week", "day", "3d", "1day"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-xs font-semibold text-neutral-600 transition",
                      mode === m && "bg-white text-neutral-900 shadow-sm",
                    )}
                  >
                    {m === "3d" ? "3D" : m === "1day" ? "1D" : m[0]!.toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>

              <div className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-1">
                <button
                  type="button"
                  className="inline-flex size-9 items-center justify-center rounded-full hover:bg-neutral-50"
                  onClick={prev}
                  aria-label="Previous"
                >
                  <ChevronLeft className="size-5" strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                  onClick={goToday}
                >
                  Today
                </button>
                <button
                  type="button"
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                  onClick={goTomorrow}
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  className="inline-flex size-9 items-center justify-center rounded-full hover:bg-neutral-50"
                  onClick={next}
                  aria-label="Next"
                >
                  <ChevronRight className="size-5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </div>

          {mode === "month" ? (
            <div className="border-t border-neutral-200/70 bg-white px-4 pb-4">
              <div className="grid grid-cols-7 gap-2 py-3 text-center text-xs font-semibold text-neutral-400">
                {WEEKDAYS_SHORT.map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {monthWeeks.flat().map((d, idx) => {
                  const selected = d ? sameDay(d, cursor) : false;
                  const isT = d ? sameDay(d, today) : false;
                  const count =
                    d && tasks
                      ? tasks.filter((t) => t.dueDate && sameDay(new Date(t.dueDate), d)).length
                      : 0;
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={!d}
                      onClick={() => d && setCursor(d)}
                      className={cn(
                        "min-h-24 rounded-2xl border border-neutral-200/70 bg-white p-2 text-left transition hover:bg-neutral-50 disabled:opacity-40",
                        selected && "border-neutral-900/50 ring-2 ring-neutral-900/10",
                      )}
                    >
                      {d ? (
                        <>
                          <div className="flex items-center justify-between">
                            <span
                              className={cn(
                                "text-sm font-bold text-neutral-800",
                                isT && "text-primary",
                              )}
                            >
                              {d.getDate()}
                            </span>
                            {count > 0 ? (
                              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                                {count}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2 space-y-1">
                            {tasks
                              .filter((t) => t.dueDate && sameDay(new Date(t.dueDate), d))
                              .slice(0, 2)
                              .map((t) => (
                                <div
                                  key={t.id}
                                  className="truncate rounded-lg bg-neutral-100 px-2 py-1 text-[10px] font-medium text-neutral-700"
                                >
                                  {t.title}
                                </div>
                              ))}
                          </div>
                        </>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              {/* Weekday strip (week + day) */}
              <div
                className={cn(
                  "grid gap-3 border-t border-neutral-200/70 bg-neutral-50/60 px-3 py-2.5 md:px-4",
                  mode === "day" || mode === "1day"
                    ? "grid-cols-[4.5rem_minmax(0,1fr)]"
                    : mode === "3d"
                      ? "grid-cols-[4.5rem_repeat(3,minmax(0,1fr))]"
                      : "grid-cols-[4.5rem_repeat(7,minmax(0,1fr))]",
                )}
              >
                <div className="flex items-center justify-center text-neutral-400">
                  <CalendarIcon className="size-4" strokeWidth={1.5} aria-hidden />
                </div>
                {stripDays.map((d) => {
                  const selected = sameDay(d, cursor);
                  const isT = sameDay(d, today);
                  return (
                    <button
                      key={d.toISOString()}
                      type="button"
                      onClick={() => setCursor(d)}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-left transition",
                        selected
                          ? "bg-neutral-900 text-white"
                          : "bg-white hover:bg-neutral-50",
                      )}
                    >
                      <div className="text-[11px] font-semibold opacity-80">
                        {WEEKDAYS_SHORT[d.getDay()]}
                      </div>
                      <div
                        className={cn(
                          "text-lg font-extrabold",
                          isT && !selected && "text-primary",
                        )}
                      >
                        {d.getDate()}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Time grid (scrollable full day) */}
              <div
                ref={timeGridScrollRef}
                className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
              >
                <div
                  className={cn(
                    "grid",
                    mode === "day" || mode === "1day"
                      ? "grid-cols-[4.5rem_minmax(0,1fr)]"
                      : mode === "3d"
                        ? "grid-cols-[4.5rem_repeat(3,minmax(0,1fr))]"
                      : "grid-cols-[4.5rem_repeat(7,minmax(0,1fr))]",
                  )}
                >
              {/* Time labels */}
              <div className="border-r border-neutral-200/70 bg-white">
                {timeTicks.map((t) => {
                  const isHour = t.minute % 60 === 0;
                  const height = (tickMinutes / 60) * effectiveHourRowPx;
                  return (
                    <div
                      key={t.minute}
                      className="relative"
                      style={{ height: `${height}px` }}
                    >
                      <div
                        className={cn(
                          "absolute right-2",
                          isHour ? "top-2 text-neutral-500" : "top-1 text-neutral-400",
                          "text-[10px] font-medium",
                        )}
                      >
                        {t.label}
                      </div>
                      <div
                        className={cn(
                          "absolute bottom-0 left-0 right-0 h-px",
                          isHour ? "bg-neutral-200/60" : "bg-neutral-100",
                        )}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Day columns */}
              {daysToRender.map((day, dayIndex) => {
                const dayTasks = visibleTasks.filter((t) => {
                  if (!t.dueDate) return false;
                  return sameDay(new Date(t.dueDate), day);
                });
                const selectionForDay =
                  dragSelection &&
                  dayIndex >= dragSelection.startDay &&
                  dayIndex <= dragSelection.endDay
                    ? dragSelection
                    : null;
                const isSelectionFirstDay =
                  selectionForDay?.startDay === dayIndex;
                const isSelectionLastDay =
                  selectionForDay?.endDay === dayIndex;
                return (
                  <div
                    key={day.toISOString()}
                    className="relative border-r border-neutral-200/40 bg-white last:border-r-0"
                    style={{ height: `${totalGridHeightPx}px` }}
                    ref={(el) => {
                      dayColumnRefs.current[dayIndex] = el;
                    }}
                    data-day-col-index={dayIndex}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      if (createFromRange.isPending) return;
                      const hasDrawModifier = e.metaKey || e.ctrlKey;
                      if (!hasDrawModifier) {
                        const now = Date.now();
                        if (now - drawHintAtMsRef.current > 1200) {
                          drawHintAtMsRef.current = now;
                          toast.info("Use Cmd/Ctrl + drag to draw a new task time range.");
                        }
                        return;
                      }
                      const target = e.target as HTMLElement;
                      if (target.closest("[data-task-card='1']")) return;
                      const startSecond = getSecondFromClient(dayIndex, e.clientY);
                      dragStateRef.current = {
                        pointerId: e.pointerId,
                        startDay: dayIndex,
                        startSecond,
                        completed: false,
                      };
                      setDragSelection({
                        startDay: dayIndex,
                        endDay: dayIndex,
                        startSecond,
                        endSecond: startSecond + 1,
                      });
                    }}
                  >
                    {/* tick lines */}
                    {timeTicks.map((t) => {
                      const isHour = t.minute % 60 === 0;
                      return (
                        <div
                          key={t.minute}
                          className={cn(
                            "absolute left-0 right-0 h-px",
                            isHour ? "bg-neutral-200/60" : "bg-neutral-100",
                          )}
                          style={{ top: `${t.minute * pxPerMinute}px` }}
                        />
                      );
                    })}

                    {selectionForDay ? (
                      <div
                        className={cn(
                          "pointer-events-none absolute inset-x-0 z-20 border border-primary/40 bg-primary/15",
                          isSelectionFirstDay && isSelectionLastDay && "rounded-2xl",
                          isSelectionFirstDay && !isSelectionLastDay && "rounded-l-2xl border-r-0",
                          !isSelectionFirstDay && isSelectionLastDay && "rounded-r-2xl border-l-0",
                          !isSelectionFirstDay && !isSelectionLastDay && "border-x-0",
                        )}
                        style={{
                          top: `${selectionForDay.startSecond * pxPerSecond}px`,
                          height: `${Math.max(
                            10,
                            (selectionForDay.endSecond - selectionForDay.startSecond) *
                              pxPerSecond,
                          )}px`,
                        }}
                      >
                        {isSelectionFirstDay ? (
                          <div className="absolute left-2 top-2 rounded-lg border border-primary/35 bg-white/95 px-2 py-1 text-[10px] font-semibold text-primary shadow-sm">
                            {formatTimeFromSecond(selectionForDay.startSecond)} -{" "}
                            {formatTimeFromSecond(selectionForDay.endSecond)}
                            <span className="mx-1 text-neutral-400">|</span>
                            {selectionForDay.endDay - selectionForDay.startDay + 1} day
                            {selectionForDay.endDay - selectionForDay.startDay + 1 > 1
                              ? "s"
                              : ""}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {dayTasks.map((task) => {
                      const due = new Date(task.dueDate!);
                      const startSecond = clamp(
                        secondsSinceStart(due),
                        0,
                        timeMaxSeconds,
                      );
                      const persistedEndDt = task.endDate ? new Date(task.endDate) : null;
                      const persistedEndSecondOfDay = persistedEndDt
                        ? clamp(secondsSinceStart(persistedEndDt), 0, timeMaxSeconds)
                        : null;
                      const persistedDurationSeconds =
                        persistedEndSecondOfDay !== null &&
                        persistedEndSecondOfDay > startSecond
                          ? persistedEndSecondOfDay - startSecond
                          : null;
                      const dynamicDurationSeconds =
                        persistedDurationSeconds ??
                        newTaskDurationById[task.id] ??
                        3600;
                      const endSecond = clamp(
                        startSecond + dynamicDurationSeconds,
                        0,
                        timeMaxSeconds,
                      );
                      const top = startSecond * pxPerSecond;
                      const persistedSpanDays =
                        persistedEndDt && persistedEndDt.getTime() >= due.getTime()
                          ? Math.floor(
                              (startOfDay(persistedEndDt).getTime() -
                                startOfDay(due).getTime()) /
                                (24 * 60 * 60 * 1000),
                            ) + 1
                          : null;
                      const spanDaysRaw =
                        persistedSpanDays ?? newTaskSpanDaysById[task.id] ?? 1;
                      const maxSpanInView = Math.max(1, daysToRender.length - dayIndex);
                      const spanDays = Math.max(
                        1,
                        Math.min(maxSpanInView, Math.round(spanDaysRaw)),
                      );
                      const height = Math.max(
                        56,
                        (endSecond - startSecond) * pxPerSecond,
                      );
                      const endIso = task.endDate ?? newTaskEndIsoById[task.id];
                      const endDt = endIso ? new Date(endIso) : null;

                      // soft color from status color if present
                      const tint = task.status.color?.trim() || null;
                      const bg = tint ? `${tint}22` : "#EEF2FF";
                      const border = tint ? `${tint}55` : "#CBD5E1";

                      return (
                        <button
                          key={task.id}
                          data-task-card="1"
                          type="button"
                          onClick={() =>
                            onSelectTask(task.id === selectedTaskId ? null : task.id)
                          }
                          className={cn(
                            "absolute left-2 z-30 overflow-hidden rounded-2xl border p-2 text-left shadow-sm",
                            task.id === selectedTaskId && "ring-2 ring-primary/40",
                          )}
                          style={{
                            top,
                            width: `calc(${spanDays * 100}% - 16px)`,
                            height,
                            backgroundColor: bg,
                            borderColor: border,
                          }}
                          title={task.title}
                        >
                          <div className="text-[11px] font-semibold text-neutral-900 line-clamp-2">
                            {task.title}
                          </div>
                          <div className="mt-0.5 text-[10px] font-medium text-neutral-600">
                            {new Intl.DateTimeFormat(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            }).format(due)}
                            {endDt ? (
                              <>
                                {" - "}
                                {new Intl.DateTimeFormat(undefined, {
                                  month: spanDays > 1 ? "short" : undefined,
                                  day: spanDays > 1 ? "numeric" : undefined,
                                  weekday: spanDays > 1 ? "short" : undefined,
                                  hour: "numeric",
                                  minute: "2-digit",
                                  hour12: true,
                                }).format(endDt)}
                              </>
                            ) : null}
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <div className="min-w-0 truncate text-[10px] text-neutral-600/80">
                              {projectNameById.get(task.projectId) ?? "—"}
                            </div>
                            {spanDays > 1 ? (
                              <span className="shrink-0 rounded-md bg-white/75 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">
                                {spanDays} days
                              </span>
                            ) : null}
                            {task.assignees.length > 0 ? (
                              <AssigneeAvatarStack
                                assignees={task.assignees}
                                size="xs"
                                max={3}
                              />
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
