import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
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

import { MarkMessageReadDto } from "./dto/mark-message-read.dto";
import { MessagesService } from "./messages.service";

@ApiTags("messages")
@Controller("messages")
@UseGuards(AuthGuard("jwt"))
@ApiBearerAuth("access-token")
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  @ApiOperation({
    summary: "List channel messages (newest page first; cursor loads older)",
  })
  @ApiQuery({ name: "channelId", required: true, description: "Channel UUID" })
  @ApiQuery({
    name: "cursor",
    required: false,
    description: "Message UUID — fetch messages older than this row",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Page size (1–100, default 30)",
  })
  async list(
    @Req() req: Request,
    @Query("channelId") channelId: string | undefined,
    @Query("limit", new DefaultValuePipe(30), ParseIntPipe) limit: number,
    @Query("cursor") cursor?: string,
  ) {
    if (!channelId?.trim()) {
      throw new BadRequestException("channelId is required.");
    }
    const user = req.user as Express.User;
    return this.messages.listChannelMessages({
      userId: user.id,
      channelId: channelId.trim(),
      cursor: cursor?.trim() || undefined,
      limit,
    });
  }

  @Post("read")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark a channel message as read (upsert)" })
  async markRead(@Req() req: Request, @Body() body: MarkMessageReadDto) {
    const user = req.user as Express.User;
    return this.messages.markMessageRead({
      userId: user.id,
      channelId: body.channelId,
      messageId: body.messageId,
    });
  }
}
