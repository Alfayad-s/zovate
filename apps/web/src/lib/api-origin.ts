/** HTTP origin for the API (no `/api` path). Used for Socket.IO. */
export function getApiOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
  try {
    return new URL(raw).origin;
  } catch {
    return "http://localhost:4000";
  }
}
