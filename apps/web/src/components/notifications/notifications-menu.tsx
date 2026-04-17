"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2, Settings } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import type { AppNotification } from "@/lib/notifications-api";
import {
  fetchUnreadNotifications,
  markNotificationsSeenOnPanelOpen,
} from "@/lib/notifications-api";
import { notificationKeys, workspaceKeys } from "@/lib/query-keys";
import { workspaceLiveQueryOptions } from "@/lib/realtime-query";
import {
  acceptWorkspaceInvitation,
  rejectWorkspaceInvitation,
} from "@/lib/workspaces-api";
import { cn } from "@/lib/utils";

const WORKSPACE_INVITE = "WORKSPACE_INVITE";
const ENTITY_INVITATION = "workspace_invitation";
const TASK_ASSIGNED = "TASK_ASSIGNED";
const ENTITY_TASK = "task";

function formatRelativeTime(iso: string) {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const diffMs = Date.now() - ts;
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function actorName(n: AppNotification) {
  return (
    n.triggeredBy?.fullName?.trim() ||
    n.triggeredBy?.email?.split("@")[0] ||
    "Someone"
  );
}

function RowAvatar({ n }: { n: AppNotification }) {
  const name = actorName(n);
  const initial = (name[0] ?? "?").toUpperCase();
  if (n.triggeredBy?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={n.triggeredBy.avatarUrl}
        alt=""
        className="size-11 shrink-0 rounded-full object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-semibold text-neutral-700">
      {initial}
    </div>
  );
}

function WorkspaceInviteRow({ n }: { n: AppNotification }) {
  const queryClient = useQueryClient();
  const invId = n.entityId;
  const workspaceName =
    typeof n.data?.workspaceName === "string"
      ? n.data.workspaceName
      : n.workspace.name;
  const role = typeof n.data?.role === "string" ? n.data.role : "MEMBER";
  const inviter = actorName(n);

  const acceptMut = useMutation({
    mutationFn: () => acceptWorkspaceInvitation(invId),
    onSuccess: () => {
      toast.success("You joined the workspace.");
      void queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
    onError: (e: unknown) =>
      toast.error(getAuthErrorMessage(e, "Could not accept invitation.")),
  });

  const rejectMut = useMutation({
    mutationFn: () => rejectWorkspaceInvitation(invId),
    onSuccess: () => {
      toast.success("Invitation declined.");
      void queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
    },
    onError: (e: unknown) =>
      toast.error(getAuthErrorMessage(e, "Could not decline invitation.")),
  });

  const pending = acceptMut.isPending || rejectMut.isPending;

  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        <RowAvatar n={n} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-neutral-900">
            {inviter} invited you to {workspaceName}
          </p>
          <p className="mt-0.5 text-sm text-neutral-500">
            {formatRelativeTime(n.createdAt)} <span className="mx-1.5">•</span>
            {role} invite
          </p>
        </div>
        {!n.isRead ? <span className="mt-2 size-2.5 rounded-full bg-sky-500" /> : null}
      </div>
      <div className="mt-3 flex gap-2 pl-14">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 rounded-xl border-neutral-200 px-4 text-sm"
          disabled={pending}
          onClick={() => rejectMut.mutate()}
        >
          {rejectMut.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            "Decline"
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-9 rounded-xl bg-sky-600 px-4 text-sm text-white hover:bg-sky-700"
          disabled={pending}
          onClick={() => acceptMut.mutate()}
        >
          {acceptMut.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            "Accept"
          )}
        </Button>
      </div>
    </div>
  );
}

function TaskAssignedRow({ n }: { n: AppNotification }) {
  const title = typeof n.data?.taskTitle === "string" ? n.data.taskTitle : "a task";
  const actor = actorName(n);

  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white px-4 py-3">
      <div className="flex items-start gap-3">
        <RowAvatar n={n} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-neutral-900">
            {actor} assigned you a task
          </p>
          <p className="mt-0.5 text-sm text-neutral-500">
            {formatRelativeTime(n.createdAt)} <span className="mx-1.5">•</span>
            {title}
          </p>
        </div>
        {!n.isRead ? <span className="mt-2 size-2.5 rounded-full bg-sky-500" /> : null}
      </div>
    </div>
  );
}

function NotificationBody({ n }: { n: AppNotification }) {
  if (n.type === WORKSPACE_INVITE && n.entityType === ENTITY_INVITATION) {
    return <WorkspaceInviteRow n={n} />;
  }
  if (n.type === TASK_ASSIGNED && n.entityType === ENTITY_TASK) {
    return <TaskAssignedRow n={n} />;
  }
  const actor = actorName(n);
  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white px-4 py-3">
      <div className="flex items-start gap-3">
        <RowAvatar n={n} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-neutral-900">
            {actor} sent a notification
          </p>
          <p className="mt-0.5 text-sm text-neutral-500">
            {formatRelativeTime(n.createdAt)} <span className="mx-1.5">•</span>
            {n.type}
          </p>
        </div>
        {!n.isRead ? <span className="mt-2 size-2.5 rounded-full bg-sky-500" /> : null}
      </div>
    </div>
  );
}

export function NotificationsMenu({
  collapsed,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"inbox" | "general">("inbox");

  const { data: items = [], isLoading } = useQuery({
    queryKey: notificationKeys.list(),
    queryFn: fetchUnreadNotifications,
    staleTime: 15 * 1000,
    ...workspaceLiveQueryOptions,
  });

  const unseenCount = useMemo(
    () => items.filter((n) => !n.isRead).length,
    [items],
  );

  const markSeenOnOpen = useMutation({
    mutationFn: markNotificationsSeenOnPanelOpen,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
    },
  });

  const markAllNow = useMutation({
    mutationFn: markNotificationsSeenOnPanelOpen,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
      toast.success("Marked all as read.");
    },
    onError: () => toast.error("Could not mark notifications as read."),
  });

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        /* Mark non-invite alerts seen after the panel closes so users can read them while open. */
        if (!open) markSeenOnOpen.mutate();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "relative shrink-0 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
            collapsed ? "size-9" : "h-9 w-9",
            unseenCount > 0 &&
              "text-primary ring-2 ring-primary/35 ring-offset-2 ring-offset-background",
            className,
          )}
          title={
            unseenCount > 0
              ? `${unseenCount} unseen notification${unseenCount === 1 ? "" : "s"}`
              : "Notifications"
          }
        >
          <Bell className={collapsed ? "size-[18px]" : "size-4"} strokeWidth={1.5} />
          {unseenCount > 0 ? (
            <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground shadow-md">
              {unseenCount > 9 ? "9+" : unseenCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(100vw-2rem,30rem)] overflow-hidden rounded-3xl border border-neutral-200/80 p-0"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b border-neutral-200 bg-white px-5 py-4">
          <div className="flex items-center justify-between">
            <p className="text-[34px] font-semibold tracking-tight text-neutral-900">
              Notifications
            </p>
            <button
              type="button"
              className="text-lg font-medium text-neutral-500 transition hover:text-neutral-800 disabled:opacity-50"
              onClick={() => markAllNow.mutate()}
              disabled={markAllNow.isPending || unseenCount === 0}
            >
              Mark all as read
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-5">
              <button
                type="button"
                className={cn(
                  "relative pb-2 text-3xl font-semibold transition",
                  tab === "inbox" ? "text-neutral-900" : "text-neutral-400 hover:text-neutral-700",
                )}
                onClick={() => setTab("inbox")}
              >
                Inbox
                {unseenCount > 0 ? (
                  <span className="ml-2 rounded-md bg-indigo-900 px-2 py-0.5 align-middle text-sm font-bold text-white">
                    {unseenCount}
                  </span>
                ) : null}
                {tab === "inbox" ? (
                  <span className="absolute inset-x-0 -bottom-[1px] h-1 rounded-full bg-indigo-900" />
                ) : null}
              </button>
              <button
                type="button"
                className={cn(
                  "pb-2 text-3xl font-semibold transition",
                  tab === "general"
                    ? "text-neutral-900"
                    : "text-neutral-400 hover:text-neutral-700",
                )}
                onClick={() => setTab("general")}
              >
                General
              </button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              title="Notification settings"
            >
              <Settings className="size-5" strokeWidth={1.8} />
            </Button>
          </div>
        </div>
        <div className="max-h-[min(34rem,calc(100vh-10rem))] overflow-y-auto bg-neutral-50/70">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-12 text-base text-neutral-500">
              <Loader2 className="size-5 animate-spin" />
              Loading…
            </div>
          ) : tab === "general" ? (
            <p className="px-4 py-12 text-center text-base text-neutral-500">
              No general notifications right now.
            </p>
          ) : items.length === 0 ? (
            <p className="px-4 py-12 text-center text-base text-neutral-500">
              No new notifications. You&rsquo;re all caught up.
            </p>
          ) : (
            <ul className="flex flex-col">
              {items.map((n) => (
                <li key={n.id} className="border-b border-neutral-200 last:border-b-0">
                  <div className="p-3">
                    <NotificationBody n={n} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
