import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { CacheService } from "../cache/cache.service";

const commentUserSelect = {
  id: true,
  email: true,
  fullName: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class TaskCommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly cache: CacheService,
  ) {}

  private async assertTaskExists(workspaceId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!task) throw new NotFoundException("Task not found.");
  }

  async list(workspaceId: string, taskId: string) {
    await this.assertTaskExists(workspaceId, taskId);
    const key = `ws:${workspaceId}:comments:list:${taskId}`;
    const cached = await this.cache.getJson<unknown[]>(key);
    if (cached) return cached;

    const rows = await this.prisma.comment.findMany({
      where: { workspaceId, taskId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        workspaceId: true,
        taskId: true,
        userId: true,
        content: true,
        parentCommentId: true,
        createdAt: true,
        updatedAt: true,
        user: { select: commentUserSelect },
      },
    });
    await this.cache.setJson(key, rows, {
      ttlSeconds: 20,
      workspaceId,
      scope: "comments",
    });
    return rows;
  }

  async create(
    userId: string,
    workspaceId: string,
    taskId: string,
    body: { content: string; parentCommentId?: string | null },
  ) {
    await this.assertTaskExists(workspaceId, taskId);
    const parentId = body.parentCommentId ?? null;
    if (parentId) {
      const parent = await this.prisma.comment.findFirst({
        where: {
          id: parentId,
          workspaceId,
          taskId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!parent) {
        throw new NotFoundException("Parent comment not found.");
      }
    }

    const created = await this.prisma.comment.create({
      data: {
        workspaceId,
        taskId,
        userId,
        content: body.content.trim(),
        parentCommentId: parentId,
      },
      select: {
        id: true,
        workspaceId: true,
        taskId: true,
        userId: true,
        content: true,
        parentCommentId: true,
        createdAt: true,
        updatedAt: true,
        user: { select: commentUserSelect },
      },
    });
    // also invalidate tasks so clients can refresh `commentsCount` on cards
    this.realtime.emitWorkspace(workspaceId, ["comments", "tasks"]);
    await this.cache.invalidateWorkspace(workspaceId, ["comments", "tasks"]);
    return created;
  }

  async update(
    userId: string,
    workspaceId: string,
    taskId: string,
    commentId: string,
    body: { content: string },
  ) {
    await this.assertTaskExists(workspaceId, taskId);
    const existing = await this.prisma.comment.findFirst({
      where: { id: commentId, workspaceId, taskId, deletedAt: null },
      select: { id: true, userId: true },
    });
    if (!existing) throw new NotFoundException("Comment not found.");
    if (existing.userId !== userId) {
      throw new ForbiddenException("You can only edit your own comments.");
    }

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { content: body.content.trim() },
      select: {
        id: true,
        workspaceId: true,
        taskId: true,
        userId: true,
        content: true,
        parentCommentId: true,
        createdAt: true,
        updatedAt: true,
        user: { select: commentUserSelect },
      },
    });
    this.realtime.emitWorkspace(workspaceId, ["comments", "tasks"]);
    await this.cache.invalidateWorkspace(workspaceId, ["comments", "tasks"]);
    return updated;
  }

  async remove(
    userId: string,
    workspaceId: string,
    taskId: string,
    commentId: string,
  ) {
    await this.assertTaskExists(workspaceId, taskId);
    const existing = await this.prisma.comment.findFirst({
      where: { id: commentId, workspaceId, taskId, deletedAt: null },
      select: { id: true, userId: true },
    });
    if (!existing) throw new NotFoundException("Comment not found.");
    if (existing.userId !== userId) {
      throw new ForbiddenException("You can only delete your own comments.");
    }

    await this.prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
      select: { id: true },
    });
    this.realtime.emitWorkspace(workspaceId, ["comments", "tasks"]);
    await this.cache.invalidateWorkspace(workspaceId, ["comments", "tasks"]);
  }
}

