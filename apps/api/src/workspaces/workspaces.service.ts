import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { SupabaseStorageService } from "../storage/supabase-storage.service";
import { CacheService } from "../cache/cache.service";
import { AddWorkspaceMemberDto } from "./dto/add-workspace-member.dto";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";
import { UpdateWorkspaceDto } from "./dto/update-workspace.dto";

const ROLE_OWNER = "OWNER";
const ROLES_CAN_MANAGE = new Set(["OWNER", "ADMIN"]);

const INVITATION_PENDING = "PENDING";
const INVITATION_ACCEPTED = "ACCEPTED";
const INVITATION_REJECTED = "REJECTED";

const ENTITY_WORKSPACE_INVITATION = "workspace_invitation";
const NOTIFICATION_TYPE_WORKSPACE_INVITE = "WORKSPACE_INVITE";

function assertHttpOrHttpsUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException("Logo URL must be a valid http or https URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new BadRequestException("Logo URL must use http or https.");
  }
}

function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.length > 0 ? s : "workspace";
}

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: SupabaseStorageService,
    private readonly realtime: RealtimeService,
    private readonly cache: CacheService,
  ) {}

  private workspaceSelect(): Prisma.WorkspaceSelect {
    return {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      ownerId: true,
      createdAt: true,
      updatedAt: true,
    };
  }

  async create(userId: string, dto: CreateWorkspaceDto) {
    const baseSlug = dto.slug?.trim() ? slugify(dto.slug) : slugify(dto.name);
    const slug = await this.ensureUniqueSlug(baseSlug);

    try {
      return await this.prisma.$transaction(async (tx) => {
        let logoUrl: string | null = null;
        if (dto.logoUrl?.trim()) {
          const v = dto.logoUrl.trim();
          assertHttpOrHttpsUrl(v);
          logoUrl = v;
        }

        const workspace = await tx.workspace.create({
          data: {
            name: dto.name.trim(),
            slug,
            ownerId: userId,
            logoUrl,
          },
          select: this.workspaceSelect(),
        });

        await tx.workspaceMember.create({
          data: {
            userId,
            workspaceId: workspace.id,
            role: ROLE_OWNER,
          },
        });

        const defaultStatuses: {
          name: string;
          position: number;
          color: string | null;
        }[] = [
          { name: "Todo", position: 0, color: "#94a3b8" },
          { name: "In progress", position: 1, color: "#fc6a08" },
          { name: "Done", position: 2, color: "#22c55e" },
        ];
        for (const d of defaultStatuses) {
          await tx.taskStatus.create({
            data: {
              workspaceId: workspace.id,
              name: d.name,
              color: d.color,
              position: new Prisma.Decimal(d.position),
              createdById: userId,
            },
          });
        }

        return workspace;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("A workspace with this slug already exists.");
      }
      throw e;
    }
  }

  async findAllForUser(userId: string) {
    return this.prisma.workspace.findMany({
      where: {
        deletedAt: null,
        members: { some: { userId } },
      },
      orderBy: { updatedAt: "desc" },
      select: this.workspaceSelect(),
    });
  }

  async findOne(userId: string, workspaceId: string) {
    const ws = await this.prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        deletedAt: null,
        members: { some: { userId } },
      },
      select: this.workspaceSelect(),
    });
    if (!ws) {
      throw new NotFoundException("Workspace not found.");
    }
    return ws;
  }

  async update(userId: string, workspaceId: string, dto: UpdateWorkspaceDto) {
    await this.assertCanManage(userId, workspaceId);

    const data: Prisma.WorkspaceUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.slug !== undefined) {
      const next = slugify(dto.slug);
      const existing = await this.prisma.workspace.findFirst({
        where: {
          slug: next,
          deletedAt: null,
          NOT: { id: workspaceId },
        },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException("This slug is already in use.");
      }
      data.slug = next;
    }
    if (dto.logoUrl !== undefined) {
      const v = dto.logoUrl.trim();
      if (v.length === 0) {
        data.logoUrl = null;
      } else {
        assertHttpOrHttpsUrl(v);
        data.logoUrl = v;
      }
    }

    if (Object.keys(data).length === 0) {
      return this.findOne(userId, workspaceId);
    }

    try {
      return await this.prisma.workspace.update({
        where: { id: workspaceId },
        data,
        select: this.workspaceSelect(),
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("A workspace with this slug already exists.");
      }
      throw e;
    }
  }

  async setLogoFromUpload(
    userId: string,
    workspaceId: string,
    buffer: Buffer,
    mimeType: string,
  ) {
    await this.assertCanManage(userId, workspaceId);
    const logoUrl = await this.storage.uploadWorkspaceLogoObject(
      workspaceId,
      buffer,
      mimeType,
    );
    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { logoUrl },
      select: this.workspaceSelect(),
    });
  }

  async listMembers(actorId: string, workspaceId: string) {
    await this.assertIsMember(actorId, workspaceId);

    const key = `ws:${workspaceId}:members:list`;
    const cached = await this.cache.getJson<
      {
        id: string;
        workspaceId: string;
        userId: string;
        role: string;
        joinedAt: Date;
        invitedById: string | null;
        user: {
          id: string;
          email: string;
          fullName: string | null;
          avatarUrl: string | null;
        };
      }[]
    >(key);
    if (cached) return cached;

    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    const out = members.map((m) => ({
      id: m.id,
      workspaceId: m.workspaceId,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      invitedById: m.invitedById,
      user: m.user,
    }));
    await this.cache.setJson(key, out, {
      ttlSeconds: 30,
      workspaceId,
      scope: "members",
    });
    return out;
  }

  /**
   * Typeahead for inviting users: owner/admin only. Excludes existing members.
   */
  async searchUsersForInvite(
    actorId: string,
    workspaceId: string,
    rawQuery: string,
  ): Promise<
    { id: string; email: string; fullName: string | null; avatarUrl: string | null }[]
  > {
    await this.assertCanManage(actorId, workspaceId);

    const q = rawQuery.trim().slice(0, 120);
    if (q.length < 2) {
      return [];
    }

    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: { userId: true },
    });
    const pendingInv = await this.prisma.workspaceInvitation.findMany({
      where: { workspaceId, status: INVITATION_PENDING },
      select: { invitedUserId: true },
    });
    const excludeIds = [
      ...members.map((m) => m.userId),
      ...pendingInv.map((p) => p.invitedUserId),
    ];

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { fullName: { contains: q, mode: "insensitive" } },
        { username: { contains: q, mode: "insensitive" } },
      ],
    };
    if (excludeIds.length > 0) {
      where.id = { notIn: [...new Set(excludeIds)] };
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
      },
      take: 12,
      orderBy: [{ email: "asc" }],
    });

    return users;
  }

  /**
   * Sends a workspace invitation (notification). Membership is created when the invitee accepts.
   */
  async addMember(actorId: string, workspaceId: string, dto: AddWorkspaceMemberDto) {
    await this.assertCanManage(actorId, workspaceId);

    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: { id: true, name: true, slug: true, logoUrl: true },
    });
    if (!workspace) {
      throw new NotFoundException("Workspace not found.");
    }

    const email = dto.email.trim().toLowerCase();
    const userToAdd = await this.prisma.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        deletedAt: null,
      },
      select: { id: true, email: true, fullName: true, avatarUrl: true },
    });

    if (!userToAdd) {
      throw new NotFoundException("No user found with that email.");
    }

    const existingMember = await this.prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId: userToAdd.id, workspaceId },
      },
    });
    if (existingMember) {
      throw new ConflictException("This user is already a member of the workspace.");
    }

    const existingInv = await this.prisma.workspaceInvitation.findUnique({
      where: {
        workspaceId_invitedUserId: {
          workspaceId,
          invitedUserId: userToAdd.id,
        },
      },
    });

    if (existingInv?.status === INVITATION_PENDING) {
      throw new ConflictException(
        "An invitation is already pending for this user.",
      );
    }

    let invitation;
    if (existingInv) {
      invitation = await this.prisma.workspaceInvitation.update({
        where: { id: existingInv.id },
        data: {
          status: INVITATION_PENDING,
          role: dto.role,
          invitedById: actorId,
          respondedAt: null,
        },
        include: {
          invitedUser: {
            select: {
              id: true,
              email: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
      });
      await this.prisma.notification.deleteMany({
        where: {
          userId: userToAdd.id,
          entityType: ENTITY_WORKSPACE_INVITATION,
          entityId: invitation.id,
        },
      });
    } else {
      invitation = await this.prisma.workspaceInvitation.create({
        data: {
          workspaceId,
          invitedUserId: userToAdd.id,
          role: dto.role,
          invitedById: actorId,
          status: INVITATION_PENDING,
        },
        include: {
          invitedUser: {
            select: {
              id: true,
              email: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
      });
    }

    await this.prisma.notification.create({
      data: {
        userId: userToAdd.id,
        workspaceId,
        type: NOTIFICATION_TYPE_WORKSPACE_INVITE,
        entityType: ENTITY_WORKSPACE_INVITATION,
        entityId: invitation.id,
        triggeredById: actorId,
        data: {
          workspaceName: workspace.name,
          role: dto.role,
        },
      },
    });

    this.realtime.emitUser(userToAdd.id, ["notifications"]);
    this.realtime.emitWorkspace(workspaceId, ["members"]);
    await this.cache.invalidateWorkspace(workspaceId, ["members"]);

    return {
      id: invitation.id,
      workspaceId: invitation.workspaceId,
      invitedUserId: invitation.invitedUserId,
      role: invitation.role,
      status: invitation.status,
      invitedById: invitation.invitedById,
      createdAt: invitation.createdAt,
      invitedUser: invitation.invitedUser,
      workspace,
    };
  }

  async respondToInvitation(
    userId: string,
    invitationId: string,
    accept: boolean,
  ): Promise<{ outcome: "ACCEPTED" | "REJECTED" }> {
    const inv = await this.prisma.workspaceInvitation.findFirst({
      where: { id: invitationId },
      include: {
        workspace: { select: { id: true, deletedAt: true } },
      },
    });

    if (!inv || inv.workspace.deletedAt) {
      throw new NotFoundException("Invitation not found.");
    }
    if (inv.invitedUserId !== userId) {
      throw new ForbiddenException("This invitation is not for you.");
    }
    if (inv.status !== INVITATION_PENDING) {
      throw new BadRequestException("This invitation is no longer pending.");
    }

    if (!accept) {
      await this.prisma.$transaction(async (tx) => {
        await tx.workspaceInvitation.update({
          where: { id: inv.id },
          data: {
            status: INVITATION_REJECTED,
            respondedAt: new Date(),
          },
        });
        await tx.notification.updateMany({
          where: {
            userId,
            entityType: ENTITY_WORKSPACE_INVITATION,
            entityId: inv.id,
          },
          data: { isRead: true },
        });
      });
      this.realtime.emitUser(userId, ["notifications"]);
      return { outcome: "REJECTED" };
    }

    const existingMember = await this.prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId: inv.workspaceId,
        },
      },
    });

    await this.prisma.$transaction(async (tx) => {
      if (!existingMember) {
        await tx.workspaceMember.create({
          data: {
            userId,
            workspaceId: inv.workspaceId,
            role: inv.role,
            invitedById: inv.invitedById,
          },
        });
      }
      await tx.workspaceInvitation.update({
        where: { id: inv.id },
        data: {
          status: INVITATION_ACCEPTED,
          respondedAt: new Date(),
        },
      });
      await tx.notification.updateMany({
        where: {
          userId,
          entityType: ENTITY_WORKSPACE_INVITATION,
          entityId: inv.id,
        },
        data: { isRead: true },
      });
    });

    this.realtime.emitUser(userId, ["notifications"]);
    this.realtime.emitWorkspace(inv.workspaceId, ["members"]);
    await this.cache.invalidateWorkspace(inv.workspaceId, ["members"]);
    return { outcome: "ACCEPTED" };
  }

  async removeMember(actorId: string, workspaceId: string, targetUserId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: { id: true, ownerId: true },
    });
    if (!workspace) {
      throw new NotFoundException("Workspace not found.");
    }

    if (targetUserId === workspace.ownerId) {
      throw new ForbiddenException(
        "The workspace owner cannot be removed. Transfer ownership first.",
      );
    }

    const targetMember = await this.prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId: targetUserId, workspaceId },
      },
    });
    if (!targetMember) {
      throw new NotFoundException("Member not found in this workspace.");
    }

    if (actorId === targetUserId) {
      await this.prisma.workspaceMember.delete({
        where: {
          userId_workspaceId: { userId: targetUserId, workspaceId },
        },
      });
      this.realtime.emitWorkspace(workspaceId, ["members"]);
      await this.cache.invalidateWorkspace(workspaceId, ["members"]);
      return;
    }

    await this.assertCanManage(actorId, workspaceId);

    await this.prisma.workspaceMember.delete({
      where: {
        userId_workspaceId: { userId: targetUserId, workspaceId },
      },
    });
    this.realtime.emitWorkspace(workspaceId, ["members"]);
    await this.cache.invalidateWorkspace(workspaceId, ["members"]);
  }

  async remove(userId: string, workspaceId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: { id: true, ownerId: true },
    });

    if (!workspace) {
      throw new NotFoundException("Workspace not found.");
    }

    if (workspace.ownerId !== userId) {
      throw new ForbiddenException("Only the workspace owner can delete this workspace.");
    }

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Ensures the user belongs to a non-deleted workspace. Used by WorkspaceGuard.
   */
  async assertWorkspaceMember(userId: string, workspaceId: string): Promise<void> {
    await this.assertIsMember(userId, workspaceId);
  }

  private async assertIsMember(userId: string, workspaceId: string): Promise<void> {
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId },
      },
      include: {
        workspace: { select: { deletedAt: true } },
      },
    });

    if (!member || member.workspace.deletedAt) {
      throw new NotFoundException("Workspace not found.");
    }
  }

  private async assertCanManage(userId: string, workspaceId: string): Promise<void> {
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId },
      },
      include: {
        workspace: { select: { deletedAt: true } },
      },
    });

    if (!member || member.workspace.deletedAt) {
      throw new NotFoundException("Workspace not found.");
    }

    if (!ROLES_CAN_MANAGE.has(member.role)) {
      throw new ForbiddenException("You do not have permission to modify this workspace.");
    }
  }

  private async ensureUniqueSlug(base: string): Promise<string> {
    let candidate = base;
    let n = 0;
    while (true) {
      const taken = await this.prisma.workspace.findFirst({
        where: { slug: candidate, deletedAt: null },
        select: { id: true },
      });
      if (!taken) return candidate;
      n += 1;
      candidate = `${base}-${n}`;
    }
  }
}
