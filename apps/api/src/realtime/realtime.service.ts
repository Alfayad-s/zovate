import { Injectable } from "@nestjs/common";
import type { Namespace } from "socket.io";

import type { InvalidateScope } from "./realtime.types";

@Injectable()
export class RealtimeService {
  private namespace: Namespace | null = null;

  /** Called from RealtimeGateway.afterInit */
  attachServer(namespace: Namespace) {
    this.namespace = namespace;
  }

  /**
   * Members who joined this workspace room receive the event.
   * With Redis adapter: reaches clients on every API instance in that room.
   */
  emitWorkspace(workspaceId: string, scopes: InvalidateScope[]) {
    if (!this.namespace || scopes.length === 0) return;
    this.namespace.to(`workspace:${workspaceId}`).emit("invalidate", { scopes });
  }

  /**
   * User’s private room (joined on connect) — e.g. new notification for them.
   * With Redis adapter: delivered on whichever node holds that user’s socket.
   */
  emitUser(userId: string, scopes: InvalidateScope[]) {
    if (!this.namespace || scopes.length === 0) return;
    this.namespace.to(`user:${userId}`).emit("invalidate", { scopes });
  }
}
