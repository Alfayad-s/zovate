import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

@Injectable()
export class SupabaseStorageService {
  private readonly client: SupabaseClient | null;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>("SUPABASE_URL");
    const key = this.config.get<string>("SUPABASE_SERVICE_ROLE_KEY");
    this.client =
      url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  private bucketName(): string {
    return this.config.get<string>("SUPABASE_STORAGE_BUCKET") ?? "avatars";
  }

  private throwUploadError(
    error: { message: string },
    bucket: string,
  ): never {
    const msg = error.message ?? "";
    if (/bucket not found/i.test(msg)) {
      throw new ServiceUnavailableException(
        `Supabase Storage has no bucket named "${bucket}". Create it in the Supabase dashboard: Storage → New bucket → name "${bucket}" (or set SUPABASE_STORAGE_BUCKET to an existing bucket). For public URLs used by the app, allow public read on that bucket.`,
      );
    }
    throw new BadRequestException(`Upload failed: ${msg}`);
  }

  private async uploadPublicImage(
    objectPath: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        "File storage is not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).",
      );
    }
    if (!ALLOWED_MIME.has(mimeType)) {
      throw new BadRequestException(
        "Invalid image type. Use JPEG, PNG, WebP, or GIF.",
      );
    }

    const bucket = this.bucketName();
    const { error } = await this.client.storage
      .from(bucket)
      .upload(objectPath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      this.throwUploadError(error, bucket);
    }

    const { data } = this.client.storage.from(bucket).getPublicUrl(objectPath);
    return data.publicUrl;
  }

  private async uploadPublicObject(params: {
    objectPath: string;
    buffer: Buffer;
    mimeType: string;
  }): Promise<string> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        "File storage is not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).",
      );
    }
    const bucket = this.bucketName();
    const { error } = await this.client.storage
      .from(bucket)
      .upload(params.objectPath, params.buffer, {
        contentType: params.mimeType,
        upsert: false,
      });

    if (error) {
      this.throwUploadError(error, bucket);
    }

    const { data } = this.client.storage.from(bucket).getPublicUrl(params.objectPath);
    return data.publicUrl;
  }

  /**
   * Uploads avatar bytes to the configured bucket and returns the public URL.
   * Ensure the bucket exists and is public (or use signed URLs separately).
   */
  async uploadAvatarObject(
    userId: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const ext =
      mimeType === "image/png"
        ? "png"
        : mimeType === "image/webp"
          ? "webp"
          : mimeType === "image/gif"
            ? "gif"
            : "jpg";
    const path = `${userId}/${randomUUID()}.${ext}`;
    return this.uploadPublicImage(path, buffer, mimeType);
  }

  /**
   * Workspace logo in the same bucket under `workspace-logos/{workspaceId}/…`.
   */
  async uploadWorkspaceLogoObject(
    workspaceId: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const ext =
      mimeType === "image/png"
        ? "png"
        : mimeType === "image/webp"
          ? "webp"
          : mimeType === "image/gif"
            ? "gif"
            : "jpg";
    const path = `workspace-logos/${workspaceId}/${randomUUID()}.${ext}`;
    return this.uploadPublicImage(path, buffer, mimeType);
  }

  /**
   * Uploads any chat attachment (images, videos, documents) to the configured bucket.
   * Bucket must allow public read for direct URLs to work in the web app.
   */
  async uploadChatAttachmentObject(params: {
    channelId: string;
    originalName: string;
    buffer: Buffer;
    mimeType: string;
  }): Promise<string> {
    const safeName = params.originalName
      .trim()
      .replace(/[^\w.\-()+\s]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 64);
    const path = `chat-attachments/${params.channelId}/${randomUUID()}-${safeName || "file"}`;
    return this.uploadPublicObject({
      objectPath: path,
      buffer: params.buffer,
      mimeType: params.mimeType || "application/octet-stream",
    });
  }
}
