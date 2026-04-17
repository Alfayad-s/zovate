import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Namespace, Socket } from "socket.io";

import { MessagesService } from "../messages/messages.service";
import { RealtimeAuthService } from "../realtime/realtime-auth.service";
import { ChatMessagesService } from "./chat-messages.service";
import { ChatOgPreviewService } from "./chat-og-preview.service";
import { ChatPresenceService } from "./chat-presence.service";
import { parseSendMessageBody } from "./parse-send-message-body";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

function channelRoom(channelId: string) {
  return `channel:${channelId}`;
}

function joinedChannels(client: Socket): string[] {
  const d = client.data as { joinedChatChannels?: string[] };
  if (!d.joinedChatChannels) {
    d.joinedChatChannels = [];
  }
  return d.joinedChatChannels;
}

/**
 * Dedicated namespace for chat traffic (separate from `/realtime` cache invalidation).
 */
@WebSocketGateway({
  namespace: "/chat",
  cors: {
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Namespace;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly realtimeAuth: RealtimeAuthService,
    private readonly chatMessages: ChatMessagesService,
    private readonly chatPresence: ChatPresenceService,
    private readonly messages: MessagesService,
    private readonly og: ChatOgPreviewService,
  ) {}

  emitChannelRenamed(payload: {
    channelId: string;
    name: string;
    oldName: string;
    actor: { id: string; email: string; fullName: string | null; avatarUrl: string | null };
  }) {
    this.server.to(channelRoom(payload.channelId)).emit("channel_renamed", payload);
  }

  async handleConnection(client: Socket) {
    const token =
      typeof client.handshake.auth?.token === "string"
        ? client.handshake.auth.token
        : null;
    if (!token) {
      this.logger.debug(`Chat WS rejected: missing token (${client.id})`);
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      const userId = payload.sub;
      if (!userId || !isUuid(userId)) {
        this.logger.debug(`Chat WS rejected: invalid subject (${client.id})`);
        client.disconnect(true);
        return;
      }
      const active = await this.realtimeAuth.assertSocketUser(userId);
      if (!active.ok) {
        this.logger.debug(`Chat WS rejected: inactive user (${client.id})`);
        client.disconnect(true);
        return;
      }
      client.data.userId = userId;
      (client.data as { joinedChatChannels?: string[] }).joinedChatChannels =
        [];
      this.logger.debug(`Chat WS connected user=${userId} socket=${client.id}`);
    } catch (e) {
      this.logger.debug(
        `Chat WS auth failed (${client.id}): ${e instanceof Error ? e.message : e}`,
      );
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId as string | undefined;
    this.logger.debug(
      `Chat WS disconnected socket=${client.id}${userId ? ` user=${userId}` : ""}`,
    );
    if (!userId) return;
    const channels = [...joinedChannels(client)];
    for (const channelId of channels) {
      try {
        const onlineUserIds = await this.chatPresence.userLeftChannel(
          userId,
          channelId,
        );
        this.server.to(channelRoom(channelId)).emit("presence_update", {
          channelId,
          onlineUserIds,
        });
      } catch (e) {
        this.logger.warn(
          `presence cleanup failed: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
    joinedChannels(client).length = 0;
  }

  @SubscribeMessage("joinChannel")
  async joinChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { channelId?: string },
  ) {
    const userId = client.data.userId as string | undefined;
    const channelId = body?.channelId;
    if (!userId || !channelId || !isUuid(channelId)) {
      return { ok: false as const, error: "bad_request" as const };
    }
    const gate = await this.realtimeAuth.assertChannelAccess(userId, channelId);
    if (!gate.ok) {
      return { ok: false as const, error: gate.error };
    }
    await client.join(channelRoom(channelId));
    const list = joinedChannels(client);
    if (!list.includes(channelId)) {
      list.push(channelId);
    }
    const onlineUserIds = await this.chatPresence.userJoinedChannel(
      userId,
      channelId,
    );
    this.server.to(channelRoom(channelId)).emit("presence_update", {
      channelId,
      onlineUserIds,
    });
    return { ok: true as const, workspaceId: gate.workspaceId };
  }

  @SubscribeMessage("leaveChannel")
  async leaveChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { channelId?: string },
  ) {
    const userId = client.data.userId as string | undefined;
    const channelId = body?.channelId;
    if (!channelId || !isUuid(channelId)) {
      return { ok: false as const, error: "bad_request" as const };
    }
    await client.leave(channelRoom(channelId));
    const list = joinedChannels(client);
    const idx = list.indexOf(channelId);
    if (idx >= 0) list.splice(idx, 1);
    if (userId) {
      const onlineUserIds = await this.chatPresence.userLeftChannel(
        userId,
        channelId,
      );
      this.server.to(channelRoom(channelId)).emit("presence_update", {
        channelId,
        onlineUserIds,
      });
    }
    return { ok: true as const };
  }

  @SubscribeMessage("user_typing")
  async userTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { channelId?: string; typing?: boolean },
  ) {
    const userId = client.data.userId as string | undefined;
    const channelId = body?.channelId;
    const typing = body?.typing !== false;
    if (!userId || !channelId || !isUuid(channelId)) {
      return { ok: false as const, error: "bad_request" as const };
    }
    const gate = await this.realtimeAuth.assertChannelAccess(userId, channelId);
    if (!gate.ok) {
      return { ok: false as const, error: gate.error };
    }
    client.broadcast.to(channelRoom(channelId)).emit("user_typing", {
      channelId,
      userId,
      typing,
    });
    return { ok: true as const };
  }

  @SubscribeMessage("mark_read")
  async markRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { channelId?: string; messageId?: string },
  ) {
    const userId = client.data.userId as string | undefined;
    if (!userId) {
      return { ok: false as const, error: "unauthorized" as const };
    }
    const channelId = body?.channelId;
    const messageId = body?.messageId;
    if (!channelId || !messageId || !isUuid(channelId) || !isUuid(messageId)) {
      return { ok: false as const, error: "bad_request" as const };
    }
    try {
      const row = await this.messages.markMessageRead({
        userId,
        channelId,
        messageId,
      });
      this.server.to(channelRoom(channelId)).emit("message_read", row);
      return { ok: true as const, ...row };
    } catch {
      return { ok: false as const, error: "server_error" as const };
    }
  }

  @SubscribeMessage("send_message")
  async sendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    const userId = client.data.userId as string | undefined;
    if (!userId) {
      return { ok: false as const, error: "unauthorized" as const };
    }
    const parsed = parseSendMessageBody(body);
    if (!parsed.ok) {
      return { ok: false as const, error: parsed.error };
    }
    const { channelId, content, attachments } = parsed;
    const gate = await this.realtimeAuth.assertChannelAccess(userId, channelId);
    if (!gate.ok) {
      return { ok: false as const, error: gate.error };
    }
    try {
      const linkPreview =
        content && content.length > 0 ? await this.og.previewFromText(content) : null;
      const row = await this.chatMessages.createChannelMessage({
        workspaceId: gate.workspaceId,
        channelId,
        userId,
        content,
        attachments: attachments.length ? attachments : undefined,
        linkPreview,
      });
      const createdAt = row.createdAt.toISOString();
      const payload = {
        id: row.id,
        workspaceId: row.workspaceId,
        channelId: row.channelId,
        userId: row.userId,
        content: row.content,
        attachments: row.attachments,
        linkPreview: row.linkPreview,
        createdAt,
        user: {
          id: row.user.id,
          email: row.user.email,
          username: row.user.username,
          fullName: row.user.fullName,
          avatarUrl: row.user.avatarUrl,
        },
      };
      client.to(channelRoom(channelId)).emit("user_typing", {
        channelId,
        userId,
        typing: false,
      });
      // Redis adapter: publish to channel room cluster-wide → other nodes emit to their sockets.
      this.server.to(channelRoom(channelId)).emit("new_message", payload);
      return { ok: true as const, message: payload };
    } catch (e) {
      this.logger.warn(
        `send_message persist failed: ${e instanceof Error ? e.message : e}`,
      );
      return { ok: false as const, error: "server_error" as const };
    }
  }
}
