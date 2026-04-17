import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ChatChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ensures a default "squad" channel exists for the workspace.
   * The caller must be an active workspace member.
   */
  async getOrCreateSquadChannel(params: {
    workspaceId: string;
    userId: string;
  }): Promise<{ channelId: string; name: string }> {
    const { workspaceId, userId } = params;

    const member = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      include: { workspace: { select: { deletedAt: true } } },
    });
    if (!member || member.workspace.deletedAt) {
      throw new Error("forbidden");
    }

    const existing = await this.prisma.channel.findFirst({
      where: { workspaceId, deletedAt: null, type: "squad" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });
    if (existing) {
      return { channelId: existing.id, name: existing.name };
    }

    const created = await this.prisma.channel.create({
      data: {
        workspaceId,
        name: "Influencer Squad",
        description: "Default squad channel",
        type: "squad",
        createdById: userId,
      },
      select: { id: true, name: true },
    });

    return { channelId: created.id, name: created.name };
  }

  async renameChannel(params: {
    channelId: string;
    actorId: string;
    name: string;
  }): Promise<{
    channelId: string;
    name: string;
    oldName: string;
    actor: { id: string; email: string; fullName: string | null; avatarUrl: string | null };
  }> {
    const { channelId, actorId, name } = params;

    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, deletedAt: null },
      select: { id: true, workspaceId: true, name: true },
    });
    if (!channel) {
      throw new Error("not_found");
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: actorId, workspaceId: channel.workspaceId } },
      select: { role: true },
    });
    if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) {
      throw new Error("forbidden");
    }

    const updated = await this.prisma.channel.update({
      where: { id: channelId },
      data: { name },
      select: { id: true, name: true },
    });

    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { id: true, email: true, fullName: true, avatarUrl: true },
    });
    if (!actor) {
      throw new Error("forbidden");
    }

    return {
      channelId: updated.id,
      name: updated.name,
      oldName: channel.name,
      actor,
    };
  }
}

