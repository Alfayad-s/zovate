import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Request } from "express";
import { NotificationDto } from "./dto/notification-response.dto";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@Controller("notifications")
@UseGuards(AuthGuard("jwt"))
@ApiBearerAuth("access-token")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "List your notifications (newest first)" })
  @ApiResponse({ status: 200, type: [NotificationDto] })
  async list(
    @Req() req: Request,
    @Query("unreadOnly") unreadOnly?: string,
  ): Promise<NotificationDto[]> {
    const user = req.user as Express.User;
    const onlyUnread = unreadOnly === "1" || unreadOnly === "true";
    return this.notifications.listForUser(user.id, onlyUnread) as Promise<
      NotificationDto[]
    >;
  }

  @Patch("read/open")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      "Mark task alerts and other non-invite notifications as seen after the user viewed the panel. Pending workspace invites stay unread until accept or decline.",
  })
  @ApiResponse({ status: 204 })
  async markSeenOnOpen(@Req() req: Request): Promise<void> {
    const user = req.user as Express.User;
    await this.notifications.markSeenOnPanelOpen(user.id);
  }

  @Patch(":notificationId/read")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Mark a notification as read" })
  @ApiResponse({ status: 204 })
  async markRead(
    @Req() req: Request,
    @Param("notificationId", ParseUUIDPipe) notificationId: string,
  ): Promise<void> {
    const user = req.user as Express.User;
    await this.notifications.markRead(user.id, notificationId);
  }
}
