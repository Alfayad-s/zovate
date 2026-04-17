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
import { CreateTaskCommentDto } from "./dto/create-task-comment.dto";
import { UpdateTaskCommentDto } from "./dto/update-task-comment.dto";
import { TaskCommentsService } from "./task-comments.service";

@ApiTags("task-comments")
@Controller("workspaces/:workspaceId/tasks/:taskId/comments")
@UseGuards(AuthGuard("jwt"), WorkspaceGuard)
@ApiBearerAuth("access-token")
export class TaskCommentsController {
  constructor(private readonly comments: TaskCommentsService) {}

  @Get()
  @ApiOperation({ summary: "List comments for a task" })
  async list(
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Param("taskId", ParseUUIDPipe) taskId: string,
  ) {
    return this.comments.list(workspaceId, taskId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a comment on a task" })
  async create(
    @Req() req: Request,
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Body() dto: CreateTaskCommentDto,
  ) {
    const user = req.user as Express.User;
    return this.comments.create(user.id, workspaceId, taskId, dto);
  }

  @Patch(":commentId")
  @ApiOperation({ summary: "Update a task comment (author only)" })
  async update(
    @Req() req: Request,
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Param("commentId", ParseUUIDPipe) commentId: string,
    @Body() dto: UpdateTaskCommentDto,
  ) {
    const user = req.user as Express.User;
    return this.comments.update(user.id, workspaceId, taskId, commentId, dto);
  }

  @Delete(":commentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a task comment (author only)" })
  async remove(
    @Req() req: Request,
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Param("commentId", ParseUUIDPipe) commentId: string,
  ): Promise<void> {
    const user = req.user as Express.User;
    await this.comments.remove(user.id, workspaceId, taskId, commentId);
  }
}

