"use client";

import { useEffect } from "react";

import { setClientAuthCookie } from "@/lib/auth-cookie";
import { AUTH_COOKIE_NAME } from "@/lib/auth-session.constants";
import { getStoredAccessToken } from "@/lib/auth-storage";

/**
 * One-time sync: older sessions may have JWT in localStorage only; middleware needs the cookie.
 */
export function AuthCookieSync() {
  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) return;
    const hasCookie = document.cookie
      .split(";")
      .some((c) => c.trim().startsWith(`${AUTH_COOKIE_NAME}=`));
    if (!hasCookie) {
      setClientAuthCookie(token);
    }
  }, []);
  return null;
}
