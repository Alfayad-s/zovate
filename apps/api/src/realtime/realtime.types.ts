/** Client refetches React Query caches based on these scopes. */
export type InvalidateScope =
  | "tasks"
  | "statuses"
  | "notifications"
  | "members"
  | "labels"
  | "comments";
