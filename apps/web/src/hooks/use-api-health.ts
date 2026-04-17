"use client";

import type { HealthStatus } from "@repo/shared-types";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";

export function useApiHealth() {
  return useQuery({
    queryKey: ["health", "auth"],
    queryFn: async () => {
      const { data } = await apiClient.get<HealthStatus>("/auth/health");
      return data;
    },
  });
}
