const STORAGE_KEY = "zovate_current_project_id";

export function getStoredProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setStoredProjectId(id: string): void {
  window.localStorage.setItem(STORAGE_KEY, id);
}

export function clearStoredProjectId(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
