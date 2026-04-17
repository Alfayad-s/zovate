import type { CreateProjectInput, Project } from "@repo/shared-types";

import { apiClient } from "@/lib/api-client";
import type { ProjectListFilters } from "@/lib/query-keys";

export type { Project, CreateProjectInput };

export async function fetchProjects(
  workspaceId: string,
  filters: ProjectListFilters = {},
): Promise<Project[]> {
  const params: Record<string, string | boolean> = {};
  if (filters.includeArchived === true) {
    params.includeArchived = true;
  }
  const q = filters.q?.trim();
  if (q) params.q = q;
  if (filters.visibility && filters.visibility !== "all") {
    params.visibility = filters.visibility;
  }
  if (filters.sortBy) params.sortBy = filters.sortBy;
  if (filters.sortOrder) params.sortOrder = filters.sortOrder;

  const { data } = await apiClient.get<Project[]>(
    `/workspaces/${workspaceId}/projects`,
    Object.keys(params).length > 0 ? { params } : undefined,
  );
  return data;
}

export async function createProject(
  workspaceId: string,
  input: CreateProjectInput,
): Promise<Project> {
  const { data } = await apiClient.post<Project>(
    `/workspaces/${workspaceId}/projects`,
    input,
  );
  return data;
}
