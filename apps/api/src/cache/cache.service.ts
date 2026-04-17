import { Inject, Injectable, Logger } from "@nestjs/common";
import type Redis from "ioredis";

import { REDIS } from "./redis.provider";

type Scope =
  | "tasks"
  | "statuses"
  | "labels"
  | "comments"
  | "members"
  | "projects";

function scopeSetKey(workspaceId: string, scope: Scope) {
  return `cache:ws:${workspaceId}:scope:${scope}`;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch (e) {
      this.logger.debug(
        `Bad JSON in cache for ${key}: ${e instanceof Error ? e.message : e}`,
      );
      await this.redis.del(key);
      return null;
    }
  }

  async setJson(
    key: string,
    value: unknown,
    opts: { ttlSeconds: number; workspaceId: string; scope: Scope },
  ): Promise<void> {
    const ttl = Math.max(1, Math.floor(opts.ttlSeconds));
    const payload = JSON.stringify(value);
    await this.redis.multi()
      .set(key, payload, "EX", ttl)
      .sadd(scopeSetKey(opts.workspaceId, opts.scope), key)
      .exec();
  }

  async invalidateWorkspace(workspaceId: string, scopes: Scope[]) {
    const uniq = [...new Set(scopes)];
    for (const scope of uniq) {
      const setKey = scopeSetKey(workspaceId, scope);
      const keys = await this.redis.smembers(setKey);
      if (keys.length > 0) {
        // UNLINK is non-blocking on Redis >= 4
        await this.redis.unlink(...keys);
      }
      await this.redis.del(setKey);
    }
  }
}

