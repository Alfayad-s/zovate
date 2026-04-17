import { clearClientAuthCookie, setClientAuthCookie } from "./auth-cookie";

const STORAGE_KEY = "zovate_access_token";

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setStoredAccessToken(token: string): void {
  window.localStorage.setItem(STORAGE_KEY, token);
  setClientAuthCookie(token);
}

export function clearStoredAccessToken(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  clearClientAuthCookie();
}
