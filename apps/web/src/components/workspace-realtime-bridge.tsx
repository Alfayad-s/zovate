"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

import { useWorkspace } from "@/contexts/workspace-context";
import { useAuthUser } from "@/hooks/use-auth";
import { getApiOrigin } from "@/lib/api-origin";
import { getStoredAccessToken } from "@/lib/auth-storage";
import {
  commentKeys,
  labelKeys,
  notificationKeys,
  taskKeys,
  workspaceKeys,
} from "@/lib/query-keys";

function applyInvalidate(
  qc: ReturnType<typeof useQueryClient>,
  workspaceId: string | null,
  scopes: string[],
) {
  if (
    scopes.includes("tasks") ||
    scopes.includes("statuses") ||
    scopes.includes("labels") ||
    scopes.includes("comments")
  ) {
    void qc.invalidateQueries({ queryKey: taskKeys.all });
  }
  if (scopes.includes("comments") && workspaceId) {
    void qc.invalidateQueries({ queryKey: commentKeys.all });
  }
  if (scopes.includes("labels")) {
    void qc.invalidateQueries({ queryKey: labelKeys.all });
  }
  if (scopes.includes("notifications")) {
    void qc.invalidateQueries({ queryKey: notificationKeys.all });
  }
  if (scopes.includes("members") && workspaceId) {
    void qc.invalidateQueries({
      queryKey: workspaceKeys.members(workspaceId),
    });
  }
}

/**
 * Socket.IO connection to the API `/realtime` namespace: joins the current
 * workspace room and invalidates React Query caches on `invalidate` events.
 */
export function WorkspaceRealtimeBridge() {
  const qc = useQueryClient();
  const { data: user } = useAuthUser();
  const { currentWorkspaceId } = useWorkspace();
  const socketRef = useRef<Socket | null>(null);
  const joinedWsRef = useRef<string | null>(null);
  const workspaceIdRef = useRef(currentWorkspaceId);
  workspaceIdRef.current = currentWorkspaceId;

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      joinedWsRef.current = null;
      return;
    }
    const token = getStoredAccessToken();
    if (!token) return;

    const socket = io(`${getApiOrigin()}/realtime`, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    socketRef.current = socket;

    const onInvalidate = (payload: { scopes?: string[] }) => {
      applyInvalidate(qc, workspaceIdRef.current, payload?.scopes ?? []);
    };

    const onConnect = () => {
      const prev = joinedWsRef.current;
      const cur = workspaceIdRef.current;
      if (prev && prev !== cur) {
        socket.emit("leaveWorkspace", { workspaceId: prev });
      }
      joinedWsRef.current = cur;
      if (cur) {
        socket.emit("joinWorkspace", { workspaceId: cur });
      }
    };

    socket.on("invalidate", onInvalidate);
    socket.on("connect", onConnect);
    if (socket.connected) onConnect();

    return () => {
      socket.off("invalidate", onInvalidate);
      socket.off("connect", onConnect);
      socket.disconnect();
      socketRef.current = null;
      joinedWsRef.current = null;
    };
  }, [user, qc]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!user || !socket?.connected) return;

    const prev = joinedWsRef.current;
    const cur = currentWorkspaceId;
    if (prev === cur) return;

    if (prev) {
      socket.emit("leaveWorkspace", { workspaceId: prev });
    }
    joinedWsRef.current = cur;
    if (cur) {
      socket.emit("joinWorkspace", { workspaceId: cur });
    }
  }, [user, currentWorkspaceId]);

  return null;
}
