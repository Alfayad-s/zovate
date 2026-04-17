import { Inject, Injectable } from "@nestjs/common";
import type Redis from "ioredis";

import { REDIS } from "../cache/redis.provider";

/** Redis SET key per channel: members are `userId` strings (Socket.IO + Redis adapter). */
@Injectable()
export class ChatPresenceService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  private channelKey(channelId: string) {
    return `chat:presence:channel:${channelId}`;
  }

  async userJoinedChannel(
    userId: string,
    channelId: string,
  ): Promise<string[]> {
    await this.redis.sadd(this.channelKey(channelId), userId);
    return this.redis.smembers(this.channelKey(channelId));
  }

  async userLeftChannel(
    userId: string,
    channelId: string,
  ): Promise<string[]> {
    await this.redis.srem(this.channelKey(channelId), userId);
    return this.redis.smembers(this.channelKey(channelId));
  }
}
