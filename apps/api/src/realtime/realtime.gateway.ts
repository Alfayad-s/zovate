import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Namespace, Socket } from "socket.io";

import { RealtimeAuthService } from "./realtime-auth.service";
import { RealtimeService } from "./realtime.service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

function userRoom(userId: string) {
  return `user:${userId}`;
}

function workspaceRoom(workspaceId: string) {
  return `workspace:${workspaceId}`;
}

function channelRoom(channelId: string) {
  return `channel:${channelId}`;
}

@WebSocketGateway({
  namespace: "/realtime",
  cors: {
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server!: Namespace;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly realtime: RealtimeService,
    private readonly realtimeAuth: RealtimeAuthService,
  ) {}

  afterInit(server: Namespace) {
    this.realtime.attachServer(server);
  }

  async handleConnection(client: Socket) {
    const token =
      typeof client.handshake.auth?.token === "string"
        ? client.handshake.auth.token
        : null;
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      const userId = payload.sub;
      if (!userId || !isUuid(userId)) {
        client.disconnect(true);
        return;
      }
      const active = await this.realtimeAuth.assertSocketUser(userId);
      if (!active.ok) {
        this.logger.debug(`WS rejected inactive user socket`);
        client.disconnect(true);
        return;
      }
      client.data.userId = userId;
      await client.join(userRoom(userId));
    } catch (e) {
      this.logger.debug(`WS auth failed: ${e instanceof Error ? e.message : e}`);
      client.disconnect(true);
    }
  }

  @SubscribeMessage("joinWorkspace")
  async joinWorkspace(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { workspaceId?: string },
  ) {
    const userId = client.data.userId as string | undefined;
    const workspaceId = body?.workspaceId;
    if (!userId || !workspaceId || !isUuid(workspaceId)) {
      return { ok: false as const, error: "bad_request" };
    }
    const gate = await this.realtimeAuth.assertWorkspaceMember(
      userId,
      workspaceId,
    );
    if (!gate.ok) {
      return { ok: false as const, error: gate.error };
    }
    await client.join(workspaceRoom(workspaceId));
    return { ok: true as const };
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
    return { ok: true as const, workspaceId: gate.workspaceId };
  }

  @SubscribeMessage("leaveChannel")
  async leaveChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { channelId?: string },
  ) {
    const channelId = body?.channelId;
    if (!channelId || !isUuid(channelId)) {
      return { ok: false as const, error: "bad_request" as const };
    }
    await client.leave(channelRoom(channelId));
    return { ok: true as const };
  }

  @SubscribeMessage("leaveWorkspace")
  async leaveWorkspace(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { workspaceId?: string },
  ) {
    const workspaceId = body?.workspaceId;
    if (!workspaceId || !isUuid(workspaceId)) {
      return { ok: false as const };
    }
    await client.leave(workspaceRoom(workspaceId));
    return { ok: true as const };
  }
}
