import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import type { OgPreview } from "./chat-og-preview.service";

@Injectable()
export class ChatMessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async createChannelMessage(params: {
    workspaceId: string;
    channelId: string;
    userId: string;
    content: string;
    attachments?: unknown;
    linkPreview?: OgPreview | null;
  }) {
    return this.prisma.message.create({
      data: {
        workspaceId: params.workspaceId,
        channelId: params.channelId,
        userId: params.userId,
        content: params.content,
        attachments: params.attachments ?? undefined,
        linkPreview: params.linkPreview ?? undefined,
      },
      select: {
        id: true,
        workspaceId: true,
        channelId: true,
        userId: true,
        content: true,
        attachments: true,
        linkPreview: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }
}
