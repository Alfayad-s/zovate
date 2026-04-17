/**
 * Returns a safe in-app path for post-login redirects (open redirects blocked).
 */
export function getSafeRedirectTarget(from: string | null | undefined): string {
  if (!from || typeof from !== "string") return "/";
  const trimmed = from.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/";
  if (trimmed.includes("\\")) return "/";
  const pathOnly = trimmed.split("?")[0] ?? "";
  if (!pathOnly || pathOnly.includes("//")) return "/";
  return pathOnly;
}
