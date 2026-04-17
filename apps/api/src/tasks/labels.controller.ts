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
import { CreateLabelDto } from "./dto/create-label.dto";
import { UpdateLabelDto } from "./dto/update-label.dto";
import { TasksService } from "./tasks.service";

@ApiTags("labels")
@Controller("workspaces/:workspaceId/labels")
@UseGuards(AuthGuard("jwt"), WorkspaceGuard)
@ApiBearerAuth("access-token")
export class LabelsController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @ApiOperation({ summary: "List workspace labels" })
  async list(@Param("workspaceId", ParseUUIDPipe) workspaceId: string) {
    return this.tasks.listLabels(workspaceId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a label (owner/admin)" })
  async create(
    @Req() req: Request,
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Body() dto: CreateLabelDto,
  ) {
    const user = req.user as Express.User;
    return this.tasks.createLabel(user.id, workspaceId, dto);
  }

  @Patch(":labelId")
  @ApiOperation({ summary: "Update a label (owner/admin)" })
  async update(
    @Req() req: Request,
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Param("labelId", ParseUUIDPipe) labelId: string,
    @Body() dto: UpdateLabelDto,
  ) {
    const user = req.user as Express.User;
    return this.tasks.updateLabel(user.id, workspaceId, labelId, dto);
  }

  @Delete(":labelId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft-delete a label and detach from tasks (owner/admin)" })
  async remove(
    @Req() req: Request,
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Param("labelId", ParseUUIDPipe) labelId: string,
  ): Promise<void> {
    const user = req.user as Express.User;
    await this.tasks.removeLabel(user.id, workspaceId, labelId);
  }
}
