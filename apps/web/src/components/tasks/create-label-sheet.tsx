"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { createLabel } from "@/lib/labels-api";
import { labelKeys, taskKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

const DEFAULT_HEX = "#fc6a08";

function normalizeColorInput(value: string): string {
  const v = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
    const r = v[1]! + v[1]!;
    const g = v[2]! + v[2]!;
    const b = v[3]! + v[3]!;
    return `#${r}${g}${b}`.toLowerCase();
  }
  return DEFAULT_HEX;
}

export function CreateLabelSheet({
  open,
  onOpenChange,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | null;
}) {
  const formId = useId();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [colorHex, setColorHex] = useState(DEFAULT_HEX);

  useEffect(() => {
    if (!open) return;
    setName("");
    setColorHex(DEFAULT_HEX);
  }, [open]);

  const createMutation = useMutation({
    meta: { skipGlobalErrorToast: true },
    mutationFn: () => {
      if (!workspaceId) throw new Error("No workspace");
      const n = name.trim();
      if (!n.length) throw new Error("Name is required");
      const hex = normalizeColorInput(colorHex);
      return createLabel(workspaceId, { name: n, color: hex });
    },
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: labelKeys.list(workspaceId),
        });
        void queryClient.invalidateQueries({
          queryKey: taskKeys.list(workspaceId, {}),
        });
      }
      toast.success("Label created");
      onOpenChange(false);
    },
    onError: (e) => {
      toast.error(getAuthErrorMessage(e, "Could not create label"));
    },
  });

  const nameId = `${formId}-name`;
  const colorId = `${formId}-color`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-y-auto sm:max-w-md"
        showClose
      >
        <SheetHeader className="shrink-0 text-left">
          <SheetTitle>New label</SheetTitle>
          <SheetDescription>
            Add a label for this workspace. It will be available on tasks across
            projects.
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex min-h-0 flex-1 flex-col gap-6 px-6 pb-8 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={nameId}>Name</Label>
            <Input
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bug, Design, Urgent"
              maxLength={64}
              autoFocus
              className="rounded-lg"
            />
          </div>

          <div className="space-y-3">
            <Label>Color</Label>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">
                  Picker
                </span>
                <input
                  id={colorId}
                  type="color"
                  value={normalizeColorInput(colorHex)}
                  onChange={(e) => setColorHex(e.target.value)}
                  className={cn(
                    "h-11 w-[4.5rem] cursor-pointer rounded-lg border border-neutral-200 bg-white p-1",
                    "shadow-sm",
                  )}
                  aria-label="Color picker"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <span className="text-[11px] text-muted-foreground">Hex</span>
                <Input
                  value={colorHex}
                  onChange={(e) => setColorHex(e.target.value)}
                  onBlur={(e) =>
                    setColorHex(normalizeColorInput(e.target.value))
                  }
                  placeholder="#fc6a08"
                  className="font-mono text-sm"
                  maxLength={32}
                  spellCheck={false}
                  aria-label="Color hex value"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
              <span
                className="size-6 shrink-0 rounded-md border border-neutral-200/80"
                style={{
                  backgroundColor: normalizeColorInput(colorHex),
                }}
                aria-hidden
              />
              <span className="text-xs text-muted-foreground">
                Preview — used on task chips and filters.
              </span>
            </div>
          </div>

          <div className="mt-auto flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!name.trim() || !workspaceId || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create label"
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
