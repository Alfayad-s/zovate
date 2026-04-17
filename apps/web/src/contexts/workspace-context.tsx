"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuthUser } from "@/hooks/use-auth";
import { getStoredAccessToken } from "@/lib/auth-storage";
import { workspaceKeys } from "@/lib/query-keys";
import {
  clearStoredWorkspaceId,
  getStoredWorkspaceId,
  setStoredWorkspaceId,
} from "@/lib/workspace-storage";
import { fetchWorkspaces, type Workspace } from "@/lib/workspaces-api";

type WorkspaceContextValue = {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  currentWorkspaceId: string | null;
  setCurrentWorkspaceId: (id: string) => void;
  isLoading: boolean;
  refetchWorkspaces: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const authQuery = useAuthUser();
  const user = authQuery.data;
  const authPending = authQuery.isPending;
  const authError = authQuery.isError;

  const queryClient = useQueryClient();
  const [currentId, setCurrentId] = useState<string | null>(() =>
    typeof window !== "undefined" ? getStoredWorkspaceId() : null,
  );

  const {
    data: workspaces = [],
    isLoading,
    isPending: workspacesPending,
    isError: workspacesError,
  } = useQuery({
    queryKey: workspaceKeys.list(),
    queryFn: fetchWorkspaces,
    enabled: !!user,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    const hasToken = !!getStoredAccessToken();

    if (!hasToken) {
      setCurrentId(null);
      clearStoredWorkspaceId();
      return;
    }

    // Session still resolving — never clear persisted workspace (was wiping on refresh).
    if (authPending) {
      const stored = getStoredWorkspaceId();
      if (stored) setCurrentId(stored);
      return;
    }

    // Auth request failed (e.g. network); keep last selection.
    if (authError) {
      const stored = getStoredWorkspaceId();
      if (stored) setCurrentId(stored);
      return;
    }

    // Confirmed logged out (no user after auth finished successfully).
    if (!user) {
      setCurrentId(null);
      clearStoredWorkspaceId();
      return;
    }

    // Workspace list still loading — keep persisted id; do not clear storage.
    if (workspacesPending) {
      const stored = getStoredWorkspaceId();
      if (stored) setCurrentId(stored);
      return;
    }

    if (workspacesError) {
      const stored = getStoredWorkspaceId();
      if (stored) setCurrentId(stored);
      return;
    }

    if (!workspaces.length) {
      setCurrentId(null);
      clearStoredWorkspaceId();
      return;
    }
    const stored = getStoredWorkspaceId();
    const valid = stored && workspaces.some((w) => w.id === stored);
    const first = workspaces[0];
    if (!first) return;
    const next = valid ? stored! : first.id;
    setCurrentId(next);
    if (!valid) {
      setStoredWorkspaceId(next);
    }
  }, [
    user,
    workspaces,
    workspacesPending,
    workspacesError,
    authPending,
    authError,
  ]);

  const setCurrentWorkspaceId = useCallback(
    (id: string) => {
      setStoredWorkspaceId(id);
      setCurrentId(id);
    },
    [],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      currentWorkspace:
        workspaces.find((w) => w.id === currentId) ?? null,
      currentWorkspaceId: currentId,
      setCurrentWorkspaceId,
      isLoading: !!user && isLoading,
      refetchWorkspaces: () => {
        void queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
      },
    }),
    [workspaces, currentId, setCurrentWorkspaceId, isLoading, user, queryClient],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return ctx;
}
