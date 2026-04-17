import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import type { Server, ServerOptions } from "socket.io";

/**
 * Socket.IO over HTTP with an optional **Redis adapter** (`REDIS_URL`) so room
 * targets are cluster-wide, not process-local.
 *
 * **Multi-instance event flow (with Redis):**
 *
 * 1. **Server A** handles a socket message / REST side-effect and calls
 *    `namespace.to("room").emit("event", payload)` (same as single-node code).
 * 2. The **Redis adapter** publishes that emit to Redis (fan-out metadata so
 *    every node knows which room/event/payload to deliver).
 * 3. **Server B** (and A) **subscribes**; each applies the event to **its own**
 *    local sockets that are in that room.
 * 4. Clients connected only to B still receive the broadcast **without** their
 *    TCP/WebSocket ever touching A.
 *
 * With no `REDIS_URL`, behavior matches {@link IoAdapter}: emits stay in-memory
 * on the one process that handled the request.
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterFactory: ReturnType<typeof createAdapter> | null = null;

  /**
   * Connect pub/sub clients and build the adapter. No-op if `REDIS_URL` is empty.
   * @returns whether the Redis adapter is active
   */
  async connectToRedis(): Promise<boolean> {
    const url = process.env.REDIS_URL?.trim();
    if (!url) {
      return false;
    }
    const pubClient = createClient({ url });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    this.adapterFactory = createAdapter(pubClient, subClient);
    return true;
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    if (this.adapterFactory) {
      server.adapter(this.adapterFactory);
    }
    return server;
  }
}
