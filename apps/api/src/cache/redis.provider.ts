import { Provider } from "@nestjs/common";
import Redis from "ioredis";

export const REDIS = Symbol("REDIS_CLIENT");

function buildRedis(): Redis {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    throw new Error(
      "REDIS_URL is not set. Set REDIS_URL to enable Redis caching.",
    );
  }

  return new Redis(url, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true,
  });
}

export const RedisProvider: Provider = {
  provide: REDIS,
  useFactory: async () => {
    const client = buildRedis();
    await client.connect();
    return client;
  },
};

