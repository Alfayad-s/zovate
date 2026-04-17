import {
  BadRequestException,
  Controller,
  Param,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UploadedFile } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { memoryStorage } from "multer";
import type { Request } from "express";

import { RealtimeAuthService } from "../realtime/realtime-auth.service";
import { SupabaseStorageService } from "../storage/supabase-storage.service";

export type ChatAttachmentDto = {
  url: string;
  name: string;
  mimeType: string;
  size: number;
  kind: "image" | "video" | "file";
};

@ApiTags("chat")
@Controller("chat")
@UseGuards(AuthGuard("jwt"))
@ApiBearerAuth("access-token")
export class ChatAttachmentsController {
  constructor(
    private readonly realtimeAuth: RealtimeAuthService,
    private readonly storage: SupabaseStorageService,
  ) {}

  @Post("channels/:channelId/attachments")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: "Upload a chat attachment (multipart field: file)" })
  @ApiParam({ name: "channelId", description: "Channel UUID" })
  @ApiResponse({ status: 200 })
  async uploadAttachment(
    @Req() req: Request,
    @Param("channelId") channelId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<ChatAttachmentDto> {
    if (!file?.buffer) {
      throw new BadRequestException("Missing file field: file");
    }

    const user = req.user as Express.User;
    const gate = await this.realtimeAuth.assertChannelAccess(user.id, channelId);
    if (!gate.ok) {
      throw new BadRequestException("Invalid channel access.");
    }

    const url = await this.storage.uploadChatAttachmentObject({
      channelId,
      originalName: file.originalname || "file",
      buffer: file.buffer,
      mimeType: file.mimetype,
    });

    const mimeType = file.mimetype || "application/octet-stream";
    const kind = mimeType.startsWith("image/")
      ? "image"
      : mimeType.startsWith("video/")
        ? "video"
        : "file";

    return {
      url,
      name: file.originalname || "file",
      mimeType,
      size: file.size ?? file.buffer.length,
      kind,
    };
  }
}

