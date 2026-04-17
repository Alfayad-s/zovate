"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { InviteWorkspaceMembersDialog } from "@/components/workspace/invite-workspace-members-dialog";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAuthUser } from "@/hooks/use-auth";
import { workspaceKeys } from "@/lib/query-keys";
import {
  fetchWorkspaceMembers,
  type WorkspaceMember,
} from "@/lib/workspaces-api";
import { cn } from "@/lib/utils";

function MemberRowAvatar({ member }: { member: WorkspaceMember }) {
  const u = member.user;
  const initial = (u.fullName?.[0] ?? u.email[0] ?? "?").toUpperCase();
  if (u.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={u.avatarUrl}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-800">
      {initial}
    </div>
  );
}

export default function WorkspaceMembersPage() {
  const router = useRouter();
  const { data: user } = useAuthUser();
  const { currentWorkspaceId } = useWorkspace();
  const [inviteOpen, setInviteOpen] = useState(false);

  const {
    data: members,
    isLoading,
    isError,
  } = useQuery({
    queryKey: workspaceKeys.members(currentWorkspaceId ?? "__none__"),
    queryFn: () => fetchWorkspaceMembers(currentWorkspaceId!),
    enabled: !!user && !!currentWorkspaceId,
  });

  const canManage = useMemo(() => {
    if (!user || !members) return false;
    const me = members.find((m) => m.userId === user.id);
    return me?.role === "OWNER" || me?.role === "ADMIN";
  }, [user, members]);

  useEffect(() => {
    if (!currentWorkspaceId || !user || isLoading || !members) return;
    if (!canManage) router.replace("/");
  }, [canManage, currentWorkspaceId, isLoading, members, router, user]);

  if (!currentWorkspaceId) {
    return (
      <div className="p-6 md:p-10">
        <p className="text-sm text-neutral-600">Select a workspace to manage members.</p>
      </div>
    );
  }

  if (isLoading || (members && user && !canManage)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6 md:p-10">
        <Loader2 className="size-8 animate-spin text-neutral-400" aria-hidden />
      </div>
    );
  }

  if (isError || !members) {
    return (
      <div className="p-6 md:p-10">
        <p className="text-sm text-red-600">Could not load members.</p>
        <Button asChild variant="outline" className="mt-4 rounded-xl">
          <Link href="/">Back to overview</Link>
        </Button>
      </div>
    );
  }

  const sorted = [...members].sort((a, b) => {
    const an = (a.user.fullName?.trim() || a.user.email).toLowerCase();
    const bn = (b.user.fullName?.trim() || b.user.email).toLowerCase();
    return an.localeCompare(bn);
  });

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
            Members
          </h1>
          <p className="mt-1 max-w-xl text-sm text-neutral-600">
            People who can access this workspace. Owners and admins can invite
            others.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 rounded-xl border-neutral-200 text-[13px] font-medium"
          onClick={() => setInviteOpen(true)}
        >
          <UserPlus className="mr-2 size-4" strokeWidth={1.5} />
          Invite
        </Button>
      </div>

      <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
        {sorted.map((m) => {
          const label = m.user.fullName?.trim() || m.user.email;
          return (
            <li
              key={m.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <MemberRowAvatar member={m} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-neutral-900">
                    {label}
                  </p>
                  <p className="truncate text-sm text-neutral-500">
                    {m.user.email}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                <span
                  className={cn(
                    "inline-flex rounded-lg px-2 py-0.5 text-xs font-medium",
                    m.role === "OWNER" && "bg-amber-100 text-amber-900",
                    m.role === "ADMIN" && "bg-violet-100 text-violet-900",
                    m.role !== "OWNER" &&
                      m.role !== "ADMIN" &&
                      "bg-neutral-100 text-neutral-700",
                  )}
                >
                  {m.role.charAt(0) + m.role.slice(1).toLowerCase()}
                </span>
                <span className="text-xs text-neutral-400">
                  Joined{" "}
                  {new Date(m.joinedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <InviteWorkspaceMembersDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        workspaceId={currentWorkspaceId}
      />
    </div>
  );
}
