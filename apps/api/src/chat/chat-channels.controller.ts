import {
  BadRequestException,
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { ChatChannelsService } from "./chat-channels.service";
import { ChatGateway } from "./chat.gateway";

@ApiTags("chat")
@Controller("chat")
@UseGuards(AuthGuard("jwt"))
@ApiBearerAuth("access-token")
export class ChatChannelsController {
  constructor(
    private readonly chatChannels: ChatChannelsService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get("squad-channel")
  @ApiOperation({
    summary: "Get or create the default squad chat channel for a workspace",
  })
  @ApiQuery({ name: "workspaceId", required: true, description: "Workspace UUID" })
  async getOrCreateSquadChannel(
    @Req() req: Request,
    @Query("workspaceId") workspaceId: string | undefined,
  ) {
    if (!workspaceId?.trim()) {
      throw new BadRequestException("workspaceId is required.");
    }
    const user = req.user as Express.User;
    const result = await this.chatChannels.getOrCreateSquadChannel({
      workspaceId: workspaceId.trim(),
      userId: user.id,
    });
    return result;
  }

  @Patch("channels/:channelId")
  @ApiOperation({ summary: "Rename a chat channel (OWNER/ADMIN only)" })
  async renameChannel(
    @Req() req: Request,
    @Param("channelId") channelId: string | undefined,
    @Body() body: { name?: unknown } | undefined,
  ) {
    const rawId = channelId?.trim();
    if (!rawId) {
      throw new BadRequestException("channelId is required.");
    }
    const rawName = typeof body?.name === "string" ? body.name.trim() : "";
    if (!rawName) {
      throw new BadRequestException("name is required.");
    }
    if (rawName.length > 64) {
      throw new BadRequestException("name must be 64 characters or less.");
    }
    const user = req.user as Express.User;
    const result = await this.chatChannels.renameChannel({
      channelId: rawId,
      actorId: user.id,
      name: rawName,
    });
    this.chatGateway.emitChannelRenamed(result);
    return result;
  }
}

