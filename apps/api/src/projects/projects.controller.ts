import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Request } from "express";
import { CreateProjectDto } from "./dto/create-project.dto";
import { ProjectDto } from "./dto/project-response.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { ProjectsService } from "./projects.service";
import { WorkspaceGuard } from "../workspaces/workspace.guard";

@ApiTags("projects")
@Controller("workspaces/:workspaceId/projects")
@UseGuards(AuthGuard("jwt"), WorkspaceGuard)
@ApiBearerAuth("access-token")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a project in the workspace" })
  @ApiResponse({ status: 201, type: ProjectDto })
  async create(
    @Req() req: Request,
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectDto> {
    const user = req.user as Express.User;
    return this.projects.create(user.id, workspaceId, dto);
  }

  @Get()
  @ApiOperation({ summary: "List projects in the workspace" })
  @ApiQuery({
    name: "includeArchived",
    required: false,
    type: Boolean,
    description: "Include archived projects (default false)",
  })
  @ApiQuery({
    name: "q",
    required: false,
    description: "Search in project name and description (case-insensitive)",
  })
  @ApiQuery({
    name: "visibility",
    required: false,
    enum: ["workspace", "private", "public"],
    description: "Filter by visibility; omit for all",
  })
  @ApiQuery({
    name: "sortBy",
    required: false,
    enum: ["updatedAt", "name"],
    description: "Sort field (default updatedAt)",
  })
  @ApiQuery({
    name: "sortOrder",
    required: false,
    enum: ["asc", "desc"],
    description: "Sort direction (default desc for updatedAt, asc for name)",
  })
  @ApiResponse({ status: 200, type: [ProjectDto] })
  async list(
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Query("includeArchived") includeArchived?: string,
    @Query("q") q?: string,
    @Query("visibility") visibility?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: string,
  ): Promise<ProjectDto[]> {
    const archived =
      includeArchived === "true" || includeArchived === "1";

    const vis =
      visibility === "workspace" ||
      visibility === "private" ||
      visibility === "public"
        ? visibility
        : undefined;

    const sortByNorm =
      sortBy === "name" || sortBy === "updatedAt" ? sortBy : undefined;
    const sortOrderNorm =
      sortOrder === "asc" || sortOrder === "desc" ? sortOrder : undefined;

    return this.projects.findAllForWorkspace(workspaceId, {
      includeArchived: archived,
      q,
      visibility: vis,
      sortBy: sortByNorm,
      sortOrder:
        sortOrderNorm ??
        (sortByNorm === "name" ? "asc" : "desc"),
    });
  }

  @Get(":projectId")
  @ApiOperation({ summary: "Get a project by id" })
  @ApiResponse({ status: 200, type: ProjectDto })
  @ApiResponse({ status: 404 })
  async getOne(
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ): Promise<ProjectDto> {
    return this.projects.findOne(workspaceId, projectId);
  }

  @Patch(":projectId")
  @ApiOperation({ summary: "Update a project" })
  @ApiResponse({ status: 200, type: ProjectDto })
  @ApiResponse({ status: 404 })
  async update(
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectDto> {
    return this.projects.update(workspaceId, projectId, dto);
  }

  @Delete(":projectId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft-delete a project" })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404 })
  async remove(
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ): Promise<void> {
    await this.projects.remove(workspaceId, projectId);
  }
}
