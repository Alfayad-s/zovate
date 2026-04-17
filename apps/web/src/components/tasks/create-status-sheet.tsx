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
import { taskKeys } from "@/lib/query-keys";
import { createTaskStatus } from "@/lib/tasks-api";
import { cn } from "@/lib/utils";

export function CreateStatusSheet({
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

  useEffect(() => {
    if (!open) return;
    setName("");
  }, [open]);

  const createMutation = useMutation({
    meta: { skipGlobalErrorToast: true },
    mutationFn: () => {
      if (!workspaceId) throw new Error("No workspace");
      const n = name.trim();
      if (!n.length) throw new Error("Name is required");
      return createTaskStatus(workspaceId, { name: n });
    },
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: taskKeys.statuses(workspaceId),
        });
        void queryClient.invalidateQueries({
          queryKey: taskKeys.list(workspaceId, {}),
        });
      }
      toast.success("Column added");
      onOpenChange(false);
    },
    onError: (e) => {
      toast.error(getAuthErrorMessage(e, "Could not create status column"));
    },
  });

  const nameId = `${formId}-name`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-y-auto sm:max-w-md"
        showClose
      >
        <SheetHeader className="shrink-0 text-left">
          <SheetTitle>Add board column</SheetTitle>
          <SheetDescription>
            Each column is a task status. New columns work like Todo or Done:
            tasks live in one column at a time, and you drag cards between them.
            Name yours anything you want (for example “Wanted” or “Review”).
          </SheetDescription>
        </SheetHeader>

        <form
          id={formId}
          className="flex min-h-0 flex-1 flex-col gap-6 px-6 pb-8 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={nameId}>Status name</Label>
            <Input
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Wanted"
              autoFocus
              disabled={!workspaceId || createMutation.isPending}
              className="rounded-lg"
            />
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
              className={cn(
                "flex-1 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90",
              )}
              disabled={!workspaceId || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create column"
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
