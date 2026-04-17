import { apiClient } from "@/lib/api-client";
import type { TaskListFilters } from "@/lib/query-keys";

/** Mirrors Nest `TasksService` list/get shape (JSON dates as strings). */
export type TaskUser = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
};

export type TaskStatusRef = {
  id: string;
  name: string;
  color: string | null;
  position: unknown;
};

export type TaskLabelRef = {
  id: string;
  name: string;
  color: string | null;
};

export type TaskWithRelations = {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  description: string | null;
  statusId: string;
  priority: string;
  dueDate: string | null;
  endDate: string | null;
  position: unknown;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  status: TaskStatusRef;
  assignees: {
    userId: string;
    assignedAt: string;
    user: TaskUser;
  }[];
  labels: {
    labelId: string;
    assignedAt: string;
    label: TaskLabelRef;
  }[];
  commentsCount?: number;
};

export type TaskStatusColumn = {
  id: string;
  workspaceId: string;
  name: string;
  color: string | null;
  position: unknown;
  createdAt: string;
  updatedAt: string;
};

export async function fetchTasks(
  workspaceId: string,
  filters: TaskListFilters = {},
): Promise<TaskWithRelations[]> {
  const params: Record<string, string | boolean> = {};
  if (filters.projectId) params.projectId = filters.projectId;
  if (filters.statusId) params.statusId = filters.statusId;
  if (filters.includeArchived) params.includeArchived = true;

  const { data } = await apiClient.get<TaskWithRelations[]>(
    `/workspaces/${workspaceId}/tasks`,
    Object.keys(params).length > 0 ? { params } : undefined,
  );
  return data;
}

export async function fetchTask(
  workspaceId: string,
  taskId: string,
): Promise<TaskWithRelations> {
  const { data } = await apiClient.get<TaskWithRelations>(
    `/workspaces/${workspaceId}/tasks/${taskId}`,
  );
  return data;
}

export async function fetchTaskStatuses(
  workspaceId: string,
): Promise<TaskStatusColumn[]> {
  const { data } = await apiClient.get<TaskStatusColumn[]>(
    `/workspaces/${workspaceId}/task-statuses`,
  );
  return data;
}

export async function patchTaskStatus(
  workspaceId: string,
  statusId: string,
  body: {
    name?: string;
    color?: string | null;
    position?: string;
  },
): Promise<TaskStatusColumn> {
  const { data } = await apiClient.patch<TaskStatusColumn>(
    `/workspaces/${workspaceId}/task-statuses/${statusId}`,
    body,
  );
  return data;
}

export async function createTaskStatus(
  workspaceId: string,
  body: {
    name: string;
    color?: string | null;
    /** Omit to append after the last column. */
    position?: string;
  },
): Promise<TaskStatusColumn> {
  const { data } = await apiClient.post<TaskStatusColumn>(
    `/workspaces/${workspaceId}/task-statuses`,
    body,
  );
  return data;
}

export type PatchTaskInput = {
  title?: string;
  description?: string | null;
  statusId?: string;
  priority?: string;
  dueDate?: string | null;
  endDate?: string | null;
  position?: string;
  isArchived?: boolean;
};

export async function patchTask(
  workspaceId: string,
  taskId: string,
  body: PatchTaskInput,
): Promise<TaskWithRelations> {
  const { data } = await apiClient.patch<TaskWithRelations>(
    `/workspaces/${workspaceId}/tasks/${taskId}`,
    body,
  );
  return data;
}

export async function deleteTask(
  workspaceId: string,
  taskId: string,
): Promise<void> {
  await apiClient.delete(`/workspaces/${workspaceId}/tasks/${taskId}`);
}

export async function addTaskLabel(
  workspaceId: string,
  taskId: string,
  labelId: string,
): Promise<TaskWithRelations> {
  const { data } = await apiClient.post<TaskWithRelations>(
    `/workspaces/${workspaceId}/tasks/${taskId}/labels`,
    { labelId },
  );
  return data;
}

export async function removeTaskLabel(
  workspaceId: string,
  taskId: string,
  labelId: string,
): Promise<void> {
  await apiClient.delete(
    `/workspaces/${workspaceId}/tasks/${taskId}/labels/${labelId}`,
  );
}

export type CreateTaskInput = {
  title: string;
  projectId: string;
  description?: string;
  statusId?: string;
  priority?: string;
  dueDate?: string;
  endDate?: string;
  position?: string;
  /** Workspace member user IDs to assign; each gets a notification (except self). */
  assigneeUserIds?: string[];
};

export async function createTask(
  workspaceId: string,
  body: CreateTaskInput,
): Promise<TaskWithRelations> {
  const { data } = await apiClient.post<TaskWithRelations>(
    `/workspaces/${workspaceId}/tasks`,
    body,
  );
  return data;
}
