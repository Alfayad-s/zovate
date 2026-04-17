"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { TaskAssigneeMentionTextarea } from "@/components/tasks/task-assignee-mention-textarea";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { notificationKeys, taskKeys, workspaceKeys } from "@/lib/query-keys";
import { createTask, type TaskWithRelations } from "@/lib/tasks-api";
import { fetchWorkspaceMembers } from "@/lib/workspaces-api";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(20000).optional(),
});

type FormValues = z.infer<typeof schema>;

export function CreateTaskSheet({
  open,
  onOpenChange,
  workspaceId,
  statusId,
  statusName,
  projectId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | null;
  statusId: string | null;
  statusName?: string;
  /** Current / default project (no picker — uses workspace context). */
  projectId: string | null;
  onCreated?: (task: TaskWithRelations) => void;
}) {
  const queryClient = useQueryClient();
  const [assigneeUserIds, setAssigneeUserIds] = useState<string[]>([]);

  const { data: workspaceMembers = [] } = useQuery({
    queryKey: workspaceKeys.members(workspaceId ?? "__none__"),
    queryFn: () => fetchWorkspaceMembers(workspaceId!),
    enabled: open && !!workspaceId,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      title: "",
      description: "",
    });
    setAssigneeUserIds([]);
  }, [open, form]);

  const mutation = useMutation({
    meta: { skipGlobalErrorToast: true },
    mutationFn: (values: {
      title: string;
      description?: string;
      assigneeUserIds: string[];
    }) => {
      if (!workspaceId || !statusId || !projectId) {
        throw new Error("Missing workspace, status, or project.");
      }
      return createTask(workspaceId, {
        title: values.title.trim(),
        projectId,
        statusId,
        ...(values.description?.trim()
          ? { description: values.description.trim() }
          : {}),
        ...(values.assigneeUserIds.length > 0
          ? { assigneeUserIds: values.assigneeUserIds }
          : {}),
      });
    },
    onSuccess: (task, variables) => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: taskKeys.list(workspaceId, {}),
        });
      }
      if (variables.assigneeUserIds.length > 0) {
        void queryClient.invalidateQueries({
          queryKey: notificationKeys.list(),
        });
      }
      onCreated?.(task);
      onOpenChange(false);
      form.reset({ title: "", description: "" });
      setAssigneeUserIds([]);
    },
  });

  function onSubmit(values: FormValues) {
    if (!workspaceId || !statusId || !projectId) return;
    mutation.mutate({
      title: values.title,
      description: values.description,
      assigneeUserIds,
    });
  }

  const disabled = !workspaceId || !statusId || !projectId;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-y-auto sm:max-w-md"
        showClose
      >
        <SheetHeader className="shrink-0 text-left">
          <SheetTitle>New task</SheetTitle>
          <SheetDescription>
            {statusName
              ? `Creates the task in “${statusName}”.`
              : "Create a task in this column."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col gap-6 px-6 pb-8 pt-2"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="What needs to be done?"
                      autoFocus
                      disabled={disabled}
                      className="rounded-lg"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-neutral-600">Description</FormLabel>
                  <FormControl>
                    <TaskAssigneeMentionTextarea
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      assigneeUserIds={assigneeUserIds}
                      onAssigneeUserIdsChange={setAssigneeUserIds}
                      members={workspaceMembers}
                      disabled={disabled}
                      placeholder="Optional — type @ to assign a teammate"
                    />
                  </FormControl>
                  <FormDescription>
                    Use @ and start typing a name; pick from suggestions to assign.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mutation.isError ? (
              <p className="text-sm text-red-600">
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : "Could not create task."}
              </p>
            ) : null}

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
                disabled={disabled || mutation.isPending}
              >
                {mutation.isPending ? "Creating…" : "Create task"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
