import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async listForUser(userId: string, unreadOnly?: boolean) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      include: {
        workspace: {
          select: { id: true, name: true, logoUrl: true },
        },
        triggeredBy: {
          select: {
            id: true,
            email: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const n = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!n) {
      throw new NotFoundException("Notification not found.");
    }
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
    this.realtime.emitUser(userId, ["notifications"]);
  }

  /**
   * Marks non-invite notifications as read after the user views the notification panel
   * (client calls this when the panel closes). Pending workspace invites stay unread until
   * accepted or declined.
   */
  async markSeenOnPanelOpen(userId: string): Promise<void> {
    const res = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
        type: { not: "WORKSPACE_INVITE" },
      },
      data: { isRead: true },
    });
    if (res.count > 0) {
      this.realtime.emitUser(userId, ["notifications"]);
    }
  }
}
