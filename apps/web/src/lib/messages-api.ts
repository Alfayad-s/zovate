import axios from "axios";

import { apiClient } from "./api-client";

export type ChannelMessageUser = {
  id: string;
  email: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
};

export type ChannelMessageDto = {
  id: string;
  workspaceId: string;
  channelId: string;
  userId: string;
  content: string;
  attachments?: {
    url: string;
    name: string;
    mimeType: string;
    size: number;
    kind: "image" | "video" | "file";
  }[] | null;
  linkPreview?: {
    url: string;
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
  } | null;
  createdAt: string;
  user: ChannelMessageUser;
};

export type ChannelMessagesPage = {
  messages: ChannelMessageDto[];
  nextCursor: string | null;
  hasMore: boolean;
};

/** Matches `new_message` / `send_message` ack payload from `/chat`. */
export type ChatNewMessagePayload = ChannelMessageDto;

export type MarkMessageReadResult = {
  messageId: string;
  userId: string;
  readAt: string;
};

export async function postMarkMessageRead(params: {
  channelId: string;
  messageId: string;
}): Promise<MarkMessageReadResult> {
  const { data } = await apiClient.post<MarkMessageReadResult>(
    "/messages/read",
    params,
  );
  return data;
}

export async function fetchChannelMessages(params: {
  channelId: string;
  cursor?: string;
  limit?: number;
}): Promise<ChannelMessagesPage> {
  const { channelId, cursor, limit = 30 } = params;
  const { data } = await apiClient.get<ChannelMessagesPage>("/messages", {
    params: {
      channelId,
      ...(cursor ? { cursor } : {}),
      limit,
    },
  });
  return data;
}

export function getMessagesErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg =
      (err.response?.data as { message?: string | string[] })?.message;
    if (Array.isArray(msg)) return msg.join(", ");
    if (typeof msg === "string") return msg;
    return err.response?.statusText || err.message;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
