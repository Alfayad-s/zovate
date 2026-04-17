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
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { WorkspaceGuard } from "../workspaces/workspace.guard";
import { CreateTaskStatusDto } from "./dto/create-task-status.dto";
import { UpdateTaskStatusDto } from "./dto/update-task-status.dto";
import { TasksService } from "./tasks.service";

@ApiTags("task-statuses")
@Controller("workspaces/:workspaceId/task-statuses")
@UseGuards(AuthGuard("jwt"), WorkspaceGuard)
@ApiBearerAuth("access-token")
export class TaskStatusesController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @ApiOperation({
    summary: "List kanban columns (task statuses) ordered by position",
  })
  async list(@Param("workspaceId", ParseUUIDPipe) workspaceId: string) {
    return this.tasks.listTaskStatuses(workspaceId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create a status column (any workspace member)",
  })
  async create(
    @Req() req: Request,
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Body() dto: CreateTaskStatusDto,
  ) {
    const user = req.user as Express.User;
    return this.tasks.createTaskStatus(user.id, workspaceId, dto);
  }

  @Patch(":statusId")
  @ApiOperation({ summary: "Update a status column (owner/admin)" })
  async update(
    @Req() req: Request,
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Param("statusId", ParseUUIDPipe) statusId: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    const user = req.user as Express.User;
    return this.tasks.updateTaskStatus(user.id, workspaceId, statusId, dto);
  }

  @Delete(":statusId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Soft-delete a status column if no tasks use it (owner/admin)",
  })
  async remove(
    @Req() req: Request,
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Param("statusId", ParseUUIDPipe) statusId: string,
  ): Promise<void> {
    const user = req.user as Express.User;
    await this.tasks.removeTaskStatus(user.id, workspaceId, statusId);
  }
}
