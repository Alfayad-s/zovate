/** Workspace member roles (see DB `workspace_members.role`). */
export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

/** Project visibility (`projects.visibility`). */
export type ProjectVisibility = "workspace" | "private" | "public";

/** Task priority levels. */
export type TaskPriority = "low" | "medium" | "high" | "urgent";

/** Public user fields safe for API responses. */
export interface UserPublic {
  id: string;
  email: string;
  username: string | null;
  fullName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

export interface TaskSummary {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  statusId: string;
  priority: string;
  dueDate: string | null;
  position: string;
}

/** Standard API envelope for list endpoints. */
export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  total?: number;
}

/** Generic health check contract shared by web and API. */
export interface HealthStatus {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  version?: string;
}

// --- REST JSON shapes (ISO date strings) — keep aligned with Nest DTOs ---

/** `GET/POST /workspaces` */
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

/** `POST /workspaces` body */
export interface CreateWorkspaceInput {
  name: string;
  slug?: string;
  logoUrl?: string;
}

/** `GET/POST .../projects` */
export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  visibility: string;
  createdById: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

/** `POST .../projects` body */
export interface CreateProjectInput {
  name: string;
  description?: string;
  visibility?: ProjectVisibility;
  isArchived?: boolean;
}
