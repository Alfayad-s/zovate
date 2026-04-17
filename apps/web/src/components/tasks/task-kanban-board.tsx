"use client";

import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckSquare,
  GripVertical,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
} from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { CreateStatusSheet } from "@/components/tasks/create-status-sheet";
import { CreateTaskSheet } from "@/components/tasks/create-task-sheet";
import { useProject } from "@/contexts/project-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { projectKeys, taskKeys, type TaskListFilters } from "@/lib/query-keys";
import { workspaceLiveQueryOptions } from "@/lib/realtime-query";
import { fetchProjects, type Project } from "@/lib/projects-api";
import { AssigneeAvatarStack } from "@/components/tasks/assignee-avatar-stack";
import { cn } from "@/lib/utils";
import {
  fetchTaskStatuses,
  fetchTasks,
  patchTask,
  patchTaskStatus,
  type PatchTaskInput,
  type TaskStatusColumn,
  type TaskWithRelations,
} from "@/lib/tasks-api";
import { toast } from "sonner";

/** Default column width (px). User can drag the right edge to resize. */
const KANBAN_COLUMN_DEFAULT_WIDTH = 320;
const KANBAN_COLUMN_MIN_WIDTH = 200;
const KANBAN_COLUMN_MAX_WIDTH = 640;

/** Shared height + style for “Add task” and “Add column” placeholders. */
const KANBAN_PLACEHOLDER_BUTTON =
  "flex items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-white/60 h-10 px-3 text-xs font-medium text-neutral-500 transition-colors hover:border-neutral-400 hover:bg-white hover:text-neutral-800";

const KANBAN_COL_DND_MIME = "application/zovate-kanban-column-index";
const BOARD_ORDER_STORAGE_PREFIX = "zovate-kanban-board-order:";

/** Hairline insert marker while reordering columns — neutral, low visual weight. */
const COLUMN_REORDER_GAP_CLASS =
  "pointer-events-none shrink-0 self-stretch w-px rounded-full bg-neutral-400/75 shadow-[0_0_6px_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.06)]";

/** Stable defaults for useQuery — `= []` in destructuring creates a new array every render and breaks useEffect deps. */
const EMPTY_TASKS: TaskWithRelations[] = [];
const EMPTY_STATUSES: TaskStatusColumn[] = [];
const EMPTY_PROJECTS: Project[] = [];
type BoardItem = { kind: "status"; id: string };

function readBoardOrderFromStorage(workspaceId: string | null): BoardItem[] | null {
  if (typeof window === "undefined" || !workspaceId) return null;
  try {
    const raw = localStorage.getItem(BOARD_ORDER_STORAGE_PREFIX + workspaceId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BoardItem[];
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (x) => x && x.kind === "status" && typeof x.id === "string",
    ) as BoardItem[];
  } catch {
    return null;
  }
}

function writeBoardOrderToStorage(workspaceId: string, order: BoardItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    BOARD_ORDER_STORAGE_PREFIX + workspaceId,
    JSON.stringify(order),
  );
}

/** Gap index 0..n (before column g, or g===n after last). Maps to splice destination index after removal. */
function gapIndexToDestination(gapIndex: number, len: number): number {
  if (len <= 0) return 0;
  return Math.min(Math.max(0, gapIndex), len - 1);
}

function pointerToColumnGapIndex(
  e: ReactDragEvent<Element>,
  columnIndex: number,
  columnCount: number,
): number {
  const el = e.currentTarget;
  // Drop handlers may run after React clears currentTarget; fall back to "before this column".
  if (el == null || !(el instanceof HTMLElement)) {
    return Math.max(0, Math.min(columnIndex, columnCount));
  }
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0) {
    return Math.max(0, Math.min(columnIndex, columnCount));
  }
  const before = e.clientX < rect.left + rect.width / 2;
  let gap = before ? columnIndex : columnIndex + 1;
  gap = Math.max(0, Math.min(gap, columnCount));
  return gap;
}

function moveBoardItem<T>(list: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= list.length ||
    to >= list.length
  ) {
    return [...list];
  }
  const next = [...list];
  const [removed] = next.splice(from, 1);
  if (removed === undefined) return next;
  next.splice(to, 0, removed);
  return next;
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

function sortByPosition(a: TaskWithRelations, b: TaskWithRelations) {
  const d = positionValue(a.position) - positionValue(b.position);
  if (d !== 0) return d;
  return a.createdAt.localeCompare(b.createdAt);
}

function sortStatuses(a: TaskStatusColumn, b: TaskStatusColumn) {
  return positionValue(a.position) - positionValue(b.position);
}

/** Kanban columns are task statuses only (Todo, Done, and any column you add). Labels are tags elsewhere, not separate board lanes. */
function syncBoardOrder(
  prev: BoardItem[] | null,
  statuses: TaskStatusColumn[],
): BoardItem[] {
  const sortSt = [...statuses].sort(sortStatuses);
  const statusIds = new Set(sortSt.map((s) => s.id));
  const result: BoardItem[] = [];
  const used = new Set<string>();

  if (prev) {
    for (const item of prev) {
      const key = `${item.kind}:${item.id}`;
      if (used.has(key)) continue;
      if (item.kind === "status" && statusIds.has(item.id)) {
        result.push(item);
        used.add(key);
      }
    }
  }
  for (const s of sortSt) {
    const key = `status:${s.id}`;
    if (!used.has(key)) {
      result.push({ kind: "status", id: s.id });
      used.add(key);
    }
  }
  return result;
}

function applyTaskDrag(
  tasks: TaskWithRelations[],
  result: DropResult,
  statuses: TaskStatusColumn[],
): Map<string, TaskWithRelations[]> | null {
  const { destination, source, draggableId } = result;
  if (!destination) return null;
  if (
    destination.droppableId === source.droppableId &&
    destination.index === source.index
  ) {
    return null;
  }

  const moved = tasks.find((t) => t.id === draggableId);
  if (!moved) return null;

  const sourceCol = source.droppableId;
  const destCol = destination.droppableId;

  const grouped = new Map<string, TaskWithRelations[]>();
  for (const s of statuses) {
    grouped.set(
      s.id,
      tasks.filter((t) => t.statusId === s.id).sort(sortByPosition),
    );
  }

  const sourceList = [...(grouped.get(sourceCol) ?? [])];
  if (source.index >= sourceList.length) return null;
  const taken = sourceList.splice(source.index, 1);
  const removed = taken[0];
  if (!removed) return null;

  if (sourceCol === destCol) {
    sourceList.splice(destination.index, 0, removed);
    grouped.set(sourceCol, sourceList);
  } else {
    grouped.set(sourceCol, sourceList);
    const destList = [...(grouped.get(destCol) ?? [])];
    const meta = statuses.find((s) => s.id === destCol);
    if (!meta) return null;
    const updated: TaskWithRelations = {
      ...removed,
      statusId: destCol,
      status: {
        id: meta.id,
        name: meta.name,
        color: meta.color,
        position: meta.position,
      },
    };
    destList.splice(destination.index, 0, updated);
    grouped.set(destCol, destList);
  }

  return grouped;
}

function buildPatches(
  tasksBefore: TaskWithRelations[],
  grouped: Map<string, TaskWithRelations[]>,
  statuses: TaskStatusColumn[],
) {
  const beforeById = new Map(tasksBefore.map((t) => [t.id, t]));
  const patches: { taskId: string; body: PatchTaskInput }[] = [];

  for (const st of statuses) {
    const col = grouped.get(st.id) ?? [];
    col.forEach((task, idx) => {
      const orig = beforeById.get(task.id);
      if (!orig) return;
      const pos = String(idx);
      if (
        orig.statusId === st.id &&
        String(positionValue(orig.position)) === pos
      ) {
        return;
      }
      patches.push({
        taskId: task.id,
        body:
          orig.statusId !== st.id
            ? { statusId: st.id, position: pos }
            : { position: pos },
      });
    });
  }
  return patches;
}

/** Build the full task list from grouped columns with index positions (matches PATCH body). */
function groupedToFlatTasks(
  grouped: Map<string, TaskWithRelations[]>,
  statuses: TaskStatusColumn[],
): TaskWithRelations[] {
  const result: TaskWithRelations[] = [];
  const sortSt = [...statuses].sort(sortStatuses);
  for (const st of sortSt) {
    const col = grouped.get(st.id) ?? [];
    col.forEach((task, idx) => {
      result.push({
        ...task,
        statusId: st.id,
        status: {
          id: st.id,
          name: st.name,
          color: st.color,
          position: st.position,
        },
        position: String(idx),
      });
    });
  }
  return result;
}

/** Narrow column: header row is only “Add column” (new task status). */
function CreateStatusColumnSlot({
  widthPx,
  onClick,
}: {
  widthPx: number;
  onClick: () => void;
}) {
  return (
    <div
      className="flex h-full min-h-0 shrink-0 flex-col rounded-xl bg-transparent"
      style={{ width: widthPx, maxWidth: "100%" }}
    >
      <div className="shrink-0 border-b border-neutral-200/80 px-3 py-3">
        <button
          type="button"
          onClick={onClick}
          className={cn(
            KANBAN_PLACEHOLDER_BUTTON,
            "w-full shadow-sm hover:border-primary/50 hover:bg-primary/[0.06] hover:text-neutral-900",
          )}
        >
          <Plus className="size-3.5 shrink-0" strokeWidth={2} />
          <span>Add column</span>
        </button>
      </div>
      <div className="min-h-0 flex-1" aria-hidden />
    </div>
  );
}

type TaskKanbanBoardProps = {
  className?: string;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string | null) => void;
};

export function TaskKanbanBoard({
  className,
  selectedTaskId,
  onSelectTask,
}: TaskKanbanBoardProps) {
  const queryClient = useQueryClient();
  const { currentWorkspaceId, isLoading: workspaceLoading } = useWorkspace();
  const { currentProjectId } = useProject();
  const [createForColumn, setCreateForColumn] = useState<{
    statusId: string;
    statusName: string;
  } | null>(null);
  const [createStatusOpen, setCreateStatusOpen] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const columnWidthsRef = useRef(columnWidths);
  columnWidthsRef.current = columnWidths;

  useEffect(() => {
    setColumnWidths({});
  }, [currentWorkspaceId]);

  const [boardOrder, setBoardOrder] = useState<BoardItem[]>([]);
  const [draggingColumnIndex, setDraggingColumnIndex] = useState<number | null>(
    null,
  );
  /** Insert gap position while dragging a column (0..boardOrder.length). */
  const [columnDragInsertIndex, setColumnDragInsertIndex] = useState<
    number | null
  >(null);
  const columnDragInsertIndexRef = useRef<number | null>(null);
  columnDragInsertIndexRef.current = columnDragInsertIndex;

  const listFilters: TaskListFilters = useMemo(() => ({}), []);
  const {
    data: tasks = EMPTY_TASKS,
    isLoading: tasksLoading,
    isError: tasksError,
    error: tasksErr,
  } = useQuery({
    queryKey: taskKeys.list(currentWorkspaceId ?? "__none__", listFilters),
    queryFn: () => fetchTasks(currentWorkspaceId!, listFilters),
    enabled: !!currentWorkspaceId,
    ...workspaceLiveQueryOptions,
  });

  const { data: statuses = EMPTY_STATUSES } = useQuery({
    queryKey: taskKeys.statuses(currentWorkspaceId ?? "__none__"),
    queryFn: () => fetchTaskStatuses(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
    ...workspaceLiveQueryOptions,
  });

  const { data: projects = EMPTY_PROJECTS } = useQuery({
    queryKey: projectKeys.list(currentWorkspaceId ?? "__none__", {}),
    queryFn: () => fetchProjects(currentWorkspaceId!, {}),
    enabled: !!currentWorkspaceId,
  });

  const projectNameById = new Map(projects.map((p) => [p.id, p.name]));

  const createTaskProjectId =
    currentProjectId && projects.some((p) => p.id === currentProjectId)
      ? currentProjectId
      : projects[0]?.id ?? null;

  const sortedStatuses = [...statuses].sort(sortStatuses);

  const statusById = useMemo(
    () => new Map(statuses.map((s) => [s.id, s])),
    [statuses],
  );
  useEffect(() => {
    if (!currentWorkspaceId) {
      setBoardOrder([]);
      return;
    }
    setBoardOrder((prev) =>
      syncBoardOrder(
        prev.length > 0 ? prev : readBoardOrderFromStorage(currentWorkspaceId),
        statuses,
      ),
    );
  }, [currentWorkspaceId, statuses]);

  const reorderColumnsMutation = useMutation({
    mutationFn: async ({
      workspaceId,
      order,
    }: {
      workspaceId: string;
      order: BoardItem[];
    }) => {
      writeBoardOrderToStorage(workspaceId, order);
      const statusItems = order.filter(
        (i): i is { kind: "status"; id: string } => i.kind === "status",
      );
      await Promise.all(
        statusItems.map((item, idx) =>
          patchTaskStatus(workspaceId, item.id, { position: String(idx) }),
        ),
      );
    },
    onSuccess: (_, { workspaceId }) => {
      void queryClient.invalidateQueries({
        queryKey: taskKeys.statuses(workspaceId),
      });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Could not save column order",
      );
    },
  });

  const handleColumnDragStart = useCallback(
    (e: ReactDragEvent, index: number) => {
      e.stopPropagation();
      setDraggingColumnIndex(index);
      setColumnDragInsertIndex(null);
      e.dataTransfer.setData(KANBAN_COL_DND_MIME, String(index));
      e.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleColumnDragOver = useCallback(
    (e: ReactDragEvent, columnIndex: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (draggingColumnIndex === null) return;
      const gap = pointerToColumnGapIndex(
        e,
        columnIndex,
        boardOrder.length,
      );
      setColumnDragInsertIndex(gap);
    },
    [boardOrder.length, draggingColumnIndex],
  );

  const handleColumnDragEnd = useCallback(() => {
    setDraggingColumnIndex(null);
    setColumnDragInsertIndex(null);
  }, []);

  const handleColumnDrop = useCallback(
    (e: ReactDragEvent, dropColumnIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      const fromStr = e.dataTransfer.getData(KANBAN_COL_DND_MIME);
      if (fromStr === "") return;
      const from = parseInt(fromStr, 10);
      if (Number.isNaN(from)) {
        setDraggingColumnIndex(null);
        setColumnDragInsertIndex(null);
        return;
      }
      if (!currentWorkspaceId) return;
      setBoardOrder((prev) => {
        const len = prev.length;
        const target = e.currentTarget;
        const gap =
          (target == null || !(target instanceof HTMLElement)) &&
          columnDragInsertIndexRef.current != null
            ? Math.max(
                0,
                Math.min(columnDragInsertIndexRef.current, len),
              )
            : pointerToColumnGapIndex(e, dropColumnIndex, len);
        const dest = gapIndexToDestination(gap, len);
        if (from === dest) {
          return prev;
        }
        const next = moveBoardItem(prev, from, dest);
        reorderColumnsMutation.mutate({
          workspaceId: currentWorkspaceId,
          order: next,
        });
        return next;
      });
      setDraggingColumnIndex(null);
      setColumnDragInsertIndex(null);
    },
    [currentWorkspaceId, reorderColumnsMutation],
  );

  const handleBoardColumnDragOver = useCallback(
    (e: ReactDragEvent) => {
      if (draggingColumnIndex === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    },
    [draggingColumnIndex],
  );

  const applyDrag = useMutation({
    mutationFn: async (patches: { taskId: string; body: PatchTaskInput }[]) => {
      if (!currentWorkspaceId) return;
      await Promise.all(
        patches.map((p) => patchTask(currentWorkspaceId, p.taskId, p.body)),
      );
    },
    onSuccess: () => {
      if (!currentWorkspaceId) return;
      void queryClient.invalidateQueries({
        queryKey: taskKeys.list(currentWorkspaceId, listFilters),
      });
    },
  });

  const onDragEnd = useCallback(
    (result: DropResult) => {
      if (!currentWorkspaceId) return;
      const { destination, reason } = result;
      if (!destination) return;
      if (reason === "CANCEL") return;

      if (sortedStatuses.length === 0) return;
      const grouped = applyTaskDrag(tasks, result, sortedStatuses);
      if (!grouped) return;
      const patches = buildPatches(tasks, grouped, sortedStatuses);
      if (patches.length === 0) return;

      const listQueryKey = taskKeys.list(currentWorkspaceId, listFilters);
      void queryClient.cancelQueries({ queryKey: listQueryKey });
      const previous =
        queryClient.getQueryData<TaskWithRelations[]>(listQueryKey);
      const nextTasks = groupedToFlatTasks(grouped, sortedStatuses);
      queryClient.setQueryData<TaskWithRelations[]>(listQueryKey, nextTasks);

      applyDrag.mutate(patches, {
        onError: (err) => {
          if (previous) {
            queryClient.setQueryData(listQueryKey, previous);
          }
          toast.error(
            err instanceof Error
              ? err.message
              : "Could not update task. Try again.",
          );
        },
      });
    },
    [applyDrag, currentWorkspaceId, queryClient, sortedStatuses, tasks, listFilters],
  );

  const noWorkspace = !workspaceLoading && !currentWorkspaceId;

  const getColumnWidth = useCallback(
    (columnKey: string) =>
      columnWidths[columnKey] ?? KANBAN_COLUMN_DEFAULT_WIDTH,
    [columnWidths],
  );

  const handleColumnResizePointerDown = useCallback(
    (columnKey: string, e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW =
        columnWidthsRef.current[columnKey] ?? KANBAN_COLUMN_DEFAULT_WIDTH;

      const onMove = (ev: globalThis.PointerEvent) => {
        const next = Math.min(
          KANBAN_COLUMN_MAX_WIDTH,
          Math.max(
            KANBAN_COLUMN_MIN_WIDTH,
            Math.round(startW + (ev.clientX - startX)),
          ),
        );
        setColumnWidths((prev) => ({ ...prev, [columnKey]: next }));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [],
  );

  /** Width for the Add column slot — matches the last board column before it. */
  const lastBoardItem = boardOrder[boardOrder.length - 1];
  const addColumnSlotWidthPx =
    lastBoardItem !== undefined
      ? getColumnWidth(lastBoardItem.id)
      : KANBAN_COLUMN_DEFAULT_WIDTH;

  return (
    <>
      <CreateTaskSheet
        open={createForColumn !== null}
        onOpenChange={(open) => {
          if (!open) setCreateForColumn(null);
        }}
        workspaceId={currentWorkspaceId}
        statusId={createForColumn?.statusId ?? null}
        statusName={createForColumn?.statusName}
        projectId={createTaskProjectId}
        onCreated={(task) => {
          onSelectTask(task.id);
        }}
      />

      <CreateStatusSheet
        open={createStatusOpen}
        onOpenChange={setCreateStatusOpen}
        workspaceId={currentWorkspaceId}
      />

      <div
        className={cn("flex min-h-0 flex-1 flex-col gap-6", className)}
      >
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
          Loading board…
        </div>
      ) : null}

      {currentWorkspaceId && tasksError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {tasksErr instanceof Error ? tasksErr.message : "Failed to load tasks."}
        </div>
      ) : null}

      {currentWorkspaceId && !tasksLoading && !tasksError ? (
        sortedStatuses.length === 0 ? (
          <div className="flex min-h-[min(50vh,480px)] flex-col gap-4">
            <div className="min-h-0 min-w-0 flex-1 rounded-2xl border border-dashed border-neutral-200 bg-white px-6 py-14 text-center text-sm text-neutral-600">
              No status columns yet for this workspace.
            </div>
            <div
              className="flex min-h-0 flex-1 items-stretch gap-4 overflow-x-auto overflow-y-hidden pb-2"
              onDragOver={handleBoardColumnDragOver}
            >
              {boardOrder.map((item, index) => {
                const status = statusById.get(item.id);
                if (!status) return null;
                const columnTasks = tasks
                  .filter((t) => t.statusId === status.id)
                  .sort(sortByPosition);
                return (
                  <Fragment key={`board-status-${item.id}`}>
                    {draggingColumnIndex !== null &&
                    columnDragInsertIndex === index ? (
                      <div
                        className={COLUMN_REORDER_GAP_CLASS}
                        role="presentation"
                        aria-hidden
                      />
                    ) : null}
                    <KanbanColumn
                      status={status}
                      widthPx={getColumnWidth(status.id)}
                      onResizePointerDown={(e) =>
                        handleColumnResizePointerDown(status.id, e)
                      }
                      tasks={columnTasks}
                      projectNameById={projectNameById}
                      selectedTaskId={selectedTaskId}
                      onSelectTask={onSelectTask}
                      isDraggingDisabled={false}
                      hasProjects={projects.length > 0}
                      onAddTask={() =>
                        setCreateForColumn({
                          statusId: status.id,
                          statusName: status.name,
                        })
                      }
                      columnIndex={index}
                      onColumnDragStart={handleColumnDragStart}
                      onColumnDragOver={(e) =>
                        handleColumnDragOver(e, index)
                      }
                      onColumnDrop={handleColumnDrop}
                      onColumnDragEnd={handleColumnDragEnd}
                      draggingColumnIndex={draggingColumnIndex}
                    />
                  </Fragment>
                );
              })}
              {draggingColumnIndex !== null &&
              columnDragInsertIndex === boardOrder.length ? (
                <div
                  className={COLUMN_REORDER_GAP_CLASS}
                  role="presentation"
                  aria-hidden
                />
              ) : null}
              <CreateStatusColumnSlot
                widthPx={addColumnSlotWidthPx}
                onClick={() => setCreateStatusOpen(true)}
              />
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
          <DragDropContext onDragEnd={onDragEnd}>
            <div
              className="flex min-h-0 flex-1 items-stretch gap-4 overflow-x-auto overflow-y-hidden pb-2"
              onDragOver={handleBoardColumnDragOver}
            >
              {boardOrder.map((item, index) => {
                const status = statusById.get(item.id);
                if (!status) return null;
                const columnTasks = tasks
                  .filter((t) => t.statusId === status.id)
                  .sort(sortByPosition);
                return (
                  <Fragment key={`board-status-${item.id}`}>
                    {draggingColumnIndex !== null &&
                    columnDragInsertIndex === index ? (
                      <div
                        className={COLUMN_REORDER_GAP_CLASS}
                        role="presentation"
                        aria-hidden
                      />
                    ) : null}
                    <KanbanColumn
                      status={status}
                      widthPx={getColumnWidth(status.id)}
                      onResizePointerDown={(e) =>
                        handleColumnResizePointerDown(status.id, e)
                      }
                      tasks={columnTasks}
                      projectNameById={projectNameById}
                      selectedTaskId={selectedTaskId}
                      onSelectTask={onSelectTask}
                      isDraggingDisabled={false}
                      hasProjects={projects.length > 0}
                      onAddTask={() =>
                        setCreateForColumn({
                          statusId: status.id,
                          statusName: status.name,
                        })
                      }
                      columnIndex={index}
                      onColumnDragStart={handleColumnDragStart}
                      onColumnDragOver={(e) =>
                        handleColumnDragOver(e, index)
                      }
                      onColumnDrop={handleColumnDrop}
                      onColumnDragEnd={handleColumnDragEnd}
                      draggingColumnIndex={draggingColumnIndex}
                    />
                  </Fragment>
                );
              })}
              {draggingColumnIndex !== null &&
              columnDragInsertIndex === boardOrder.length ? (
                <div
                  className={COLUMN_REORDER_GAP_CLASS}
                  role="presentation"
                  aria-hidden
                />
              ) : null}
              <CreateStatusColumnSlot
                widthPx={addColumnSlotWidthPx}
                onClick={() => setCreateStatusOpen(true)}
              />
            </div>
          </DragDropContext>
          </div>
        )
      ) : null}
      </div>
    </>
  );
}

function KanbanColumn({
  status,
  widthPx,
  onResizePointerDown,
  tasks: columnTasks,
  projectNameById,
  selectedTaskId,
  onSelectTask,
  isDraggingDisabled,
  hasProjects,
  onAddTask,
  columnIndex,
  onColumnDragStart,
  onColumnDragOver,
  onColumnDrop,
  onColumnDragEnd,
  draggingColumnIndex,
}: {
  status: TaskStatusColumn;
  widthPx: number;
  onResizePointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  tasks: TaskWithRelations[];
  projectNameById: Map<string, string>;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string | null) => void;
  isDraggingDisabled: boolean;
  hasProjects: boolean;
  onAddTask: () => void;
  columnIndex: number;
  onColumnDragStart: (e: ReactDragEvent, index: number) => void;
  onColumnDragOver: (e: ReactDragEvent) => void;
  onColumnDrop: (e: ReactDragEvent, index: number) => void;
  onColumnDragEnd: () => void;
  draggingColumnIndex: number | null;
}) {
  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 shrink-0 flex-col rounded-xl bg-transparent transition-[transform,box-shadow] duration-150",
        draggingColumnIndex === columnIndex &&
          "z-40 -translate-y-2 scale-[1.02] bg-white/95 shadow-[0_16px_48px_-8px_rgba(0,0,0,0.22)] ring-2 ring-primary/35",
      )}
      style={{ width: widthPx, maxWidth: "100%" }}
      onDragOver={onColumnDragOver}
      onDrop={(e) => onColumnDrop(e, columnIndex)}
    >
      <div
        className="flex cursor-grab items-center gap-2 border-b border-neutral-200/80 px-3 py-3 active:cursor-grabbing"
        draggable
        onDragStart={(e) => onColumnDragStart(e, columnIndex)}
        onDragEnd={onColumnDragEnd}
      >
        <span
          className="mt-0.5 shrink-0 text-neutral-300 hover:text-neutral-500"
          aria-hidden
        >
          <GripVertical className="size-4" strokeWidth={1.5} />
        </span>
        {status.color ? (
          <span
            className="size-2.5 shrink-0 rounded-full border border-neutral-200/80"
            style={{ backgroundColor: status.color }}
            aria-hidden
          />
        ) : null}
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900">
          {status.name}
        </h2>
        <span className="shrink-0 rounded-md bg-neutral-200/80 px-1.5 py-0.5 text-xs font-medium text-neutral-700">
          {columnTasks.length}
        </span>
      </div>

      <div className="shrink-0 px-3 pb-2 pt-3">
        <button
          type="button"
          disabled={!hasProjects}
          title={
            hasProjects
              ? "Create a task in this column"
              : "Create a project first"
          }
          className={cn(
            KANBAN_PLACEHOLDER_BUTTON,
            "w-full",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          onClick={onAddTask}
        >
          <Plus className="size-3.5 shrink-0" strokeWidth={2} />
          <span>Add task</span>
        </button>
      </div>

      <Droppable droppableId={status.id} isDropDisabled={isDraggingDisabled}>
        {(dropProvided, snapshot) => (
          <div
            ref={dropProvided.innerRef}
            {...dropProvided.droppableProps}
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-lg px-3 pb-3 pt-0 transition-[background-color,box-shadow] duration-200 ease-out",
              snapshot.isDraggingOver &&
                "bg-primary/[0.05] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]",
            )}
          >
            {columnTasks.map((task, index) => (
              <Draggable
                key={task.id}
                draggableId={task.id}
                index={index}
                isDragDisabled={isDraggingDisabled}
              >
                {(dragProvided, dragSnapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    className={cn(
                      "rounded-lg border bg-white shadow-sm transition-[box-shadow,transform,opacity] duration-200 ease-out will-change-transform",
                      dragSnapshot.isDragging &&
                        "scale-[1.01] shadow-lg ring-2 ring-primary/30",
                      task.id === selectedTaskId && "ring-2 ring-primary/40",
                    )}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      className="flex w-full cursor-pointer gap-2 rounded-lg p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      onClick={() =>
                        onSelectTask(
                          task.id === selectedTaskId ? null : task.id,
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectTask(task.id === selectedTaskId ? null : task.id);
                        }
                      }}
                    >
                      <span
                        {...dragProvided.dragHandleProps}
                        className="mt-0.5 shrink-0 cursor-grab text-neutral-400 hover:text-neutral-600 active:cursor-grabbing"
                        aria-label="Drag to reorder"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <GripVertical className="size-4" strokeWidth={1.5} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={cn(
                              "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-semibold",
                              task.priority === "high" &&
                                "bg-red-50 text-red-700",
                              task.priority === "medium" &&
                                "bg-amber-50 text-amber-700",
                              task.priority === "low" &&
                                "bg-emerald-50 text-emerald-700",
                              task.priority !== "high" &&
                                task.priority !== "medium" &&
                                task.priority !== "low" &&
                                "bg-neutral-100 text-neutral-700",
                            )}
                          >
                            {task.priority ? task.priority[0]?.toUpperCase() + task.priority.slice(1) : "Task"}
                          </span>
                        </div>

                        <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-neutral-900">
                          {task.title}
                        </p>
                        <p className="mt-1 truncate text-xs text-neutral-500">
                          {projectNameById.get(task.projectId) ?? "—"}
                        </p>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          {task.assignees.length > 0 ? (
                            <AssigneeAvatarStack
                              assignees={task.assignees}
                              size="xs"
                              max={3}
                            />
                          ) : (
                            <span />
                          )}

                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectTask(task.id);
                              }}
                              aria-label="Open comments"
                              title="Comments"
                            >
                              <MessageSquare className="size-4" strokeWidth={1.75} />
                              <span className="tabular-nums">
                                {String(task.commentsCount ?? 0)}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectTask(task.id);
                              }}
                              aria-label="Open attachments"
                              title="Attachments"
                            >
                              <Paperclip className="size-4" strokeWidth={1.75} />
                              <span className="tabular-nums">
                                {String(
                                  (task as unknown as { attachmentsCount?: number })
                                    .attachmentsCount ?? 0,
                                )}
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {dropProvided.placeholder}
          </div>
        )}
      </Droppable>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${status.name} column`}
        title="Drag to resize column"
        className="absolute right-0 top-0 z-20 h-full w-3 cursor-col-resize touch-none select-none"
        onPointerDown={(e) => {
          e.stopPropagation();
          onResizePointerDown(e);
        }}
      />
    </div>
  );
}
