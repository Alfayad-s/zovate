import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

export type RealtimeAuthError = "bad_request" | "forbidden" | "not_found";

@Injectable()
export class RealtimeAuthService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active user (exists, not soft-deleted). */
  async assertSocketUser(
    userId: string,
  ): Promise<{ ok: true } | { ok: false; error: RealtimeAuthError }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      return { ok: false, error: "forbidden" };
    }
    return { ok: true };
  }

  /** User is a member of the workspace and the workspace is not deleted. */
  async assertWorkspaceMember(
    userId: string,
    workspaceId: string,
  ): Promise<{ ok: true } | { ok: false; error: RealtimeAuthError }> {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      include: { workspace: { select: { deletedAt: true } } },
    });
    if (!member || member.workspace.deletedAt) {
      return { ok: false, error: "forbidden" };
    }
    return { ok: true };
  }

  /**
   * Channel exists, is not deleted, belongs to a live workspace, and the user
   * is a workspace member. (Fine-grained channel ACL can extend here later.)
   */
  async assertChannelAccess(
    userId: string,
    channelId: string,
  ): Promise<
    { ok: true; workspaceId: string } | { ok: false; error: RealtimeAuthError }
  > {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, deletedAt: null },
      select: { id: true, workspaceId: true },
    });
    if (!channel) {
      return { ok: false, error: "not_found" };
    }
    const member = await this.assertWorkspaceMember(userId, channel.workspaceId);
    if (!member.ok) {
      return member;
    }
    return { ok: true, workspaceId: channel.workspaceId };
  }
}
