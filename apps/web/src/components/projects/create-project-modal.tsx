"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { projectKeys } from "@/lib/query-keys";
import { createProject, type Project } from "@/lib/projects-api";
import { cn } from "@/lib/utils";

const visibilityEnum = z.enum(["workspace", "private", "public"]);

const schema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(10_000),
  visibility: visibilityEnum,
});

type FormValues = z.infer<typeof schema>;

export function CreateProjectModal({
  open,
  onOpenChange,
  workspaceId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | null;
  /** Called after the project is created successfully. */
  onCreated?: (project: Project) => void;
}) {
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      visibility: "workspace",
    },
  });

  const mutation = useMutation({
    meta: { skipGlobalErrorToast: true },
    mutationFn: (values: {
      name: string;
      description?: string;
      visibility: z.infer<typeof visibilityEnum>;
    }) => createProject(workspaceId!, values),
    onSuccess: (project: Project) => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: [...projectKeys.all, "list", workspaceId],
        });
      }
      onCreated?.(project);
      onOpenChange(false);
      form.reset({
        name: "",
        description: "",
        visibility: "workspace",
      });
    },
  });

  function onSubmit(values: FormValues) {
    if (!workspaceId) return;
    const desc = values.description.trim();
    mutation.mutate({
      name: values.name.trim(),
      ...(desc ? { description: desc } : {}),
      visibility: values.visibility,
    });
  }

  const disabled = !workspaceId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showClose>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Projects group tasks and collaborators within this workspace.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {mutation.error ? (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              >
                {getAuthErrorMessage(
                  mutation.error,
                  "Could not create project.",
                )}
              </p>
            ) : null}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Website redesign"
                      autoComplete="off"
                      disabled={disabled}
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
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <textarea
                      placeholder="Goals, scope, links…"
                      disabled={disabled}
                      rows={3}
                      className={cn(
                        "flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                      )}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="visibility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Visibility</FormLabel>
                  <FormControl>
                    <select
                      disabled={disabled}
                      className={cn(
                        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                      )}
                      {...field}
                    >
                      <option value="workspace">Workspace</option>
                      <option value="private">Private</option>
                      <option value="public">Public</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending || disabled}>
                {mutation.isPending ? "Creating…" : "Create project"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
