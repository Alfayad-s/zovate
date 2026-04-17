import { BadRequestException } from "@nestjs/common";

/** Static avatars under `public/avatars/{Pop-out,Circle,Memoji}/`. */
const PRESET_AVATAR_PATH =
  /^\/avatars\/(Pop-out|Circle|Memoji)\/[^/]+\.(png|jpe?g|webp|gif)$/i;

/**
 * Ensures the URL points to a preset avatar on the configured frontend origin.
 */
export function assertPresetAvatarUrl(
  raw: string,
  frontendUrl: string | undefined,
): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new BadRequestException("Invalid avatar URL");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new BadRequestException("Invalid avatar URL");
  }
  if (!PRESET_AVATAR_PATH.test(parsed.pathname)) {
    throw new BadRequestException(
      "Avatar must be chosen from the built-in gallery",
    );
  }
  const base = (frontendUrl ?? "http://localhost:3000").replace(/\/$/, "");
  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(base).origin;
  } catch {
    expectedOrigin = "http://localhost:3000";
  }
  if (parsed.origin !== expectedOrigin) {
    throw new BadRequestException("Avatar URL must match this application");
  }
  return trimmed;
}
