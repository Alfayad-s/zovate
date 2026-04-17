import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CacheService } from "../cache/cache.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

const PROJECT_SELECT = {
  id: true,
  workspaceId: true,
  name: true,
  description: true,
  visibility: true,
  createdById: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProjectSelect;

type ProjectRow = Prisma.ProjectGetPayload<{ select: typeof PROJECT_SELECT }>;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private projectSelect(): Prisma.ProjectSelect {
    return PROJECT_SELECT;
  }

  async create(
    userId: string,
    workspaceId: string,
    dto: CreateProjectDto,
  ) {
    const created = await this.prisma.project.create({
      data: {
        workspaceId,
        name: dto.name.trim(),
        description:
          dto.description !== undefined && dto.description.trim().length > 0
            ? dto.description.trim()
            : null,
        visibility: dto.visibility ?? "workspace",
        createdById: userId,
        isArchived: dto.isArchived ?? false,
      },
      select: this.projectSelect(),
    });
    await this.cache.invalidateWorkspace(workspaceId, ["projects"]);
    return created;
  }

  async findAllForWorkspace(
    workspaceId: string,
    opts?: {
      includeArchived?: boolean;
      q?: string;
      visibility?: "workspace" | "private" | "public";
      sortBy?: "updatedAt" | "name";
      sortOrder?: "asc" | "desc";
    },
  ) {
    const q = opts?.q?.trim();
    const vis = opts?.visibility;
    const sortBy = opts?.sortBy ?? "updatedAt";
    const sortOrder = opts?.sortOrder ?? "desc";

    const where: Prisma.ProjectWhereInput = {
      workspaceId,
      deletedAt: null,
      ...(opts?.includeArchived ? {} : { isArchived: false }),
      ...(vis ? { visibility: vis } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const cacheKey = [
      `ws:${workspaceId}:projects:list`,
      `arch=${opts?.includeArchived ? "1" : "0"}`,
      `q=${q ?? ""}`,
      `vis=${vis ?? ""}`,
      `sortBy=${sortBy}`,
      `sortOrder=${sortOrder}`,
    ].join("|");
    const cached = await this.cache.getJson<ProjectRow[]>(cacheKey);
    if (cached) return cached;

    const rows = await this.prisma.project.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      select: this.projectSelect(),
    });
    await this.cache.setJson(cacheKey, rows, {
      ttlSeconds: 30,
      workspaceId,
      scope: "projects",
    });
    return rows;
  }

  async findOne(workspaceId: string, projectId: string) {
    const key = `ws:${workspaceId}:projects:detail:${projectId}`;
    const cached = await this.cache.getJson<ProjectRow>(key);
    if (cached) return cached;

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        workspaceId,
        deletedAt: null,
      },
      select: this.projectSelect(),
    });
    if (!project) {
      throw new NotFoundException("Project not found.");
    }
    await this.cache.setJson(key, project, {
      ttlSeconds: 60,
      workspaceId,
      scope: "projects",
    });
    return project;
  }

  async update(
    workspaceId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ) {
    await this.findOne(workspaceId, projectId);

    const data: Prisma.ProjectUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      const v = dto.description.trim();
      data.description = v.length === 0 ? null : v;
    }
    if (dto.visibility !== undefined) {
      data.visibility = dto.visibility;
    }
    if (dto.isArchived !== undefined) {
      data.isArchived = dto.isArchived;
    }

    if (Object.keys(data).length === 0) {
      return this.findOne(workspaceId, projectId);
    }

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data,
      select: this.projectSelect(),
    });
    await this.cache.invalidateWorkspace(workspaceId, ["projects", "tasks"]);
    return updated;
  }

  async remove(workspaceId: string, projectId: string): Promise<void> {
    await this.findOne(workspaceId, projectId);

    await this.prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
    });
    await this.cache.invalidateWorkspace(workspaceId, ["projects", "tasks"]);
  }
}
