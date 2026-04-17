import type { CreateWorkspaceInput, Workspace } from "@repo/shared-types";

import { apiClient } from "@/lib/api-client";

export type { Workspace, CreateWorkspaceInput };

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const { data } = await apiClient.get<Workspace[]>("/workspaces");
  return data;
}

export async function createWorkspace(
  input: CreateWorkspaceInput,
): Promise<Workspace> {
  const { data } = await apiClient.post<Workspace>("/workspaces", input);
  return data;
}

export async function updateWorkspace(
  workspaceId: string,
  input: { name?: string; slug?: string; logoUrl?: string },
): Promise<Workspace> {
  const { data } = await apiClient.patch<Workspace>(
    `/workspaces/${workspaceId}`,
    input,
  );
  return data;
}

export async function uploadWorkspaceLogo(
  workspaceId: string,
  file: File,
): Promise<Workspace> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<Workspace>(
    `/workspaces/${workspaceId}/logo`,
    form,
  );
  return data;
}

export type WorkspaceMemberUser = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
};

export type WorkspaceMember = {
  id: string;
  workspaceId: string;
  userId: string;
  role: string;
  joinedAt: string;
  invitedById: string | null;
  user: WorkspaceMemberUser;
};

/** Roles allowed when inviting (API excludes OWNER). */
export type WorkspaceMemberInviteRole = "ADMIN" | "MEMBER" | "VIEWER";

export async function fetchWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMember[]> {
  const { data } = await apiClient.get<WorkspaceMember[]>(
    `/workspaces/${workspaceId}/members`,
  );
  return data;
}

export type WorkspaceInvitationSent = {
  id: string;
  workspaceId: string;
  invitedUserId: string;
  role: string;
  status: string;
  invitedById: string;
  createdAt: string;
  invitedUser: WorkspaceMemberUser;
  workspace: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
  };
};

export async function addWorkspaceMember(
  workspaceId: string,
  body: { email: string; role: WorkspaceMemberInviteRole },
): Promise<WorkspaceInvitationSent> {
  const { data } = await apiClient.post<WorkspaceInvitationSent>(
    `/workspaces/${workspaceId}/members`,
    body,
  );
  return data;
}

export async function acceptWorkspaceInvitation(
  invitationId: string,
): Promise<{ outcome: "ACCEPTED" | "REJECTED" }> {
  const { data } = await apiClient.post<{ outcome: "ACCEPTED" | "REJECTED" }>(
    `/workspaces/invitations/${invitationId}/accept`,
  );
  return data;
}

export async function rejectWorkspaceInvitation(
  invitationId: string,
): Promise<{ outcome: "ACCEPTED" | "REJECTED" }> {
  const { data } = await apiClient.post<{ outcome: "ACCEPTED" | "REJECTED" }>(
    `/workspaces/invitations/${invitationId}/reject`,
  );
  return data;
}

export type InviteUserSuggestion = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
};

export async function fetchInviteUserSuggestions(
  workspaceId: string,
  q: string,
): Promise<InviteUserSuggestion[]> {
  const { data } = await apiClient.get<InviteUserSuggestion[]>(
    `/workspaces/${workspaceId}/members/invite-suggestions`,
    { params: { q } },
  );
  return data;
}
