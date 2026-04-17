"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, User, Building2, Tag } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAuthUser } from "@/hooks/use-auth";
import { PresetAvatarPicker } from "@/components/settings/preset-avatar-picker";
import { WorkspaceLabelsPanel } from "@/components/settings/workspace-labels-panel";
import { patchProfile, uploadAvatar } from "@/lib/auth-api";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { authKeys, workspaceKeys } from "@/lib/query-keys";
import {
  fetchWorkspaceMembers,
  updateWorkspace,
  uploadWorkspaceLogo,
} from "@/lib/workspaces-api";
import { cn } from "@/lib/utils";

type Tab = "account" | "workspace" | "labels";

export function SettingsView() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: user, isPending: userLoading } = useAuthUser();
  const {
    currentWorkspace,
    currentWorkspaceId,
    refetchWorkspaces,
    isLoading: wsLoading,
  } = useWorkspace();

  const { data: workspaceMembers, isLoading: membersLoading } = useQuery({
    queryKey: workspaceKeys.members(currentWorkspaceId ?? "__none__"),
    queryFn: () => fetchWorkspaceMembers(currentWorkspaceId!),
    enabled: !!currentWorkspaceId && !!user,
  });

  const canManageWorkspace = useMemo(() => {
    if (!user || !workspaceMembers) return false;
    const me = workspaceMembers.find((m) => m.userId === user.id);
    return me?.role === "OWNER" || me?.role === "ADMIN";
  }, [user, workspaceMembers]);

  const rawTab = searchParams.get("tab");
  const tab: Tab =
    rawTab === "labels"
      ? "labels"
      : rawTab === "workspace"
        ? "workspace"
        : "account";

  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [wsName, setWsName] = useState("");
  const [workspaceLogoUrlInput, setWorkspaceLogoUrlInput] = useState("");

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName ?? "");
    setBio(user.bio ?? "");
  }, [user]);

  useEffect(() => {
    if (!currentWorkspace) return;
    setWsName(currentWorkspace.name);
    setWorkspaceLogoUrlInput(currentWorkspace.logoUrl ?? "");
  }, [currentWorkspace]);

  useEffect(() => {
    if (!currentWorkspaceId || !user || membersLoading) return;
    if (!canManageWorkspace && (tab === "workspace" || tab === "labels")) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "account");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [
    canManageWorkspace,
    currentWorkspaceId,
    membersLoading,
    pathname,
    router,
    searchParams,
    tab,
    user,
  ]);

  const profileMutation = useMutation({
    meta: { skipGlobalErrorToast: true },
    mutationFn: () =>
      patchProfile({
        fullName: fullName.trim() || undefined,
        bio: bio.trim() || undefined,
      }),
    onSuccess: (u) => {
      queryClient.setQueryData(authKeys.user(), u);
      toast.success("Profile saved");
    },
    onError: (e) => {
      toast.error(getAuthErrorMessage(e, "Could not save profile"));
    },
  });

  const avatarMutation = useMutation({
    meta: { skipGlobalErrorToast: true },
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: (u) => {
      queryClient.setQueryData(authKeys.user(), u);
      toast.success("Avatar updated");
    },
    onError: (e) => {
      toast.error(getAuthErrorMessage(e, "Could not upload avatar"));
    },
  });

  const presetAvatarMutation = useMutation({
    meta: { skipGlobalErrorToast: true },
    mutationFn: (absoluteUrl: string) =>
      patchProfile({ avatarUrl: absoluteUrl }),
    onSuccess: (u) => {
      queryClient.setQueryData(authKeys.user(), u);
      toast.success("Avatar updated");
    },
    onError: (e) => {
      toast.error(getAuthErrorMessage(e, "Could not update avatar"));
    },
  });

  const clearPresetAvatarMutation = useMutation({
    meta: { skipGlobalErrorToast: true },
    mutationFn: () => patchProfile({ avatarUrl: "" }),
    onSuccess: (u) => {
      queryClient.setQueryData(authKeys.user(), u);
      toast.success("Avatar cleared");
    },
    onError: (e) => {
      toast.error(getAuthErrorMessage(e, "Could not clear avatar"));
    },
  });

  const avatarBusy =
    avatarMutation.isPending ||
    presetAvatarMutation.isPending ||
    clearPresetAvatarMutation.isPending;

  const workspaceMutation = useMutation({
    meta: { skipGlobalErrorToast: true },
    mutationFn: () => {
      if (!currentWorkspaceId) throw new Error("No workspace");
      return updateWorkspace(currentWorkspaceId, {
        name: wsName.trim(),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
      void refetchWorkspaces();
      toast.success("Workspace updated");
    },
    onError: (e) => {
      toast.error(getAuthErrorMessage(e, "Could not update workspace"));
    },
  });

  const wsLogoMutation = useMutation({
    meta: { skipGlobalErrorToast: true },
    mutationFn: (file: File) => {
      if (!currentWorkspaceId) throw new Error("No workspace");
      return uploadWorkspaceLogo(currentWorkspaceId, file);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
      void refetchWorkspaces();
      toast.success("Workspace logo updated");
    },
    onError: (e) => {
      toast.error(getAuthErrorMessage(e, "Could not upload logo"));
    },
  });

  const wsClearLogoMutation = useMutation({
    meta: { skipGlobalErrorToast: true },
    mutationFn: () => {
      if (!currentWorkspaceId) throw new Error("No workspace");
      return updateWorkspace(currentWorkspaceId, { logoUrl: "" });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
      void refetchWorkspaces();
      toast.success("Workspace logo removed");
    },
    onError: (e) => {
      toast.error(getAuthErrorMessage(e, "Could not remove logo"));
    },
  });

  const wsLogoUrlMutation = useMutation({
    meta: { skipGlobalErrorToast: true },
    mutationFn: (url: string) => {
      if (!currentWorkspaceId) throw new Error("No workspace");
      return updateWorkspace(currentWorkspaceId, { logoUrl: url.trim() });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
      void refetchWorkspaces();
      toast.success("Workspace logo updated");
    },
    onError: (e) => {
      toast.error(getAuthErrorMessage(e, "Could not set logo from URL"));
    },
  });

  const wsSettingsBusy =
    workspaceMutation.isPending ||
    wsLogoMutation.isPending ||
    wsClearLogoMutation.isPending ||
    wsLogoUrlMutation.isPending;

  const workspaceLogoUrlTrimmed = workspaceLogoUrlInput.trim();
  const canApplyLogoUrl =
    workspaceLogoUrlTrimmed.length > 0 &&
    workspaceLogoUrlTrimmed !== (currentWorkspace?.logoUrl ?? "");

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be 2MB or smaller");
      return;
    }
    avatarMutation.mutate(file);
  };

  const onWorkspaceLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be 2MB or smaller");
      return;
    }
    wsLogoMutation.mutate(file);
  };

  return (
    <div className="p-6 md:p-10">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Account profile
        {canManageWorkspace || membersLoading
          ? ", workspace preferences, and task labels."
          : "."}
      </p>

      <div className="mt-8 flex flex-wrap gap-1 border-b border-neutral-200">
        <button
          type="button"
          onClick={() => setTab("account")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            tab === "account"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-neutral-800",
          )}
        >
          <User className="size-4" strokeWidth={1.5} />
          Account
        </button>
        {membersLoading && currentWorkspaceId ? (
          <span className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span className="sr-only">Loading access…</span>
          </span>
        ) : canManageWorkspace ? (
          <>
            <button
              type="button"
              onClick={() => setTab("workspace")}
              className={cn(
                "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                tab === "workspace"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-neutral-800",
              )}
            >
              <Building2 className="size-4" strokeWidth={1.5} />
              Workspace
            </button>
            <button
              type="button"
              onClick={() => setTab("labels")}
              className={cn(
                "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                tab === "labels"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-neutral-800",
              )}
            >
              <Tag className="size-4" strokeWidth={1.5} />
              Labels
            </button>
          </>
        ) : currentWorkspaceId ? (
          <p className="flex items-center px-2 py-2 text-xs text-muted-foreground">
            Workspace and label settings are only available to the workspace
            owner and admins.
          </p>
        ) : null}
      </div>

      {tab === "account" ? (
        <div className="mt-8 max-w-3xl space-y-8">
          {userLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading account…
            </p>
          ) : !user ? (
            <p className="text-sm text-muted-foreground">
              Sign in to manage your profile.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="relative">
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatarUrl}
                      alt=""
                      className="size-20 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex size-20 items-center justify-center rounded-full bg-neutral-100 text-lg font-semibold text-neutral-600">
                      {(user.fullName?.[0] ?? user.email[0] ?? "?").toUpperCase()}
                    </div>
                  )}
                  {avatarBusy ? (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70">
                      <Loader2 className="size-6 animate-spin text-neutral-600" />
                    </div>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Avatar</p>
                  <p className="text-xs text-muted-foreground">
                    Pick a preset below, or upload your own (JPEG, PNG, WebP, or
                    GIF — max 2MB; upload uses Supabase Storage on the API).
                  </p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="text-sm file:mr-3 file:rounded-lg file:border file:border-neutral-200 file:bg-white file:px-3 file:py-1.5"
                    disabled={avatarBusy}
                    onChange={onAvatarChange}
                  />
                </div>
              </div>

              <PresetAvatarPicker
                currentAvatarUrl={user.avatarUrl}
                disabled={avatarBusy}
                isPending={
                  presetAvatarMutation.isPending ||
                  clearPresetAvatarMutation.isPending
                }
                onSelectPreset={(url) => presetAvatarMutation.mutate(url)}
              />
              {user.avatarUrl ? (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-4 hover:text-neutral-800 hover:underline"
                  disabled={avatarBusy}
                  onClick={() => clearPresetAvatarMutation.mutate()}
                >
                  Remove profile photo
                </button>
              ) : null}

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  value={user.email}
                  disabled
                  className="bg-neutral-50"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="fullName" className="text-sm font-medium">
                  Display name
                </label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="bio" className="text-sm font-medium">
                  Bio
                </label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="A short bio…"
                  rows={4}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  maxLength={2000}
                />
              </div>

              <Button
                type="button"
                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={profileMutation.isPending}
                onClick={() => profileMutation.mutate()}
              >
                {profileMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save profile"
                )}
              </Button>
            </>
          )}
        </div>
      ) : null}

      {tab === "workspace" ? (
        <div className="mt-8 max-w-lg space-y-6">
          {wsLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading workspace…
            </p>
          ) : !currentWorkspaceId || !currentWorkspace ? (
            <p className="text-sm text-muted-foreground">
              Select a workspace from the top bar to edit its settings.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="relative w-full max-w-[280px]">
                  {currentWorkspace.logoUrl ? (
                    <div className="relative flex h-36 w-full items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={currentWorkspace.logoUrl}
                        alt=""
                        className="max-h-full max-w-full object-contain object-center"
                      />
                    </div>
                  ) : (
                    <div className="flex h-36 w-full items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50 text-2xl font-semibold text-neutral-500">
                      {(currentWorkspace.name?.[0] ?? "?").toUpperCase()}
                    </div>
                  )}
                  {wsLogoMutation.isPending ? (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70">
                      <Loader2 className="size-6 animate-spin text-neutral-600" />
                    </div>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Workspace logo</p>
                  <p className="text-xs text-muted-foreground">
                    Upload a file (JPEG, PNG, WebP, or GIF — max 2MB) or paste a
                    public image URL (http/https). Shown in the workspace
                    switcher; file upload uses Supabase Storage when configured.
                  </p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="text-sm file:mr-3 file:rounded-lg file:border file:border-neutral-200 file:bg-white file:px-3 file:py-1.5"
                    disabled={wsSettingsBusy}
                    onChange={onWorkspaceLogoChange}
                  />
                  <div className="space-y-2 pt-2">
                    <label
                      htmlFor="wsLogoUrl"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Image URL
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        id="wsLogoUrl"
                        type="url"
                        inputMode="url"
                        autoComplete="off"
                        placeholder="https://example.com/logo.png"
                        value={workspaceLogoUrlInput}
                        onChange={(e) => setWorkspaceLogoUrlInput(e.target.value)}
                        disabled={wsSettingsBusy}
                        className="sm:min-w-0 sm:flex-1"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        className="shrink-0 rounded-xl sm:w-auto"
                        disabled={wsSettingsBusy || !canApplyLogoUrl}
                        onClick={() =>
                          wsLogoUrlMutation.mutate(workspaceLogoUrlTrimmed)
                        }
                      >
                        {wsLogoUrlMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Applying…
                          </>
                        ) : (
                          "Use URL"
                        )}
                      </Button>
                    </div>
                  </div>
                  {currentWorkspace.logoUrl ? (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline-offset-4 hover:text-neutral-800 hover:underline"
                      disabled={wsSettingsBusy}
                      onClick={() => wsClearLogoMutation.mutate()}
                    >
                      Remove logo
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="wsName" className="text-sm font-medium">
                  Workspace name
                </label>
                <Input
                  id="wsName"
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  placeholder="Workspace name"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Slug:{" "}
                <span className="font-mono">{currentWorkspace.slug}</span>
              </p>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={
                  wsSettingsBusy ||
                  !wsName.trim() ||
                  wsName.trim() === currentWorkspace.name
                }
                onClick={() => workspaceMutation.mutate()}
              >
                {workspaceMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save workspace"
                )}
              </Button>
            </>
          )}
        </div>
      ) : null}

      {tab === "labels" ? <WorkspaceLabelsPanel /> : null}
    </div>
  );
}
