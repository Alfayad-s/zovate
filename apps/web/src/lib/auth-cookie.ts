import {
  AUTH_COOKIE_MAX_AGE_SECONDS,
  AUTH_COOKIE_NAME,
} from "@/lib/auth-session.constants";

/** Sets a non-HttpOnly cookie so Edge middleware can read the session (same threat model as localStorage JWT). */
export function setClientAuthCookie(token: string): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof process !== "undefined" && process.env.NODE_ENV === "production"
      ? "; Secure"
      : "";
  const value = encodeURIComponent(token);
  document.cookie = `${AUTH_COOKIE_NAME}=${value}; Path=/; Max-Age=${AUTH_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function clearClientAuthCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}
