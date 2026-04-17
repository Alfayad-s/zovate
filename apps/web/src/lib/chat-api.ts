import { apiClient } from "@/lib/api-client";

export type SquadChannelResult = { channelId: string; name: string };

export type RenameChatChannelResult = {
  channelId: string;
  name: string;
  oldName: string;
  actor: { id: string; email: string; fullName: string | null; avatarUrl: string | null };
};

export type ChatAttachment = {
  url: string;
  name: string;
  mimeType: string;
  size: number;
  kind: "image" | "video" | "file";
};

export type OgPreview = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
};

export async function fetchOrCreateSquadChannel(params: {
  workspaceId: string;
}): Promise<SquadChannelResult> {
  const { data } = await apiClient.get<SquadChannelResult>("/chat/squad-channel", {
    params,
  });
  return data;
}

export async function fetchOgPreview(params: { url: string }): Promise<OgPreview | null> {
  const { data } = await apiClient.get<OgPreview | null>("/chat/og-preview", {
    params,
  });
  return data;
}

export async function uploadChatAttachment(params: {
  channelId: string;
  file: File;
}): Promise<ChatAttachment> {
  const form = new FormData();
  form.append("file", params.file);
  const { data } = await apiClient.post<ChatAttachment>(
    `/chat/channels/${params.channelId}/attachments`,
    form,
  );
  return data;
}

export async function renameChatChannel(params: {
  channelId: string;
  name: string;
}): Promise<RenameChatChannelResult> {
  const { data } = await apiClient.patch<RenameChatChannelResult>(
    `/chat/channels/${params.channelId}`,
    { name: params.name },
  );
  return data;
}

