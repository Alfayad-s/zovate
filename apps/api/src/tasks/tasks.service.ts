import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CacheService } from "../cache/cache.service";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { CreateLabelDto } from "./dto/create-label.dto";
import { CreateTaskDto } from "./dto/create-task.dto";
import { CreateTaskStatusDto } from "./dto/create-task-status.dto";
import { UpdateLabelDto } from "./dto/update-label.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { UpdateTaskStatusDto } from "./dto/update-task-status.dto";

const PRIORITIES = new Set(["low", "medium", "high", "urgent"]);
const ROLES_CAN_MANAGE = new Set(["OWNER", "ADMIN"]);

const NOTIFICATION_TYPE_TASK_ASSIGNED = "TASK_ASSIGNED";
const ENTITY_TYPE_TASK = "task";

const assigneeUserSelect = {
  id: true,
  email: true,
  fullName: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

const taskInclude = {
  status: {
    select: {
      id: true,
      name: true,
      color: true,
      position: true,
    },
  },
  assignees: {
    select: {
      userId: true,
      assignedAt: true,
      user: { select: assigneeUserSelect },
    },
  },
  labels: {
    select: {
      labelId: true,
      assignedAt: true,
      label: {
        select: { id: true, name: true, color: true },
      },
    },
  },
} satisfies Prisma.TaskInclude;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly cache: CacheService,
  ) {}

  private async assertCanManageTasks(userId: string, workspaceId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      include: { workspace: { select: { deletedAt: true } } },
    });
    if (!member || member.workspace.deletedAt) {
      throw new NotFoundException("Workspace not found.");
    }
    if (!ROLES_CAN_MANAGE.has(member.role)) {
      throw new ForbiddenException(
        "Only owners and admins can manage task statuses, labels, and task assignments.",
      );
    }
  }

  private async assertWorkspaceMember(userId: string, workspaceId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      include: { workspace: { select: { deletedAt: true } } },
    });
    if (!member || member.workspace.deletedAt) {
      throw new NotFoundException("Workspace not found.");
    }
  }

  /**
   * Ensures Todo / In progress / Done exist (for workspaces created before task statuses).
   * Uses upsert so this stays idempotent if rows exist (including soft-deleted: unique is on
   * workspace + name regardless of `deletedAt`) and under concurrent calls.
   */
  async ensureDefaultTaskStatuses(workspaceId: string) {
    const ws = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: { ownerId: true },
    });
    const createdById = ws?.ownerId;
    if (!createdById) return;

    const defaults: { name: string; position: number; color: string | null }[] =
      [
        { name: "Todo", position: 0, color: "#94a3b8" },
        { name: "In progress", position: 1, color: "#fc6a08" },
        { name: "Done", position: 2, color: "#22c55e" },
      ];

    for (const d of defaults) {
      await this.prisma.taskStatus.upsert({
        where: {
          workspaceId_name: {
            workspaceId,
            name: d.name,
          },
        },
        create: {
          workspaceId,
          name: d.name,
          color: d.color,
          position: new Prisma.Decimal(d.position),
          createdById,
        },
        update: {
          deletedAt: null,
        },
      });
    }
  }

  private async getFirstStatusId(workspaceId: string): Promise<string> {
    await this.ensureDefaultTaskStatuses(workspaceId);
    const first = await this.prisma.taskStatus.findFirst({
      where: { workspaceId, deletedAt: null },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    if (!first) {
      throw new BadRequestException("No task status available for this workspace.");
    }
    return first.id;
  }

  async listTaskStatuses(workspaceId: string) {
    await this.ensureDefaultTaskStatuses(workspaceId);

    const key = `ws:${workspaceId}:statuses:list`;
    const cached = await this.cache.getJson<unknown[]>(key);
    if (cached) return cached;

    const rows = await this.prisma.taskStatus.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { position: "asc" },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        color: true,
        position: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    await this.cache.setJson(key, rows, {
      ttlSeconds: 20,
      workspaceId,
      scope: "statuses",
    });
    return rows;
  }

  async createTaskStatus(
    userId: string,
    workspaceId: string,
    dto: CreateTaskStatusDto,
  ) {
    await this.assertWorkspaceMember(userId, workspaceId);

    const position =
      dto.position !== undefined
        ? new Prisma.Decimal(dto.position)
        : await this.nextStatusPosition(workspaceId);

    const row = await this.prisma.taskStatus.create({
      data: {
        workspaceId,
        name: dto.name.trim(),
        color: dto.color?.trim() || null,
        position,
        createdById: userId,
      },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        color: true,
        position: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    this.realtime.emitWorkspace(workspaceId, ["statuses"]);
    await this.cache.invalidateWorkspace(workspaceId, ["statuses", "tasks"]);
    return row;
  }

  private async nextStatusPosition(workspaceId: string): Promise<Prisma.Decimal> {
    const agg = await this.prisma.taskStatus.aggregate({
      where: { workspaceId, deletedAt: null },
      _max: { position: true },
    });
    const max = agg._max.position;
    return max ? max.add(1) : new Prisma.Decimal(0);
  }

  async updateTaskStatus(
    userId: string,
    workspaceId: string,
    statusId: string,
    dto: UpdateTaskStatusDto,
  ) {
    await this.assertCanManageTasks(userId, workspaceId);
    await this.findTaskStatus(workspaceId, statusId);

    const data: Prisma.TaskStatusUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.color !== undefined) data.color = dto.color.trim() || null;
    if (dto.position !== undefined) {
      data.position = new Prisma.Decimal(dto.position);
    }

    if (Object.keys(data).length === 0) {
      return this.prisma.taskStatus.findFirstOrThrow({
        where: { id: statusId, workspaceId, deletedAt: null },
        select: {
          id: true,
          workspaceId: true,
          name: true,
          color: true,
          position: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    const updated = await this.prisma.taskStatus.update({
      where: { id: statusId },
      data,
      select: {
        id: true,
        workspaceId: true,
        name: true,
        color: true,
        position: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    this.realtime.emitWorkspace(workspaceId, ["statuses", "tasks"]);
    await this.cache.invalidateWorkspace(workspaceId, ["statuses", "tasks"]);
    return updated;
  }

  async removeTaskStatus(userId: string, workspaceId: string, statusId: string) {
    await this.assertCanManageTasks(userId, workspaceId);
    await this.findTaskStatus(workspaceId, statusId);

    const taskCount = await this.prisma.task.count({
      where: {
        workspaceId,
        statusId,
        deletedAt: null,
      },
    });
    if (taskCount > 0) {
      throw new ConflictException(
        "Move or reassign tasks to another status before deleting this column.",
      );
    }

    await this.prisma.taskStatus.update({
      where: { id: statusId },
      data: { deletedAt: new Date() },
    });
    this.realtime.emitWorkspace(workspaceId, ["statuses", "tasks"]);
    await this.cache.invalidateWorkspace(workspaceId, ["statuses", "tasks"]);
  }

  private async findTaskStatus(workspaceId: string, statusId: string) {
    const row = await this.prisma.taskStatus.findFirst({
      where: { id: statusId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!row) throw new NotFoundException("Task status not found.");
    return row;
  }

  async listLabels(workspaceId: string) {
    const key = `ws:${workspaceId}:labels:list`;
    const cached = await this.cache.getJson<unknown[]>(key);
    if (cached) return cached;

    const rows = await this.prisma.label.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        color: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    await this.cache.setJson(key, rows, {
      ttlSeconds: 30,
      workspaceId,
      scope: "labels",
    });
    return rows;
  }

  async createLabel(userId: string, workspaceId: string, dto: CreateLabelDto) {
    await this.assertCanManageTasks(userId, workspaceId);

    try {
      const row = await this.prisma.label.create({
        data: {
          workspaceId,
          name: dto.name.trim(),
          color: dto.color?.trim() || null,
          createdById: userId,
        },
        select: {
          id: true,
          workspaceId: true,
          name: true,
          color: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      this.realtime.emitWorkspace(workspaceId, ["labels", "tasks"]);
      await this.cache.invalidateWorkspace(workspaceId, ["labels", "tasks"]);
      return row;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("A label with this name already exists.");
      }
      throw e;
    }
  }

  async updateLabel(
    userId: string,
    workspaceId: string,
    labelId: string,
    dto: UpdateLabelDto,
  ) {
    await this.assertCanManageTasks(userId, workspaceId);
    await this.findLabel(workspaceId, labelId);

    const data: Prisma.LabelUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.color !== undefined) data.color = dto.color.trim() || null;

    if (Object.keys(data).length === 0) {
      return this.prisma.label.findFirstOrThrow({
        where: { id: labelId, workspaceId, deletedAt: null },
        select: {
          id: true,
          workspaceId: true,
          name: true,
          color: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    try {
      const row = await this.prisma.label.update({
        where: { id: labelId },
        data,
        select: {
          id: true,
          workspaceId: true,
          name: true,
          color: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      this.realtime.emitWorkspace(workspaceId, ["labels", "tasks"]);
      await this.cache.invalidateWorkspace(workspaceId, ["labels", "tasks"]);
      return row;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("A label with this name already exists.");
      }
      throw e;
    }
  }

  async removeLabel(userId: string, workspaceId: string, labelId: string) {
    await this.assertCanManageTasks(userId, workspaceId);
    await this.findLabel(workspaceId, labelId);

    await this.prisma.$transaction([
      this.prisma.taskLabel.deleteMany({ where: { labelId } }),
      this.prisma.label.update({
        where: { id: labelId },
        data: { deletedAt: new Date() },
      }),
    ]);
    this.realtime.emitWorkspace(workspaceId, ["labels", "tasks"]);
    await this.cache.invalidateWorkspace(workspaceId, ["labels", "tasks"]);
  }

  private async findLabel(workspaceId: string, labelId: string) {
    const row = await this.prisma.label.findFirst({
      where: { id: labelId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!row) throw new NotFoundException("Label not found.");
    return row;
  }

  async listTasks(
    workspaceId: string,
    opts?: {
      projectId?: string;
      statusId?: string;
      includeArchived?: boolean;
    },
  ) {
    await this.ensureDefaultTaskStatuses(workspaceId);

    const cacheKey = [
      `ws:${workspaceId}:tasks:list`,
      `project=${opts?.projectId ?? ""}`,
      `status=${opts?.statusId ?? ""}`,
      `arch=${opts?.includeArchived ? "1" : "0"}`,
    ].join("|");
    const cached = await this.cache.getJson<unknown[]>(cacheKey);
    if (cached) return cached;

    const where: Prisma.TaskWhereInput = {
      workspaceId,
      deletedAt: null,
      ...(opts?.includeArchived ? {} : { isArchived: false }),
      ...(opts?.projectId ? { projectId: opts.projectId } : {}),
      ...(opts?.statusId ? { statusId: opts.statusId } : {}),
    };

    const rows = await this.prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: [{ statusId: "asc" }, { position: "asc" }, { createdAt: "asc" }],
    });

    const ids = rows.map((t) => t.id);
    const counts = ids.length
      ? await this.prisma.comment.groupBy({
          by: ["taskId"],
          where: { workspaceId, taskId: { in: ids }, deletedAt: null },
          _count: { _all: true },
        })
      : [];
    const countByTaskId = new Map(counts.map((c) => [c.taskId, c._count._all]));
    const withCounts = rows.map((t) => ({
      ...t,
      commentsCount: countByTaskId.get(t.id) ?? 0,
    }));

    await this.cache.setJson(cacheKey, withCounts, {
      ttlSeconds: 15,
      workspaceId,
      scope: "tasks",
    });
    return withCounts;
  }

  async getTask(workspaceId: string, taskId: string) {
    const key = `ws:${workspaceId}:tasks:detail:${taskId}`;
    const cached = await this.cache.getJson<unknown>(key);
    if (cached) return cached;

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId, deletedAt: null },
      include: taskInclude,
    });
    if (!task) throw new NotFoundException("Task not found.");

    const commentsCount = await this.prisma.comment.count({
      where: { workspaceId, taskId, deletedAt: null },
    });
    const withCounts = { ...task, commentsCount };

    await this.cache.setJson(key, withCounts, {
      ttlSeconds: 30,
      workspaceId,
      scope: "tasks",
    });
    return withCounts;
  }

  async createTask(userId: string, workspaceId: string, dto: CreateTaskDto) {
    await this.assertWorkspaceMember(userId, workspaceId);

    const project = await this.prisma.project.findFirst({
      where: {
        id: dto.projectId,
        workspaceId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!project) {
      throw new BadRequestException("Project not found in this workspace.");
    }

    let statusId = dto.statusId;
    if (statusId) {
      await this.findTaskStatus(workspaceId, statusId);
    } else {
      statusId = await this.getFirstStatusId(workspaceId);
    }

    const position =
      dto.position !== undefined
        ? new Prisma.Decimal(dto.position)
        : await this.nextTaskPosition(workspaceId, statusId);

    const priority = dto.priority ?? "medium";
    if (!PRIORITIES.has(priority)) {
      throw new BadRequestException("Invalid priority.");
    }

    const assigneeIds = [...new Set(dto.assigneeUserIds ?? [])];

    const full = await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          workspaceId,
          projectId: dto.projectId,
          title: dto.title.trim(),
          description:
            dto.description !== undefined && dto.description.trim().length > 0
              ? dto.description.trim()
              : null,
          statusId,
          priority,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          position,
          createdById: userId,
        },
      });

      for (const targetUserId of assigneeIds) {
        const member = await tx.workspaceMember.findUnique({
          where: {
            userId_workspaceId: { userId: targetUserId, workspaceId },
          },
        });
        if (!member) {
          throw new BadRequestException(
            "One or more assignees are not members of this workspace.",
          );
        }

        await tx.taskAssignee.create({
          data: {
            taskId: task.id,
            userId: targetUserId,
            assignedById: userId,
          },
        });

        if (targetUserId !== userId) {
          await tx.notification.create({
            data: {
              userId: targetUserId,
              workspaceId,
              type: NOTIFICATION_TYPE_TASK_ASSIGNED,
              entityType: ENTITY_TYPE_TASK,
              entityId: task.id,
              triggeredById: userId,
              data: {
                taskTitle: task.title,
              },
            },
          });
        }
      }

      const full = await tx.task.findFirst({
        where: { id: task.id },
        include: taskInclude,
      });
      if (!full) {
        throw new NotFoundException("Task not found after create.");
      }
      return full;
    });

    this.realtime.emitWorkspace(workspaceId, ["tasks", "statuses"]);
    await this.cache.invalidateWorkspace(workspaceId, ["tasks", "statuses"]);
    for (const id of assigneeIds) {
      if (id !== userId) {
        this.realtime.emitUser(id, ["notifications"]);
      }
    }
    return full;
  }

  private async nextTaskPosition(
    workspaceId: string,
    statusId: string,
  ): Promise<Prisma.Decimal> {
    const agg = await this.prisma.task.aggregate({
      where: { workspaceId, statusId, deletedAt: null },
      _max: { position: true },
    });
    const max = agg._max.position;
    return max ? max.add(1) : new Prisma.Decimal(0);
  }

  async updateTask(
    userId: string,
    workspaceId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ) {
    await this.assertWorkspaceMember(userId, workspaceId);
    await this.getTask(workspaceId, taskId);

    const data: Prisma.TaskUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) {
      const v = dto.description.trim();
      data.description = v.length === 0 ? null : v;
    }
    if (dto.statusId !== undefined) {
      await this.findTaskStatus(workspaceId, dto.statusId);
      data.status = { connect: { id: dto.statusId } };
    }
    if (dto.priority !== undefined) {
      if (!PRIORITIES.has(dto.priority)) {
        throw new BadRequestException("Invalid priority.");
      }
      data.priority = dto.priority;
    }
    if (dto.dueDate !== undefined) {
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    if (dto.endDate !== undefined) {
      data.endDate = dto.endDate ? new Date(dto.endDate) : null;
    }
    if (dto.position !== undefined) {
      data.position = new Prisma.Decimal(dto.position);
    }
    if (dto.isArchived !== undefined) {
      data.isArchived = dto.isArchived;
    }

    if (Object.keys(data).length === 0) {
      return this.getTask(workspaceId, taskId);
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data,
      include: taskInclude,
    });
    this.realtime.emitWorkspace(workspaceId, ["tasks"]);
    await this.cache.invalidateWorkspace(workspaceId, ["tasks"]);
    return updated;
  }

  async removeTask(userId: string, workspaceId: string, taskId: string) {
    await this.assertWorkspaceMember(userId, workspaceId);
    await this.getTask(workspaceId, taskId);

    await this.prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: new Date() },
    });
    this.realtime.emitWorkspace(workspaceId, ["tasks"]);
    await this.cache.invalidateWorkspace(workspaceId, ["tasks"]);
  }

  async assignUser(
    actorId: string,
    workspaceId: string,
    taskId: string,
    targetUserId: string,
  ) {
    await this.assertWorkspaceMember(actorId, workspaceId);
    await this.getTask(workspaceId, taskId);

    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId: targetUserId, workspaceId },
      },
    });
    if (!member) {
      throw new BadRequestException("User is not a member of this workspace.");
    }

    try {
      await this.prisma.taskAssignee.create({
        data: {
          taskId,
          userId: targetUserId,
          assignedById: actorId,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("User is already assigned to this task.");
      }
      throw e;
    }

    const t = await this.getTask(workspaceId, taskId);
    this.realtime.emitWorkspace(workspaceId, ["tasks"]);
    await this.cache.invalidateWorkspace(workspaceId, ["tasks"]);
    return t;
  }

  async unassignUser(
    actorId: string,
    workspaceId: string,
    taskId: string,
    targetUserId: string,
  ) {
    await this.assertWorkspaceMember(actorId, workspaceId);
    await this.getTask(workspaceId, taskId);

    const res = await this.prisma.taskAssignee.deleteMany({
      where: { taskId, userId: targetUserId },
    });
    if (res.count === 0) {
      throw new NotFoundException("Assignee not found on this task.");
    }

    const t = await this.getTask(workspaceId, taskId);
    this.realtime.emitWorkspace(workspaceId, ["tasks"]);
    await this.cache.invalidateWorkspace(workspaceId, ["tasks"]);
    return t;
  }

  async addTaskLabel(
    actorId: string,
    workspaceId: string,
    taskId: string,
    labelId: string,
  ) {
    await this.assertWorkspaceMember(actorId, workspaceId);
    await this.getTask(workspaceId, taskId);
    await this.findLabel(workspaceId, labelId);

    try {
      await this.prisma.taskLabel.create({
        data: {
          taskId,
          labelId,
          assignedById: actorId,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("Label is already on this task.");
      }
      throw e;
    }

    const t = await this.getTask(workspaceId, taskId);
    this.realtime.emitWorkspace(workspaceId, ["tasks"]);
    await this.cache.invalidateWorkspace(workspaceId, ["tasks"]);
    return t;
  }

  async removeTaskLabel(
    actorId: string,
    workspaceId: string,
    taskId: string,
    labelId: string,
  ) {
    await this.assertWorkspaceMember(actorId, workspaceId);
    await this.getTask(workspaceId, taskId);

    const res = await this.prisma.taskLabel.deleteMany({
      where: { taskId, labelId },
    });
    if (res.count === 0) {
      throw new NotFoundException("Label not on this task.");
    }

    const t = await this.getTask(workspaceId, taskId);
    this.realtime.emitWorkspace(workspaceId, ["tasks"]);
    await this.cache.invalidateWorkspace(workspaceId, ["tasks"]);
    return t;
  }
}
