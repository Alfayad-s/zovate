"use client";

import { parseTaskDescriptionMentions } from "@/lib/task-description-mentions";
import type { TaskUser } from "@/lib/tasks-api";
import { cn } from "@/lib/utils";

function MentionChip({
  label,
  userId,
  user,
}: {
  label: string;
  userId: string;
  user: TaskUser | undefined;
}) {
  const name = user?.fullName?.trim() || user?.email || label;
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <span
      className="mx-0.5 inline-flex max-w-[min(100%,14rem)] items-center gap-1 rounded-full border border-primary/25 bg-primary/[0.08] py-0.5 pl-0.5 pr-2 align-middle text-sm font-medium text-neutral-900"
      data-user-id={userId}
    >
      {user?.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatarUrl}
          alt=""
          className="size-5 shrink-0 rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary">
          {initial}
        </span>
      )}
      <span className="min-w-0 truncate">{name}</span>
    </span>
  );
}

export function TaskDescriptionWithMentions({
  text,
  usersById,
  className,
}: {
  text: string;
  usersById: Map<string, TaskUser>;
  className?: string;
}) {
  const segments = parseTaskDescriptionMentions(text);

  return (
    <div className={cn("text-sm leading-relaxed text-neutral-800", className)}>
      {segments.map((seg, i) => {
        if (seg.kind === "text") {
          return (
            <span key={i} className="whitespace-pre-wrap break-words">
              {seg.text}
            </span>
          );
        }
        return (
          <MentionChip
            key={`${seg.userId}-${i}`}
            label={seg.label}
            userId={seg.userId}
            user={usersById.get(seg.userId)}
          />
        );
      })}
    </div>
  );
}
