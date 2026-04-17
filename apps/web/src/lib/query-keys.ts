export const authKeys = {
  all: ["auth"] as const,
  user: () => [...authKeys.all, "user"] as const,
};

export const notificationKeys = {
  all: ["notifications"] as const,
  list: () => [...notificationKeys.all, "list"] as const,
};

export const workspaceKeys = {
  all: ["workspaces"] as const,
  list: () => [...workspaceKeys.all, "list"] as const,
  members: (workspaceId: string) =>
    [...workspaceKeys.all, "members", workspaceId] as const,
  inviteSuggestions: (workspaceId: string, q: string) =>
    [...workspaceKeys.all, "invite-suggestions", workspaceId, q] as const,
};

export type ProjectListFilters = {
  q?: string;
  visibility?: "all" | "workspace" | "private" | "public";
  includeArchived?: boolean;
  sortBy?: "updatedAt" | "name";
  sortOrder?: "asc" | "desc";
};

export const projectKeys = {
  all: ["projects"] as const,
  list: (workspaceId: string, filters: ProjectListFilters = {}) =>
    [
      ...projectKeys.all,
      "list",
      workspaceId,
      filters.q ?? "",
      filters.visibility ?? "all",
      filters.includeArchived ?? false,
      filters.sortBy ?? "updatedAt",
      filters.sortOrder ?? "desc",
    ] as const,
};

export type TaskListFilters = {
  projectId?: string;
  statusId?: string;
  includeArchived?: boolean;
};

export const taskKeys = {
  all: ["tasks"] as const,
  list: (workspaceId: string, filters: TaskListFilters = {}) =>
    [
      ...taskKeys.all,
      "list",
      workspaceId,
      filters.projectId ?? "",
      filters.statusId ?? "",
      filters.includeArchived ?? false,
    ] as const,
  detail: (workspaceId: string, taskId: string) =>
    [...taskKeys.all, "detail", workspaceId, taskId] as const,
  statuses: (workspaceId: string) =>
    [...taskKeys.all, "statuses", workspaceId] as const,
};

export const commentKeys = {
  all: ["comments"] as const,
  list: (workspaceId: string, taskId: string) =>
    [...commentKeys.all, "list", workspaceId, taskId] as const,
};

export const labelKeys = {
  all: ["labels"] as const,
  list: (workspaceId: string) =>
    [...labelKeys.all, "list", workspaceId] as const,
};
