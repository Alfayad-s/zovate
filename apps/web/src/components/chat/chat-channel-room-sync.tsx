"use client";

import { useCallback, useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

import { useAuthUser } from "@/hooks/use-auth";
import { getApiOrigin } from "@/lib/api-origin";
import { getStoredAccessToken } from "@/lib/auth-storage";
import type { ChatNewMessagePayload } from "@/lib/messages-api";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string) {
  return UUID_RE.test(s);
}

type JoinChannelAck =
  | { ok: true; workspaceId: string }
  | { ok: false; error: string };

export type PresenceUpdatePayload = {
  channelId: string;
  onlineUserIds: string[];
};

export type UserTypingPayload = {
  channelId: string;
  userId: string;
  typing: boolean;
};

export type MessageReadPayload = {
  messageId: string;
  userId: string;
  readAt: string;
};

export type ChannelRenamedPayload = {
  channelId: string;
  name: string;
  oldName: string;
  actor: { id: string; email: string; fullName: string | null; avatarUrl: string | null };
};

/**
 * `/chat` namespace: joins `channel:{id}` when `open` and `channelId` are set,
 * leaves when the panel closes or `channelId` changes, and cleans up on unmount.
 */
export function ChatChannelRoomSync({
  open,
  channelId,
  onChatSocket,
  onNewMessage,
  onPresenceUpdate,
  onUserTyping,
  onMessageRead,
  onChannelRenamed,
}: {
  open: boolean;
  channelId: string | null | undefined;
  onChatSocket?: (socket: Socket | null) => void;
  onNewMessage?: (payload: ChatNewMessagePayload) => void;
  onPresenceUpdate?: (payload: PresenceUpdatePayload) => void;
  onUserTyping?: (payload: UserTypingPayload) => void;
  onMessageRead?: (payload: MessageReadPayload) => void;
  onChannelRenamed?: (payload: ChannelRenamedPayload) => void;
}) {
  const { data: user } = useAuthUser();
  const socketRef = useRef<Socket | null>(null);
  const joinedChannelRef = useRef<string | null>(null);
  const openRef = useRef(open);
  const channelIdRef = useRef<string | null>(null);
  const onChatSocketRef = useRef(onChatSocket);
  const onNewMessageRef = useRef(onNewMessage);
  const onPresenceUpdateRef = useRef(onPresenceUpdate);
  const onUserTypingRef = useRef(onUserTyping);
  const onMessageReadRef = useRef(onMessageRead);
  const onChannelRenamedRef = useRef(onChannelRenamed);

  openRef.current = open;
  onChatSocketRef.current = onChatSocket;
  onNewMessageRef.current = onNewMessage;
  onPresenceUpdateRef.current = onPresenceUpdate;
  onUserTypingRef.current = onUserTyping;
  onMessageReadRef.current = onMessageRead;
  onChannelRenamedRef.current = onChannelRenamed;
  const trimmed = channelId?.trim();
  channelIdRef.current = trimmed && isUuid(trimmed) ? trimmed : null;

  const applyChannelRoom = useCallback((socket: Socket) => {
    const isOpen = openRef.current;
    const ch = channelIdRef.current;
    if (!isOpen || !ch) {
      if (joinedChannelRef.current) {
        socket.emit("leaveChannel", { channelId: joinedChannelRef.current });
        joinedChannelRef.current = null;
      }
      return;
    }
    if (joinedChannelRef.current === ch) {
      return;
    }
    if (joinedChannelRef.current) {
      socket.emit("leaveChannel", { channelId: joinedChannelRef.current });
    }
    joinedChannelRef.current = ch;
    socket.emit(
      "joinChannel",
      { channelId: ch },
      (ack: JoinChannelAck | undefined) => {
        if (ack && ack.ok === false) {
          joinedChannelRef.current = null;
        }
      },
    );
  }, []);

  useEffect(() => {
    if (!user) {
      if (joinedChannelRef.current && socketRef.current?.connected) {
        socketRef.current.emit("leaveChannel", {
          channelId: joinedChannelRef.current,
        });
      }
      joinedChannelRef.current = null;
      socketRef.current?.disconnect();
      socketRef.current = null;
      onChatSocketRef.current?.(null);
      return;
    }
    const token = getStoredAccessToken();
    if (!token) return;

    const socket = io(`${getApiOrigin()}/chat`, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    socketRef.current = socket;
    onChatSocketRef.current?.(socket);

    const onConnect = () => {
      applyChannelRoom(socket);
    };

    const onNew = (payload: ChatNewMessagePayload) => {
      onNewMessageRef.current?.(payload);
    };

    const onPresence = (payload: PresenceUpdatePayload) => {
      onPresenceUpdateRef.current?.(payload);
    };

    const onTyping = (payload: UserTypingPayload) => {
      onUserTypingRef.current?.(payload);
    };

    const onRead = (payload: MessageReadPayload) => {
      onMessageReadRef.current?.(payload);
    };

    const onRenamed = (payload: ChannelRenamedPayload) => {
      onChannelRenamedRef.current?.(payload);
    };

    socket.on("connect", onConnect);
    socket.on("new_message", onNew);
    socket.on("presence_update", onPresence);
    socket.on("user_typing", onTyping);
    socket.on("message_read", onRead);
    socket.on("channel_renamed", onRenamed);
    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("new_message", onNew);
      socket.off("presence_update", onPresence);
      socket.off("user_typing", onTyping);
      socket.off("message_read", onRead);
      socket.off("channel_renamed", onRenamed);
      if (joinedChannelRef.current) {
        socket.emit("leaveChannel", { channelId: joinedChannelRef.current });
      }
      joinedChannelRef.current = null;
      socket.disconnect();
      socketRef.current = null;
      onChatSocketRef.current?.(null);
    };
  }, [user, applyChannelRoom]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!user || !socket?.connected) return;
    applyChannelRoom(socket);
  }, [user, open, channelId, applyChannelRoom]);

  return null;
}
