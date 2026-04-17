"use client";

import type { TaskWithRelations } from "@/lib/tasks-api";
import { cn } from "@/lib/utils";

type Assignee = TaskWithRelations["assignees"][number];

function initial(name: string) {
  const t = name.trim();
  return t ? t.slice(0, 1).toUpperCase() : "?";
}

export function AssigneeAvatarStack({
  assignees,
  size = "sm",
  max = 3,
  className,
}: {
  assignees: Assignee[];
  size?: "xs" | "sm" | "md";
  max?: number;
  className?: string;
}) {
  if (assignees.length === 0) return null;

  const shown = assignees.slice(0, max);
  const rest = assignees.length - shown.length;

  const dim =
    size === "xs"
      ? "size-5 text-[9px]"
      : size === "md"
        ? "size-9 text-[12px]"
        : "size-6 text-[10px]";
  const stackSpace = size === "md" ? "-space-x-3" : "-space-x-2";

  return (
    <div
      className={cn("flex shrink-0 items-center", className)}
      aria-label={`${assignees.length} assignee${assignees.length === 1 ? "" : "s"}`}
    >
      <div className={cn("flex", stackSpace)}>
        {shown.map((a, i) => {
          const name = a.user.fullName?.trim() || a.user.email;
          return (
            <div
              key={a.userId}
              className={cn(
                "relative inline-flex rounded-full bg-white ring-2 ring-white",
                dim,
              )}
              style={{ zIndex: shown.length - i }}
              title={name}
            >
              {a.user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.user.avatarUrl}
                  alt=""
                  className="size-full rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span
                  className={cn(
                    "flex size-full items-center justify-center rounded-full bg-neutral-200 font-semibold text-neutral-700",
                    size === "xs"
                      ? "text-[9px]"
                      : size === "md"
                        ? "text-[12px]"
                        : "text-[10px]",
                  )}
                >
                  {initial(name)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {rest > 0 ? (
        <span
          className={cn(
            "-ml-1 inline-flex items-center justify-center rounded-full bg-neutral-100 font-medium text-neutral-600 ring-2 ring-white",
            size === "xs"
              ? "size-5 text-[9px]"
              : size === "md"
                ? "size-9 text-[12px]"
              : "size-6 text-[10px]",
          )}
          style={{ zIndex: 0 }}
        >
          +{rest}
        </span>
      ) : null}
    </div>
  );
}
