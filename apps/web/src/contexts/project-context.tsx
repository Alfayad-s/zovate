"use client";

import { useQuery } from "@tanstack/react-query";
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
import { useWorkspace } from "@/contexts/workspace-context";
import { projectKeys } from "@/lib/query-keys";
import {
  clearStoredProjectId,
  getStoredProjectId,
  setStoredProjectId,
} from "@/lib/project-storage";
import { fetchProjects, type Project } from "@/lib/projects-api";

type ProjectContextValue = {
  projects: Project[];
  currentProject: Project | null;
  currentProjectId: string | null;
  setCurrentProjectId: (id: string) => void;
  isLoading: boolean;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

/** Default list query for counts / selection (matches empty filters in query-keys). */
const DEFAULT_PROJECT_FILTERS = {};

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { data: user } = useAuthUser();
  const { currentWorkspaceId } = useWorkspace();
  const [currentId, setCurrentId] = useState<string | null>(null);

  const {
    data: projects = [],
    isLoading,
  } = useQuery({
    queryKey: projectKeys.list(
      currentWorkspaceId ?? "__none__",
      DEFAULT_PROJECT_FILTERS,
    ),
    queryFn: () => fetchProjects(currentWorkspaceId!, DEFAULT_PROJECT_FILTERS),
    enabled: !!user && !!currentWorkspaceId,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (!user || !currentWorkspaceId) {
      setCurrentId(null);
      clearStoredProjectId();
      return;
    }
    if (isLoading) return;

    const stored = getStoredProjectId();
    const valid = stored && projects.some((p) => p.id === stored);
    if (valid) {
      setCurrentId(stored);
      return;
    }

    if (projects.length > 0) {
      const next = projects[0]!.id;
      setCurrentId(next);
      setStoredProjectId(next);
    } else {
      setCurrentId(null);
      clearStoredProjectId();
    }
  }, [user, currentWorkspaceId, projects, isLoading]);

  const setCurrentProjectId = useCallback((id: string) => {
    setStoredProjectId(id);
    setCurrentId(id);
  }, []);

  const value = useMemo<ProjectContextValue>(
    () => ({
      projects,
      currentProject:
        projects.find((p) => p.id === currentId) ?? null,
      currentProjectId: currentId,
      setCurrentProjectId,
      isLoading: !!user && !!currentWorkspaceId && isLoading,
    }),
    [projects, currentId, setCurrentProjectId, isLoading, user, currentWorkspaceId],
  );

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useProject must be used within ProjectProvider");
  }
  return ctx;
}
