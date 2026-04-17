import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { RealtimeAuthService } from "../realtime/realtime-auth.service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

const userSelect = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  avatarUrl: true,
} as const;

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeAuth: RealtimeAuthService,
  ) {}

  async listChannelMessages(params: {
    userId: string;
    channelId: string;
    cursor?: string;
    limit: number;
  }) {
    const { userId, channelId } = params;
    if (!isUuid(channelId)) {
      throw new BadRequestException("channelId must be a UUID.");
    }
    const gate = await this.realtimeAuth.assertChannelAccess(userId, channelId);
    if (!gate.ok) {
      if (gate.error === "not_found") {
        throw new NotFoundException("Channel not found.");
      }
      throw new ForbiddenException("You do not have access to this channel.");
    }

    const take = Math.min(100, Math.max(1, params.limit));
    const takeWithExtra = take + 1;

    let anchor: { createdAt: Date; id: string } | null = null;
    if (params.cursor) {
      if (!isUuid(params.cursor)) {
        throw new BadRequestException("cursor must be a UUID.");
      }
      anchor = await this.prisma.message.findFirst({
        where: {
          id: params.cursor,
          channelId,
          deletedAt: null,
        },
        select: { createdAt: true, id: true },
      });
      if (!anchor) {
        throw new BadRequestException("Invalid cursor for this channel.");
      }
    }

    const rows = await this.prisma.message.findMany({
      where: {
        channelId,
        deletedAt: null,
        ...(anchor
          ? {
              OR: [
                { createdAt: { lt: anchor.createdAt } },
                {
                  AND: [
                    { createdAt: anchor.createdAt },
                    { id: { lt: anchor.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: takeWithExtra,
      select: {
        id: true,
        workspaceId: true,
        channelId: true,
        userId: true,
        content: true,
        attachments: true,
        linkPreview: true,
        createdAt: true,
        user: { select: userSelect },
      },
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    const chronological = [...page].reverse();

    const messages = chronological.map((m) => ({
      id: m.id,
      workspaceId: m.workspaceId,
      channelId: m.channelId,
      userId: m.userId,
      content: m.content,
      attachments: m.attachments,
      linkPreview: m.linkPreview,
      createdAt: m.createdAt.toISOString(),
      user: m.user,
    }));

    const nextCursor =
      chronological.length > 0 ? chronological[0]?.id ?? null : null;

    return { messages, nextCursor, hasMore };
  }

  async markMessageRead(params: {
    userId: string;
    channelId: string;
    messageId: string;
  }) {
    const { userId, channelId, messageId } = params;
    if (!isUuid(channelId) || !isUuid(messageId)) {
      throw new BadRequestException("channelId and messageId must be UUIDs.");
    }
    const gate = await this.realtimeAuth.assertChannelAccess(userId, channelId);
    if (!gate.ok) {
      if (gate.error === "not_found") {
        throw new NotFoundException("Channel not found.");
      }
      throw new ForbiddenException("You do not have access to this channel.");
    }

    const message = await this.prisma.message.findFirst({
      where: { id: messageId, channelId, deletedAt: null },
      select: { id: true },
    });
    if (!message) {
      throw new NotFoundException("Message not found.");
    }

    const row = await this.prisma.messageRead.upsert({
      where: {
        messageId_userId: { messageId, userId },
      },
      create: { messageId, userId },
      update: { readAt: new Date() },
      select: { readAt: true },
    });

    return {
      messageId,
      userId,
      readAt: row.readAt.toISOString(),
    };
  }
}
