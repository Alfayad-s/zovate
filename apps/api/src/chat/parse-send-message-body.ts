const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

/** Max stored length after trim (matches reasonable chat body size). */
export const CHAT_MESSAGE_MAX_LENGTH = 16_000;

export type SendMessageParseError = "bad_request";

export type SendMessageParsed =
  | {
      ok: true;
      channelId: string;
      content: string;
      attachments: {
        url: string;
        name: string;
        mimeType: string;
        size: number;
        kind: "image" | "video" | "file";
      }[];
    }
  | { ok: false; error: SendMessageParseError };

/**
 * Validates `send_message` payload:
 * - `channelId` (UUID)
 * - `content` (optional, length cap)
 * - `attachments` (optional)
 * Requires at least one of: non-empty content or >=1 attachment.
 */
export function parseSendMessageBody(body: unknown): SendMessageParsed {
  if (body === null || typeof body !== "object") {
    return { ok: false, error: "bad_request" };
  }
  const o = body as Record<string, unknown>;
  const channelIdRaw = o.channelId;
  const contentRaw = o.content;
  if (typeof channelIdRaw !== "string" || typeof contentRaw !== "string") {
    return { ok: false, error: "bad_request" };
  }
  const channelId = channelIdRaw.trim();
  if (!isUuid(channelId)) {
    return { ok: false, error: "bad_request" };
  }
  const content = contentRaw.trim();
  if (content.length > CHAT_MESSAGE_MAX_LENGTH) {
    return { ok: false, error: "bad_request" };
  }
  const attachmentsRaw = o.attachments;
  const attachments: {
    url: string;
    name: string;
    mimeType: string;
    size: number;
    kind: "image" | "video" | "file";
  }[] = [];
  if (attachmentsRaw != null) {
    if (!Array.isArray(attachmentsRaw)) {
      return { ok: false, error: "bad_request" };
    }
    for (const item of attachmentsRaw) {
      if (!item || typeof item !== "object") return { ok: false, error: "bad_request" };
      const it = item as Record<string, unknown>;
      const url = typeof it.url === "string" ? it.url.trim() : "";
      const name = typeof it.name === "string" ? it.name.trim() : "";
      const mimeType = typeof it.mimeType === "string" ? it.mimeType.trim() : "";
      const size = typeof it.size === "number" ? it.size : Number.NaN;
      const kind =
        it.kind === "image" || it.kind === "video" || it.kind === "file" ? it.kind : null;
      if (!url || !name || !mimeType || !Number.isFinite(size) || size <= 0 || !kind) {
        return { ok: false, error: "bad_request" };
      }
      attachments.push({ url, name, mimeType, size, kind });
    }
  }

  if (content.length === 0 && attachments.length === 0) {
    return { ok: false, error: "bad_request" };
  }

  return { ok: true, channelId, content, attachments };
}
