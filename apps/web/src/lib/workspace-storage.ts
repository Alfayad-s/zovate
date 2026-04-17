const STORAGE_KEY = "zovate_current_workspace_id";

export function getStoredWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setStoredWorkspaceId(id: string): void {
  window.localStorage.setItem(STORAGE_KEY, id);
}

export function clearStoredWorkspaceId(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
