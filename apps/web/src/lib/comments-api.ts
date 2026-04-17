import { apiClient } from "@/lib/api-client";

export type TaskCommentUser = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
};

export type TaskComment = {
  id: string;
  workspaceId: string;
  taskId: string;
  userId: string;
  content: string;
  parentCommentId: string | null;
  createdAt: string;
  updatedAt: string;
  user: TaskCommentUser;
};

export async function fetchTaskComments(
  workspaceId: string,
  taskId: string,
): Promise<TaskComment[]> {
  const { data } = await apiClient.get<TaskComment[]>(
    `/workspaces/${workspaceId}/tasks/${taskId}/comments`,
  );
  return data;
}

export async function createTaskComment(
  workspaceId: string,
  taskId: string,
  body: { content: string; parentCommentId?: string | null },
): Promise<TaskComment> {
  const { data } = await apiClient.post<TaskComment>(
    `/workspaces/${workspaceId}/tasks/${taskId}/comments`,
    body,
  );
  return data;
}

export async function updateTaskComment(
  workspaceId: string,
  taskId: string,
  commentId: string,
  body: { content: string },
): Promise<TaskComment> {
  const { data } = await apiClient.patch<TaskComment>(
    `/workspaces/${workspaceId}/tasks/${taskId}/comments/${commentId}`,
    body,
  );
  return data;
}

export async function deleteTaskComment(
  workspaceId: string,
  taskId: string,
  commentId: string,
): Promise<void> {
  await apiClient.delete(
    `/workspaces/${workspaceId}/tasks/${taskId}/comments/${commentId}`,
  );
}

