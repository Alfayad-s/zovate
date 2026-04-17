"use client";

import Link from "next/link";

import type { WorkspaceMember } from "@/lib/workspaces-api";
import { cn } from "@/lib/utils";

function MemberAvatar({
  user,
  sizeClass,
}: {
  user: WorkspaceMember["user"];
  sizeClass: string;
}) {
  const initial = (user.fullName?.[0] ?? user.email[0] ?? "?").toUpperCase();
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt=""
        className={cn(sizeClass, "rounded-full object-cover")}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div
      className={cn(
        sizeClass,
        "flex items-center justify-center rounded-full bg-neutral-200 text-[11px] font-semibold text-neutral-800",
      )}
    >
      {initial}
    </div>
  );
}

export function WorkspaceMemberStack({
  members,
  collapsed,
  manageHref,
  className,
}: {
  members: WorkspaceMember[];
  collapsed?: boolean;
  /** Owner/admin: entire stack links to members management. */
  manageHref?: string;
  className?: string;
}) {
  if (members.length === 0) return null;

  const max = collapsed ? 4 : 6;
  const visible = members.slice(0, max);
  const rest = members.length - visible.length;
  const sizeClass = collapsed ? "h-6 w-6" : "h-8 w-8";
  const overlap = collapsed ? "-ml-1.5" : "-ml-2.5";
  const ring = "ring-2 ring-white";

  const title = members
    .map((m) => m.user.fullName?.trim() || m.user.email)
    .join(", ");

  const wrapperClass = cn(
    collapsed
      ? "flex justify-center py-1.5"
      : "px-2.5 pb-1 pt-0",
    manageHref &&
      "rounded-xl outline-none transition-colors hover:bg-neutral-100/80 focus-visible:ring-2 focus-visible:ring-neutral-300",
    className,
  );

  const body = (
    <>
      {!collapsed ? (
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
          Members
        </p>
      ) : null}
      <div
        className={cn(
          "flex flex-row items-center",
          collapsed ? "justify-center" : "justify-start",
        )}
        aria-label={`${members.length} other workspace members`}
      >
        {visible.map((m, i) => (
          <div
            key={m.id}
            className={cn(
              "relative shrink-0 rounded-full",
              ring,
              i > 0 && overlap,
            )}
            style={{ zIndex: visible.length - i }}
          >
            <MemberAvatar user={m.user} sizeClass={sizeClass} />
          </div>
        ))}
        {rest > 0 ? (
          <div
            className={cn(
              "relative flex shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-semibold text-neutral-600 ring-2 ring-white",
              sizeClass,
              overlap,
            )}
            style={{ zIndex: visible.length + 1 }}
          >
            +{rest}
          </div>
        ) : null}
      </div>
    </>
  );

  if (manageHref) {
    return (
      <Link
        href={manageHref}
        className={wrapperClass}
        title={`${title} · Open members`}
        aria-label="Manage workspace members"
      >
        {body}
      </Link>
    );
  }

  return (
    <div className={wrapperClass} title={title}>
      {body}
    </div>
  );
}
