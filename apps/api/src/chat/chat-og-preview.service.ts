import { Inject, Injectable, Logger } from "@nestjs/common";
import { createHash } from "node:crypto";

import type Redis from "ioredis";
import { REDIS } from "../cache/redis.provider";

export type OgPreview = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
};

function firstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>()]+/i);
  return m?.[0] ?? null;
}

function metaContent(html: string, key: string): string | undefined {
  // Matches: <meta property="og:title" content="..."> (order can vary)
  const re1 = new RegExp(
    `<meta[^>]+(?:property|name)=['"]${key.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}['"][^>]+content=['"]([^'"]+)['"][^>]*>`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]+content=['"]([^'"]+)['"][^>]+(?:property|name)=['"]${key.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}['"][^>]*>`,
    "i",
  );
  return re1.exec(html)?.[1] ?? re2.exec(html)?.[1];
}

function titleTag(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i);
  return m?.[1]?.trim();
}

function normalizeAbsolute(baseUrl: string, maybeUrl?: string): string | undefined {
  if (!maybeUrl) return undefined;
  try {
    return new URL(maybeUrl, baseUrl).toString();
  } catch {
    return undefined;
  }
}

@Injectable()
export class ChatOgPreviewService {
  private readonly logger = new Logger(ChatOgPreviewService.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async previewFromText(text: string): Promise<OgPreview | null> {
    const url = firstUrl(text);
    if (!url) return null;
    return this.preview(url);
  }

  async preview(url: string): Promise<OgPreview | null> {
    let normalized: string;
    try {
      normalized = new URL(url).toString();
    } catch {
      return null;
    }

    const key = `chat:og:${createHash("sha1").update(normalized).digest("hex")}`;
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        return JSON.parse(cached) as OgPreview;
      }
    } catch {
      /* ignore cache errors */
    }

    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(normalized, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; ZovateBot/1.0; +https://zovate.local)",
          accept: "text/html,application/xhtml+xml",
        },
      });
      clearTimeout(t);
      if (!res.ok) return null;
      const ct = res.headers.get("content-type") ?? "";
      if (!/text\/html/i.test(ct)) return null;
      const html = await res.text();

      const title =
        metaContent(html, "og:title") ??
        metaContent(html, "twitter:title") ??
        titleTag(html);
      const description =
        metaContent(html, "og:description") ??
        metaContent(html, "twitter:description") ??
        metaContent(html, "description");
      const image =
        normalizeAbsolute(
          normalized,
          metaContent(html, "og:image") ?? metaContent(html, "twitter:image"),
        ) ?? undefined;
      const siteName = metaContent(html, "og:site_name");

      const payload: OgPreview = {
        url: normalized,
        ...(title ? { title } : {}),
        ...(description ? { description } : {}),
        ...(image ? { image } : {}),
        ...(siteName ? { siteName } : {}),
      };

      try {
        await this.redis.set(key, JSON.stringify(payload), "EX", 6 * 60 * 60);
      } catch {
        /* ignore */
      }

      // If we got nothing useful, skip.
      if (!payload.title && !payload.description && !payload.image) {
        return null;
      }
      return payload;
    } catch (e) {
      this.logger.debug(
        `OG fetch failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    }
  }
}

