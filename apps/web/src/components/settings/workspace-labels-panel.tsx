"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Tag, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/contexts/workspace-context";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import {
  createLabel,
  deleteLabel,
  fetchLabels,
  updateLabel,
  type WorkspaceLabel,
} from "@/lib/labels-api";
import { labelKeys, taskKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

function LabelSwatch({ color }: { color: string | null }) {
  return (
    <span
      className="size-4 shrink-0 rounded border border-neutral-200/90"
      style={
        color
          ? { backgroundColor: color }
          : { backgroundColor: "rgb(229 231 235)" }
      }
      aria-hidden
    />
  );
}

export type WorkspaceLabelsEditorProps = {
  className?: string;
  /** Hide page title/description (e.g. when used inside a sheet). */
  embedded?: boolean;
};

/** Workspace label CRUD — use in Settings or Kanban “Manage labels” sheet. */
export function WorkspaceLabelsEditor({
  className,
  embedded = false,
}: WorkspaceLabelsEditorProps) {
  const formId = useId();
  const queryClient = useQueryClient();
  const { currentWorkspaceId } = useWorkspace();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const {
    data: labels = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: labelKeys.list(currentWorkspaceId ?? "__none__"),
    queryFn: () => fetchLabels(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
  });

  const invalidateLabelsAndTasks = () => {
    if (!currentWorkspaceId) return;
    void queryClient.invalidateQueries({
      queryKey: labelKeys.list(currentWorkspaceId),
    });
    void queryClient.invalidateQueries({
      queryKey: taskKeys.list(currentWorkspaceId, {}),
    });
  };

  const createMutation = useMutation({
    meta: { skipGlobalErrorToast: true },
    mutationFn: () => {
      if (!currentWorkspaceId) throw new Error("No workspace");
      const name = newName.trim();
      if (!name) throw new Error("Name is required");
      const c = newColor.trim();
      return createLabel(currentWorkspaceId, {
        name,
        ...(c ? { color: c } : {}),
      });
    },
    onSuccess: () => {
      setNewName("");
      setNewColor("");
      invalidateLabelsAndTasks();
      toast.success("Label created");
    },
    onError: (e) => {
      toast.error(getAuthErrorMessage(e, "Could not create label"));
    },
  });

  const updateMutation = useMutation({
    meta: { skipGlobalErrorToast: true },
    mutationFn: (payload: {
      labelId: string;
      name: string;
      color: string;
    }) => {
      if (!currentWorkspaceId) throw new Error("No workspace");
      const name = payload.name.trim();
      if (!name) throw new Error("Name is required");
      const c = payload.color.trim();
      return updateLabel(currentWorkspaceId, payload.labelId, {
        name,
        color: c || null,
      });
    },
    onSuccess: () => {
      setEditingId(null);
      invalidateLabelsAndTasks();
      toast.success("Label updated");
    },
    onError: (e) => {
      toast.error(getAuthErrorMessage(e, "Could not update label"));
    },
  });

  const deleteMutation = useMutation({
    meta: { skipGlobalErrorToast: true },
    mutationFn: (labelId: string) => {
      if (!currentWorkspaceId) throw new Error("No workspace");
      return deleteLabel(currentWorkspaceId, labelId);
    },
    onSuccess: () => {
      invalidateLabelsAndTasks();
      toast.success("Label deleted");
    },
    onError: (e) => {
      toast.error(getAuthErrorMessage(e, "Could not delete label"));
    },
  });

  function startEdit(label: WorkspaceLabel) {
    setEditingId(label.id);
    setEditName(label.name);
    setEditColor(label.color ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  if (!currentWorkspaceId) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a workspace from the top bar to manage labels.
      </p>
    );
  }

  const newNameId = `${formId}-new-name`;
  const newColorId = `${formId}-new-color`;

  return (
    <div
      className={cn(embedded ? "space-y-5" : "space-y-8", className)}
    >
      {!embedded ? (
        <div>
          <h2 className="text-sm font-medium text-neutral-900">Task labels</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Labels are shared across projects in this workspace. Only workspace
            owners and admins can create or edit them. Deleting a label removes
            it from all tasks.
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
        <p className="text-xs font-medium text-neutral-600">New label</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1">
            <label htmlFor={newNameId} className="sr-only">
              Name
            </label>
            <Input
              id={newNameId}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name (e.g. bug, design)"
              className="rounded-lg"
              maxLength={64}
            />
          </div>
          <div className="w-full space-y-1 sm:w-36">
            <label htmlFor={newColorId} className="sr-only">
              Color (hex)
            </label>
            <Input
              id={newColorId}
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              placeholder="#e11d48"
              className="rounded-lg font-mono text-sm"
              maxLength={32}
            />
          </div>
          <Button
            type="button"
            className="shrink-0 gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!newName.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Tag className="size-4" strokeWidth={1.75} />
            )}
            Create
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Optional color: CSS color hex (e.g. #fc6a08) or leave empty for
          neutral.
        </p>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading labels…
        </p>
      ) : isError ? (
        <p className="text-sm text-red-600">
          {error instanceof Error ? error.message : "Could not load labels."}
        </p>
      ) : labels.length === 0 ? (
        <p className="text-sm text-muted-foreground">No labels yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
          {labels.map((label) => (
            <li
              key={label.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"
            >
              {editingId === label.id ? (
                <>
                  <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="rounded-lg sm:max-w-xs"
                      maxLength={64}
                      autoFocus
                    />
                    <Input
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      placeholder="#hex"
                      className="rounded-lg font-mono text-sm sm:w-36"
                      maxLength={32}
                    />
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      onClick={cancelEdit}
                      disabled={updateMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                      disabled={
                        updateMutation.isPending || !editName.trim()
                      }
                      onClick={() =>
                        updateMutation.mutate({
                          labelId: label.id,
                          name: editName,
                          color: editColor,
                        })
                      }
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        "Save"
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <LabelSwatch color={label.color} />
                    <span className="truncate font-medium text-neutral-900">
                      {label.name}
                    </span>
                    {label.color ? (
                      <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
                        {label.color}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-lg text-neutral-600"
                      title="Edit"
                      onClick={() => startEdit(label)}
                      disabled={
                        deleteMutation.isPending ||
                        updateMutation.isPending ||
                        editingId !== null
                      }
                    >
                      <Pencil className="size-4" strokeWidth={1.5} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700"
                      title="Delete"
                      disabled={deleteMutation.isPending || editingId !== null}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Delete label “${label.name}”? It will be removed from all tasks.`,
                          )
                        ) {
                          return;
                        }
                        deleteMutation.mutate(label.id);
                      }}
                    >
                      {deleteMutation.isPending &&
                      deleteMutation.variables === label.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" strokeWidth={1.5} />
                      )}
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function WorkspaceLabelsPanel() {
  const { isLoading: wsLoading } = useWorkspace();

  if (wsLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading…
      </p>
    );
  }

  return <WorkspaceLabelsEditor className="mt-8 max-w-2xl" />;
}
