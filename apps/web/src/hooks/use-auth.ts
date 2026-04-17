"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import {
  fetchCurrentUser,
  postLoginCredentials,
  postRegisterCredentials,
} from "@/lib/auth-api";
import { getSafeRedirectTarget } from "@/lib/auth-redirect";
import { authKeys, projectKeys, workspaceKeys } from "@/lib/query-keys";
import {
  clearStoredAccessToken,
  getStoredAccessToken,
  setStoredAccessToken,
} from "@/lib/auth-storage";
import { clearStoredProjectId } from "@/lib/project-storage";
import { clearStoredWorkspaceId } from "@/lib/workspace-storage";

export function useAuthUser() {
  return useQuery({
    queryKey: authKeys.user(),
    queryFn: async () => {
      if (!getStoredAccessToken()) return null;
      try {
        return await fetchCurrentUser();
      } catch (err) {
        if (isAxiosError(err) && err.response?.status === 401) {
          clearStoredAccessToken();
          return null;
        }
        throw err;
      }
    },
    enabled:
      typeof window !== "undefined" && Boolean(getStoredAccessToken()),
    staleTime: 5 * 60 * 1000,
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  return useMutation({
    meta: { skipGlobalErrorToast: true },
    mutationFn: ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => postLoginCredentials(email, password),
    onSuccess: (data) => {
      setStoredAccessToken(data.access_token);
      queryClient.setQueryData(authKeys.user(), data.user);
      const dest = getSafeRedirectTarget(searchParams.get("from"));
      router.replace(dest);
      router.refresh();
    },
  });
}

export function useRegisterMutation() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  return useMutation({
    meta: { skipGlobalErrorToast: true },
    mutationFn: ({
      email,
      password,
      username,
    }: {
      email: string;
      password: string;
      username?: string;
    }) => postRegisterCredentials(email, password, username),
    onSuccess: (data) => {
      setStoredAccessToken(data.access_token);
      queryClient.setQueryData(authKeys.user(), data.user);
      const dest = getSafeRedirectTarget(searchParams.get("from"));
      router.replace(dest);
      router.refresh();
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useCallback(() => {
    clearStoredAccessToken();
    clearStoredWorkspaceId();
    clearStoredProjectId();
    queryClient.removeQueries({ queryKey: authKeys.user() });
    queryClient.removeQueries({ queryKey: workspaceKeys.all });
    queryClient.removeQueries({ queryKey: projectKeys.all });
    router.push("/login");
    router.refresh();
  }, [queryClient, router]);
}
