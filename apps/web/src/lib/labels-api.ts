import { apiClient } from "@/lib/api-client";

export type WorkspaceLabel = {
  id: string;
  workspaceId: string;
  name: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function fetchLabels(
  workspaceId: string,
): Promise<WorkspaceLabel[]> {
  const { data } = await apiClient.get<WorkspaceLabel[]>(
    `/workspaces/${workspaceId}/labels`,
  );
  return data;
}

export async function createLabel(
  workspaceId: string,
  body: { name: string; color?: string | null },
): Promise<WorkspaceLabel> {
  const payload: { name: string; color?: string } = {
    name: body.name.trim(),
  };
  const c = body.color?.trim();
  if (c) payload.color = c;

  const { data } = await apiClient.post<WorkspaceLabel>(
    `/workspaces/${workspaceId}/labels`,
    payload,
  );
  return data;
}

export async function updateLabel(
  workspaceId: string,
  labelId: string,
  body: { name?: string; color?: string | null },
): Promise<WorkspaceLabel> {
  const payload: { name?: string; color?: string | null } = {};
  if (body.name !== undefined) payload.name = body.name.trim();
  if (body.color !== undefined) {
    const c = body.color?.trim();
    payload.color = c || null;
  }

  const { data } = await apiClient.patch<WorkspaceLabel>(
    `/workspaces/${workspaceId}/labels/${labelId}`,
    payload,
  );
  return data;
}

export async function deleteLabel(
  workspaceId: string,
  labelId: string,
): Promise<void> {
  await apiClient.delete(`/workspaces/${workspaceId}/labels/${labelId}`);
}
