"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { notificationKeys, workspaceKeys } from "@/lib/query-keys";
import {
  addWorkspaceMember,
  fetchInviteUserSuggestions,
  type InviteUserSuggestion,
  type WorkspaceMemberInviteRole,
} from "@/lib/workspaces-api";

const ROLE_OPTIONS: { value: WorkspaceMemberInviteRole; label: string }[] = [
  { value: "MEMBER", label: "Member" },
  { value: "VIEWER", label: "Viewer" },
  { value: "ADMIN", label: "Admin" },
];

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function SuggestionRow({
  user,
  onPick,
}: {
  user: InviteUserSuggestion;
  onPick: (u: InviteUserSuggestion) => void;
}) {
  const label = user.fullName?.trim() || user.email;
  const initial = (user.fullName?.[0] ?? user.email[0] ?? "?").toUpperCase();
  return (
    <button
      type="button"
      role="option"
      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-neutral-100"
      onMouseDown={(e) => {
        e.preventDefault();
        onPick(user);
      }}
    >
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatarUrl}
          alt=""
          className="size-8 shrink-0 rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-700">
          {initial}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-neutral-900">
          {label}
        </span>
        <span className="block truncate text-xs text-neutral-500">
          {user.email}
        </span>
      </span>
    </button>
  );
}

export function InviteWorkspaceMembersDialog({
  open,
  onOpenChange,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | null;
}) {
  const queryClient = useQueryClient();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceMemberInviteRole>("MEMBER");
  const [listOpen, setListOpen] = useState(true);

  const trimmedInput = email.trim();
  const debouncedSearch = useDebouncedValue(trimmedInput, 320);
  const canSearch =
    open &&
    !!workspaceId &&
    debouncedSearch.length >= 2;

  const waitingForDebounce =
    trimmedInput.length >= 2 && debouncedSearch !== trimmedInput;

  const {
    data: suggestions = [],
    isFetching,
    isSuccess,
  } = useQuery({
    queryKey: workspaceKeys.inviteSuggestions(
      workspaceId ?? "__none__",
      debouncedSearch,
    ),
    queryFn: () =>
      fetchInviteUserSuggestions(workspaceId!, debouncedSearch),
    enabled: canSearch,
  });

  useEffect(() => {
    if (!open) {
      setEmail("");
      setRole("MEMBER");
      setListOpen(true);
    }
  }, [open]);

  useEffect(() => {
    setListOpen(true);
  }, [email]);

  const typedLenOk = trimmedInput.length >= 2;

  const showLoading =
    typedLenOk && listOpen && (isFetching || waitingForDebounce);

  const showNoMatch =
    typedLenOk &&
    listOpen &&
    !showLoading &&
    canSearch &&
    isSuccess &&
    suggestions.length === 0;

  const showSuggestions =
    typedLenOk &&
    listOpen &&
    !showLoading &&
    canSearch &&
    suggestions.length > 0;

  const showPanel =
    listOpen && typedLenOk && (showLoading || showNoMatch || showSuggestions);

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("No workspace selected");
      return addWorkspaceMember(workspaceId, {
        email: email.trim(),
        role,
      });
    },
    onSuccess: () => {
      toast.success(
        "Invitation sent. They will get a notification to accept.",
      );
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: workspaceKeys.members(workspaceId),
        });
      }
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast.error(
        getAuthErrorMessage(err, "Could not add member. Try again."),
      );
    },
  });

  const disabled =
    !workspaceId || !email.trim() || inviteMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-visible sm:max-w-md" showClose>
        <DialogHeader>
          <DialogTitle>Invite to workspace</DialogTitle>
          <DialogDescription>
            Search by email or name. Only people who already have a Zovate
            account can be added. Members can collaborate; viewers are
            read-only; admins can manage the workspace and members.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!disabled) inviteMutation.mutate();
          }}
        >
          <div className="relative flex flex-col gap-2">
            <Label htmlFor="invite-email">Email or name</Label>
            <Input
              ref={inputRef}
              id="invite-email"
              type="search"
              autoComplete="off"
              placeholder="Start typing an email or name…"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setListOpen(true)}
              aria-autocomplete="list"
              aria-controls={listId}
              aria-expanded={showPanel}
              className="rounded-xl"
            />
            {showPanel ? (
              <div
                id={listId}
                role="listbox"
                className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
              >
                {showLoading ? (
                  <div className="flex items-center gap-2 px-3 py-3 text-sm text-neutral-500">
                    <Loader2
                      className="size-4 shrink-0 animate-spin"
                      aria-hidden
                    />
                    Searching…
                  </div>
                ) : null}
                {showSuggestions
                  ? suggestions.map((u) => (
                      <SuggestionRow
                        key={u.id}
                        user={u}
                        onPick={(picked) => {
                          setEmail(picked.email);
                          setListOpen(false);
                          inputRef.current?.blur();
                        }}
                      />
                    ))
                  : null}
                {showNoMatch ? (
                  <p className="px-3 py-3 text-sm leading-relaxed text-neutral-600">
                    No account matches that search. They need to{" "}
                    <span className="font-medium text-neutral-800">
                      register for Zovate first
                    </span>
                    , then you can add them here.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-role">Role</Label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) =>
                setRole(e.target.value as WorkspaceMemberInviteRole)
              }
              className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="rounded-xl"
              disabled={disabled}
            >
              {inviteMutation.isPending ? "Adding…" : "Add member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
