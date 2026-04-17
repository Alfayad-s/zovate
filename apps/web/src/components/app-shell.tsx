"use client";

import {
  ClipboardList,
  FolderKanban,
  GripVertical,
  HelpCircle,
  LayoutGrid,
  LogIn,
  LogOut,
  MoreHorizontal,
  PanelLeftClose,
  RefreshCw,
  Search,
  Settings,
  UserPlus,
  ChevronRight,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PointerEvent, ReactNode } from "react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { AppHeaderPageTitle } from "@/components/app-header-page-title";
import { SquadChatDock } from "@/components/chat/squad-chat-dock";
import { NotificationsMenu } from "@/components/notifications/notifications-menu";

import { CreateProjectModal } from "@/components/projects/create-project-modal";
import { TaskViewTabsHeader } from "@/components/tasks/task-view-tabs";
import { ProjectSwitcher } from "@/components/projects/project-switcher";
import { useProject } from "@/contexts/project-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { CreateWorkspaceModal } from "@/components/workspace/create-workspace-modal";
import { InviteWorkspaceMembersDialog } from "@/components/workspace/invite-workspace-members-dialog";
import { CREATE_WORKSPACE_PATH } from "@/components/workspace/workspace-onboarding-gate";
import { WorkspaceMemberStack } from "@/components/workspace/workspace-member-stack";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthUser, useLogout } from "@/hooks/use-auth";
import { useMounted } from "@/hooks/use-mounted";
import type { AuthUser } from "@/lib/auth-api";
import { getStoredAccessToken } from "@/lib/auth-storage";
import { workspaceKeys } from "@/lib/query-keys";
import { fetchWorkspaceMembers } from "@/lib/workspaces-api";
import { cn } from "@/lib/utils";

const DRAG_THRESHOLD_PX = 36;
const MOVE_START_PX = 6;

function UserAvatar({
  user,
  className,
}: {
  user: AuthUser;
  className?: string;
}) {
  const initial = (user.fullName?.[0] ?? user.email[0] ?? "?").toUpperCase();
  if (user.avatarUrl) {
    return (
      // OAuth avatars use various hosts; native img avoids Next config churn.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt=""
        className={cn("h-10 w-10 rounded-full object-cover", className)}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 text-sm font-semibold text-neutral-800",
        className,
      )}
    >
      {initial}
    </div>
  );
}

const generalNav: {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
}[] = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: ClipboardList },
];

function routeActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const mounted = useMounted();
  const { data: user, isPending, isFetching, isError } = useAuthUser();
  const { projects: shellProjects, isLoading: projectsContextLoading } =
    useProject();
  const { currentWorkspaceId } = useWorkspace();
  const { data: workspaceMembers } = useQuery({
    queryKey: workspaceKeys.members(currentWorkspaceId ?? "__none__"),
    queryFn: () => fetchWorkspaceMembers(currentWorkspaceId!),
    enabled: !!user && !!currentWorkspaceId,
  });
  const memberStackOthers = useMemo(() => {
    if (!user || !workspaceMembers?.length) return null;
    const others = workspaceMembers.filter((m) => m.userId !== user.id);
    return others.length > 0 ? others : null;
  }, [user, workspaceMembers]);
  const canInviteMembers = useMemo(() => {
    if (!user || !workspaceMembers) return false;
    const me = workspaceMembers.find((m) => m.userId === user.id);
    return me?.role === "OWNER" || me?.role === "ADMIN";
  }, [user, workspaceMembers]);
  const logout = useLogout();
  const hasToken =
    mounted && typeof window !== "undefined" && !!getStoredAccessToken();

  const [collapsed, setCollapsed] = useState(false);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [inviteMembersOpen, setInviteMembersOpen] = useState(false);
  const dragRef = useRef<{ startX: number; moved: boolean } | null>(null);

  useEffect(() => {
    setInviteMembersOpen(false);
  }, [currentWorkspaceId]);

  const onEdgePointerDown = useCallback((e: PointerEvent<HTMLButtonElement>) => {
    dragRef.current = { startX: e.clientX, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onEdgePointerMove = useCallback((e: PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.startX) > MOVE_START_PX) d.moved = true;
  }, []);

  const finishEdgeGesture = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      const d = dragRef.current;
      dragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      if (!d) return;
      const dx = e.clientX - d.startX;
      if (d.moved) {
        if (dx < -DRAG_THRESHOLD_PX && !collapsed) setCollapsed(true);
        else if (dx > DRAG_THRESHOLD_PX && collapsed) setCollapsed(false);
      } else {
        setCollapsed((c) => !c);
      }
    },
    [collapsed],
  );

  const widthClass = collapsed ? "w-[4.5rem]" : "w-[280px]";

  const hideSidebarProjectsOnboarding =
    !!user &&
    pathname === "/projects" &&
    (projectsContextLoading || shellProjects.length === 0);

  if (pathname === CREATE_WORKSPACE_PATH) {
    return (
      <div className="min-h-dvh overflow-auto bg-neutral-100/80 text-neutral-900">
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-dvh min-h-0 gap-3 overflow-hidden bg-neutral-100/80 p-3 text-neutral-900">
      {!hideSidebarProjectsOnboarding ? (
      <aside
        className={cn(
          "relative flex h-full min-h-0 shrink-0 flex-col border border-neutral-200/90 bg-white transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          "rounded-2xl select-none",
          widthClass,
        )}
      >
        {/* Right-edge resize / click to toggle */}
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title="Drag or click to resize"
          className="group absolute right-0 top-0 z-30 flex h-full w-3 cursor-col-resize items-center justify-center border-0 bg-transparent p-0 outline-none"
          onPointerDown={onEdgePointerDown}
          onPointerMove={onEdgePointerMove}
          onPointerUp={finishEdgeGesture}
          onPointerCancel={finishEdgeGesture}
        >
          <span className="absolute inset-y-0 right-0 w-px bg-neutral-300/90 transition-colors group-hover:bg-neutral-400 group-active:bg-neutral-600" />
          <GripVertical
            className="relative size-3.5 text-neutral-400 transition-colors group-hover:text-neutral-600 group-active:text-neutral-700"
            strokeWidth={2}
            aria-hidden
          />
        </button>
        {/* Header: workspace switcher (signed-in) or brand; settings + collapse on the right */}
        <div
          className={cn(
            "flex w-full min-w-0 items-center border-b border-neutral-200/90 px-3 py-4",
            collapsed ? "justify-center px-2" : "justify-between gap-2",
          )}
        >
          {user ? (
            <div
              className={cn(
                "min-w-0",
                collapsed
                  ? "flex w-full justify-center"
                  : "min-w-0 flex-1 shrink pr-1",
              )}
            >
              <WorkspaceSwitcher
                collapsed={collapsed}
                onCreateWorkspace={() => setCreateWorkspaceOpen(true)}
              />
            </div>
          ) : (
            <Link
              href={shellProjects.length === 0 ? "/projects" : "/"}
              className={cn(
                "flex min-w-0 items-center gap-3",
                !collapsed && "flex-1",
                collapsed && "justify-center",
              )}
            >
              <Image
                src="/logo/logo-with-text.svg"
                alt="Zovate"
                width={40}
                height={44}
                unoptimized
                className="h-10 w-auto shrink-0 object-contain object-center transition-transform duration-200 hover:scale-[1.02]"
              />
              {!collapsed && (
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold tracking-tight text-neutral-900">
                    Zovate
                  </p>
                  <p className="truncate text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                    Workspace
                  </p>
                </div>
              )}
            </Link>
          )}
          {!collapsed && (
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                asChild
              >
                <Link href="/settings" title="Settings">
                  <Settings className="size-[18px]" strokeWidth={1.5} />
                </Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                title="Collapse sidebar"
                onClick={() => setCollapsed((c) => !c)}
              >
                <PanelLeftClose
                  className="size-[18px] transition-transform duration-300"
                  strokeWidth={1.5}
                />
              </Button>
            </div>
          )}
        </div>

        {/* Search */}
        {!collapsed && (
          <div className="px-3 pb-2 pt-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
                strokeWidth={1.5}
              />
              <Input
                readOnly
                placeholder="Search"
                className="h-10 cursor-default rounded-xl border-neutral-200 bg-neutral-50/80 pl-9 pr-16 text-sm text-neutral-800 placeholder:text-neutral-400 focus-visible:ring-neutral-300"
                aria-label="Search (coming soon)"
              />
              <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-neutral-400 sm:inline-block">
                ⌘K
              </kbd>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 pr-3 [scrollbar-width:thin]">
          <p
            className={cn(
              "px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400",
              collapsed && "text-center text-[9px]",
            )}
          >
            {collapsed ? "Gen" : "General"}
          </p>
          <nav className="flex flex-col gap-0.5">
            {(shellProjects.length === 0
              ? generalNav.filter((n) => n.href === "/projects")
              : generalNav
            ).map(({ href, label, icon: Icon }) => {
              const active = routeActive(pathname, href);
              return (
                <Link
                  key={href + label}
                  href={href}
                  title={collapsed ? label : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-[13px] font-medium text-neutral-600 transition-colors duration-200",
                    "hover:bg-neutral-100 hover:text-neutral-900",
                    active && "bg-neutral-100 text-neutral-900",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-[18px] shrink-0 transition-transform duration-200 group-hover:scale-[1.03]",
                      active && "text-neutral-900",
                    )}
                    strokeWidth={1.5}
                  />
                  {!collapsed && <span className="truncate">{label}</span>}
                </Link>
              );
            })}
          </nav>
          {memberStackOthers || canInviteMembers ? (
            <div
              className={cn(
                "border-neutral-200/70",
                collapsed
                  ? "mt-2 border-t-0 pt-1"
                  : "mt-4 border-t pt-3.5",
              )}
            >
              {memberStackOthers ? (
                <WorkspaceMemberStack
                  members={memberStackOthers}
                  collapsed={collapsed}
                  manageHref={
                    canInviteMembers ? "/workspace/members" : undefined
                  }
                />
              ) : canInviteMembers ? (
                <Link
                  href="/workspace/members"
                  className={cn(
                    "block rounded-xl px-2.5 py-2 outline-none transition-colors hover:bg-neutral-100/80 focus-visible:ring-2 focus-visible:ring-neutral-300",
                    collapsed &&
                      "flex flex-col items-center justify-center py-2",
                  )}
                  title="Manage members"
                  aria-label="Manage workspace members"
                >
                  {!collapsed ? (
                    <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                      Members
                    </p>
                  ) : null}
                  <div
                    className={cn(
                      "flex items-center gap-3",
                      collapsed ? "justify-center" : "",
                    )}
                  >
                    <Users
                      className={cn(
                        "shrink-0 text-neutral-500",
                        collapsed ? "size-5" : "size-[18px]",
                      )}
                      strokeWidth={1.5}
                    />
                    {!collapsed ? (
                      <span className="truncate text-[13px] font-medium text-neutral-700">
                        Manage members
                      </span>
                    ) : null}
                  </div>
                </Link>
              ) : null}

              {user && currentWorkspaceId && canInviteMembers ? (
                <div
                  className={cn(
                    "mt-3 px-2.5",
                    collapsed && "mt-2 flex justify-center px-0",
                  )}
                >
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "rounded-xl border-neutral-200 text-[13px] font-medium text-neutral-800 hover:bg-neutral-50",
                      collapsed
                        ? "mx-auto flex size-10 items-center justify-center p-0"
                        : "h-9 w-full",
                    )}
                    title={collapsed ? "Invite members" : undefined}
                    onClick={() => setInviteMembersOpen(true)}
                  >
                    <UserPlus
                      className={cn("size-4 shrink-0", !collapsed && "mr-2")}
                      strokeWidth={1.5}
                    />
                    {!collapsed && "Invite members"}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Footer: utilities + auth / profile */}
        <div className="mt-auto border-t border-neutral-200/90 px-2 py-3 pr-3">
          {!collapsed && (
            <div className="mb-3 flex items-center justify-between gap-1 px-1">
              {user ? (
                <NotificationsMenu />
              ) : (
                <span className="h-9 w-9" aria-hidden />
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                title="More"
              >
                <MoreHorizontal className="size-[18px]" strokeWidth={1.5} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                title="Refresh"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="size-[18px]" strokeWidth={1.5} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                title="Help"
              >
                <HelpCircle className="size-[18px]" strokeWidth={1.5} />
              </Button>
            </div>
          )}

          {mounted && user && (
            <div
              className={cn(
                "flex w-full min-w-0 flex-col gap-2",
                collapsed && "items-center",
              )}
            >
              {collapsed && (
                <div className="flex w-full flex-col items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                    title="Expand sidebar"
                    onClick={() => setCollapsed(false)}
                  >
                    <ChevronRight className="size-4" strokeWidth={1.5} />
                  </Button>
                  <NotificationsMenu collapsed />
                </div>
              )}
              {!collapsed && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 w-full rounded-xl border-neutral-200 text-[13px] font-medium text-neutral-800 hover:bg-neutral-50"
                  onClick={logout}
                >
                  <LogOut className="mr-2 size-4" strokeWidth={1.5} />
                  Sign out
                </Button>
              )}
              {collapsed && (
                <div className="flex w-full justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-lg text-neutral-500 hover:bg-neutral-100"
                    title="Sign out"
                    onClick={logout}
                  >
                    <LogOut className="size-[18px]" strokeWidth={1.5} />
                  </Button>
                </div>
              )}
              <Link
                href="/settings?tab=account"
                aria-label="Account settings"
                className={cn(
                  "flex w-full min-w-0 items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-neutral-50",
                  collapsed && "justify-center px-0",
                )}
              >
                <div className="relative shrink-0">
                  <UserAvatar user={user} />
                  <span
                    className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-primary"
                    title="Online"
                  />
                </div>
                {!collapsed && (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-neutral-900">
                        {user.fullName?.trim() ||
                          user.email.split("@")[0] ||
                          "Account"}
                      </p>
                      <p className="truncate text-xs text-neutral-500">
                        {user.email}
                      </p>
                    </div>
                    <ChevronRight
                      className="size-4 shrink-0 text-neutral-300"
                      strokeWidth={1.5}
                    />
                  </>
                )}
              </Link>
            </div>
          )}

          {mounted && !user && !hasToken && !collapsed && (
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="h-9 w-full rounded-xl border-neutral-200 text-[13px] font-medium"
                asChild
              >
                <Link href="/login">
                  <LogIn className="mr-2 size-4" strokeWidth={1.5} />
                  Sign in
                </Link>
              </Button>
              <Button
                className="h-9 w-full rounded-xl bg-primary text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
                asChild
              >
                <Link href="/register">
                  <UserPlus className="mr-2 size-4" strokeWidth={1.5} />
                  Register
                </Link>
              </Button>
            </div>
          )}
          {mounted && !user && !hasToken && collapsed && (
            <div className="flex flex-col items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                title="Expand sidebar"
                onClick={() => setCollapsed(false)}
              >
                <ChevronRight className="size-4" strokeWidth={1.5} />
              </Button>
              <Button variant="ghost" size="icon" className="rounded-lg" asChild>
                <Link href="/login" title="Sign in">
                  <LogIn className="size-[18px]" strokeWidth={1.5} />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" className="rounded-lg" asChild>
                <Link href="/register" title="Register">
                  <UserPlus className="size-[18px]" strokeWidth={1.5} />
                </Link>
              </Button>
            </div>
          )}

          {hasToken && (isPending || isFetching) && (
            <p className="px-2 text-center text-[11px] text-neutral-400">
              Signing in…
            </p>
          )}
          {isError && !collapsed && (
            <p className="rounded-lg bg-neutral-100 px-2 py-1.5 text-[11px] text-neutral-700">
              Could not load session.
            </p>
          )}
        </div>
      </aside>
      ) : null}

      <main
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
          user ? "gap-3" : "rounded-2xl border border-neutral-200/80 bg-white/80",
          className,
        )}
      >
        {user ? (
          <header className="grid w-full min-w-0 shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-3">
            {/* Left capsule: project switcher */}
            <div className="flex h-11 shrink-0 items-center rounded-full border border-neutral-200/80 bg-white/95 px-2 backdrop-blur-sm sm:px-3">
              {currentWorkspaceId ? (
                <div className="min-w-0 max-w-[12rem] shrink sm:max-w-[14rem]">
                  <ProjectSwitcher
                    onCreateProject={() => setCreateProjectOpen(true)}
                  />
                </div>
              ) : (
                <span className="px-2 text-sm font-medium text-neutral-400">
                  No project
                </span>
              )}
            </div>

            {/* Center capsule: view selector / title (centered between left + right) */}
            <div className="flex h-11 min-w-0 items-center justify-self-center rounded-full  bg-transparent px-3 sm:px-4">
              <div className="flex min-h-0 min-w-0 flex-1 justify-center">
                <Suspense
                  fallback={
                    <p className="truncate text-center text-sm font-semibold tracking-tight text-neutral-400 sm:text-base">
                      …
                    </p>
                  }
                >
                  {pathname.startsWith("/tasks") ? (
                    <TaskViewTabsHeader />
                  ) : (
                    <AppHeaderPageTitle />
                  )}
                </Suspense>
              </div>
            </div>

            {/* Right capsule: search + icons */}
            <div className="flex h-11 shrink-0 items-center justify-self-end rounded-full border border-neutral-200/80 bg-white/95 px-2 backdrop-blur-sm sm:px-3">
              <div className="flex items-center gap-1.5">
                <div className="relative w-[min(100%,10rem)] shrink-0 sm:w-36 md:w-44 lg:w-52">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  <Input
                    type="search"
                    placeholder="Search…"
                    className="h-8 rounded-full border-neutral-200 bg-neutral-50/90 py-1 pl-8 pr-2.5 text-sm placeholder:text-neutral-400 focus-visible:ring-neutral-300"
                    aria-label="Search"
                  />
                </div>
                <NotificationsMenu className="h-8 w-8 shrink-0 rounded-full" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  asChild
                >
                  <Link href="/settings" title="Settings">
                    <Settings className="size-4" strokeWidth={1.5} />
                  </Link>
                </Button>
              </div>
            </div>
          </header>
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto">
          {children}
        </div>
      </main>
      {user ? <SquadChatDock /> : null}
      <CreateWorkspaceModal
        open={createWorkspaceOpen}
        onOpenChange={setCreateWorkspaceOpen}
      />
      <CreateProjectModal
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        workspaceId={currentWorkspaceId}
      />
      <InviteWorkspaceMembersDialog
        open={inviteMembersOpen}
        onOpenChange={setInviteMembersOpen}
        workspaceId={currentWorkspaceId}
      />
    </div>
  );
}
