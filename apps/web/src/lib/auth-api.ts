import { apiClient } from "./api-client";

/** Starts the server-side Google OAuth redirect (same tab). */
export function getGoogleOAuthStartUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
  const normalized = base.replace(/\/$/, "");
  const url = `${normalized}/auth/google`;

  if (typeof window !== "undefined") {
    try {
      const apiOrigin = new URL(normalized).origin;
      if (apiOrigin === window.location.origin) {
        console.error(
          "[auth] NEXT_PUBLIC_API_URL must point to the Nest API (e.g. http://localhost:4000/api), not the Next.js app. Google sign-in will not work.",
        );
      }
    } catch {
      /* ignore invalid URL */
    }
  }

  return url;
}

export type AuthUser = {
  id: string;
  email: string;
  username: string | null;
  fullName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
};

export type AuthTokensResponse = {
  access_token: string;
  user: AuthUser;
};

export async function postLoginCredentials(
  email: string,
  password: string,
): Promise<AuthTokensResponse> {
  const { data } = await apiClient.post<AuthTokensResponse>("/auth/login", {
    email,
    password,
  });
  return data;
}

export async function postRegisterCredentials(
  email: string,
  password: string,
  username?: string,
): Promise<AuthTokensResponse> {
  const { data } = await apiClient.post<AuthTokensResponse>("/auth/register", {
    email,
    password,
    ...(username?.trim() ? { username: username.trim() } : {}),
  });
  return data;
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const { data } = await apiClient.get<{ user: AuthUser }>("/auth/me");
  return data.user;
}

export async function patchProfile(input: {
  fullName?: string;
  bio?: string;
  /** Full URL to a preset under /avatars/Pop-out/ on this app, or "" to clear */
  avatarUrl?: string;
}): Promise<AuthUser> {
  const { data } = await apiClient.patch<{ user: AuthUser }>(
    "/auth/me",
    input,
  );
  return data.user;
}

export async function uploadAvatar(file: File): Promise<AuthUser> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<{ user: AuthUser }>(
    "/auth/me/avatar",
    form,
  );
  return data.user;
}
