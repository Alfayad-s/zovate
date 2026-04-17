/**
 * Live updates use the API WebSocket (`WorkspaceRealtimeBridge`). These options
 * keep window-focus refetch; interval polling is disabled to avoid duplicate traffic.
 */
export const workspaceLiveQueryOptions = {
  refetchInterval: false as const,
  refetchOnWindowFocus: true,
} as const;
