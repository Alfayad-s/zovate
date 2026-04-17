"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/contexts/workspace-context";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { workspaceKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { Workspace } from "@/lib/workspaces-api";
import { createWorkspace } from "@/lib/workspaces-api";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(120),
});

export type CreateWorkspaceFormValues = z.infer<typeof schema>;

type CreateWorkspaceFormProps = {
  /** Called after workspace is created and current workspace is set. */
  onCreated?: (workspace: Workspace) => void;
  /** When set (e.g. modal), shows a Cancel button next to submit. */
  onCancel?: () => void;
  submitLabel?: string;
  /** Larger label and input (e.g. first-workspace onboarding page). */
  fieldSize?: "default" | "lg";
};

export function CreateWorkspaceForm({
  onCreated,
  onCancel,
  submitLabel = "Create",
  fieldSize = "default",
}: CreateWorkspaceFormProps) {
  const large = fieldSize === "lg";
  const queryClient = useQueryClient();
  const { setCurrentWorkspaceId } = useWorkspace();

  const form = useForm<CreateWorkspaceFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  const mutation = useMutation({
    meta: { skipGlobalErrorToast: true },
    mutationFn: (values: { name: string }) =>
      createWorkspace({ name: values.name }),
    onSuccess: (workspace) => {
      setCurrentWorkspaceId(workspace.id);
      queryClient.setQueryData<Workspace[]>(workspaceKeys.list(), (prev) => {
        const list = prev ?? [];
        if (list.some((w) => w.id === workspace.id)) return list;
        return [...list, workspace];
      });
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
      form.reset({ name: "" });
      onCreated?.(workspace);
    },
  });

  function onSubmit(values: CreateWorkspaceFormValues) {
    mutation.mutate({ name: values.name.trim() });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn("space-y-4", large && "space-y-5")}
      >
        {mutation.error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {getAuthErrorMessage(
              mutation.error,
              "Could not create workspace.",
            )}
          </p>
        ) : null}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className={cn(large && "w-full space-y-3")}>
              <FormLabel
                className={cn(
                  large &&
                    "text-base font-semibold leading-snug text-neutral-900 sm:text-lg",
                )}
              >
                Name
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="Acme Inc."
                  autoComplete="organization"
                  className={cn(
                    "w-full",
                    large &&
                      "h-12 rounded-full border-neutral-200 px-5 text-lg shadow-none md:text-lg",
                  )}
                  {...field}
                />
              </FormControl>
              <FormMessage
                className={cn(large && "text-sm")}
              />
            </FormItem>
          )}
        />
        <div
          className={cn(
            "w-full",
            onCancel
              ? large
                ? "flex flex-col-reverse gap-3 pt-2"
                : "flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end"
              : "pt-2",
          )}
        >
          {onCancel ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className={cn(
                  large
                    ? "h-12 w-full rounded-full px-8 text-base"
                    : "w-full sm:w-auto",
                )}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className={cn(
                  large
                    ? "h-12 w-full rounded-full px-8 text-base"
                    : "w-full sm:w-auto",
                )}
              >
                {mutation.isPending ? "Creating…" : submitLabel}
              </Button>
            </>
          ) : (
            <Button
              type="submit"
              disabled={mutation.isPending}
              className={cn(
                large
                  ? "h-12 w-full rounded-full px-8 text-base"
                  : "w-full sm:max-w-xs",
              )}
            >
              {mutation.isPending ? "Creating…" : submitLabel}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
