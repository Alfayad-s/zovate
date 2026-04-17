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
  ApiTags,
} from "@nestjs/swagger";
import type { Request } from "express";
import { WorkspaceGuard } from "../workspaces/workspace.guard";
import { AssignTaskUserDto } from "./dto/assign-task-user.dto";
import { CreateTaskDto } from "./dto/create-task.dto";
import { TaskLabelBodyDto } from "./dto/task-label-body.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { TasksService } from "./tasks.service";

@ApiTags("tasks")
@Controller("workspaces/:workspaceId/tasks")
@UseGuards(AuthGuard("jwt"), WorkspaceGuard)
@ApiBearerAuth("access-token")
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @ApiOperation({
    summary: "List tasks (status, priority, position; includes assignees and labels)",
  })
  @ApiQuery({ name: "projectId", required: false })
  @ApiQuery({ name: "statusId", required: false })
  @ApiQuery({
    name: "includeArchived",
    required: false,
    description: "true / 1 to include archived tasks",
  })
  async list(
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Query("projectId") projectId?: string,
    @Query("statusId") statusId?: string,
    @Query("includeArchived") includeArchived?: string,
  ) {
    const archived = includeArchived === "true" || includeArchived === "1";
    return this.tasks.listTasks(workspaceId, {
      projectId:
        projectId && /^[0-9a-f-]{36}$/i.test(projectId) ? projectId : undefined,
      statusId:
        statusId && /^[0-9a-f-]{36}$/i.test(statusId) ? statusId : undefined,
      includeArchived: archived,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a task" })
  async create(
    @Req() req: Request,
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Body() dto: CreateTaskDto,
  ) {
    const user = req.user as Express.User;
    return this.tasks.createTask(user.id, workspaceId, dto);
  }

  @Get(":taskId")
  @ApiOperation({ summary: "Get one task with status, assignees, labels" })
  async getOne(
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Param("taskId", ParseUUIDPipe) taskId: string,
  ) {
    return this.tasks.getTask(workspaceId, taskId);
  }

  @Patch(":taskId")
  @ApiOperation({
    summary: "Update task (status, priority, position, title, …)",
  })
  async update(
    @Req() req: Request,
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    const user = req.user as Express.User;
    return this.tasks.updateTask(user.id, workspaceId, taskId, dto);
  }

  @Delete(":taskId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft-delete a task" })
  async remove(
    @Req() req: Request,
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Param("taskId", ParseUUIDPipe) taskId: string,
  ): Promise<void> {
    const user = req.user as Express.User;
    await this.tasks.removeTask(user.id, workspaceId, taskId);
  }

  @Post(":taskId/assignees")
  @ApiOperation({ summary: "Assign a workspace member to the task" })
  async assign(
    @Req() req: Request,
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Body() dto: AssignTaskUserDto,
  ) {
    const user = req.user as Express.User;
    return this.tasks.assignUser(user.id, workspaceId, taskId, dto.userId);
  }

  @Delete(":taskId/assignees/:userId")
  @ApiOperation({ summary: "Remove a user from the task" })
  async unassign(
    @Req() req: Request,
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Param("userId", ParseUUIDPipe) targetUserId: string,
  ) {
    const user = req.user as Express.User;
    return this.tasks.unassignUser(user.id, workspaceId, taskId, targetUserId);
  }

  @Post(":taskId/labels")
  @ApiOperation({ summary: "Attach a workspace label to the task" })
  async addLabel(
    @Req() req: Request,
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Body() dto: TaskLabelBodyDto,
  ) {
    const user = req.user as Express.User;
    return this.tasks.addTaskLabel(
      user.id,
      workspaceId,
      taskId,
      dto.labelId,
    );
  }

  @Delete(":taskId/labels/:labelId")
  @ApiOperation({ summary: "Remove a label from the task" })
  async removeLabel(
    @Req() req: Request,
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Param("labelId", ParseUUIDPipe) labelId: string,
  ) {
    const user = req.user as Express.User;
    return this.tasks.removeTaskLabel(
      user.id,
      workspaceId,
      taskId,
      labelId,
    );
  }
}
