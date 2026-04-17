"use client";

import { usePathname, useSearchParams } from "next/navigation";

export function getHeaderPageTitle(
  pathname: string,
  settingsTab: string | null,
): string {
  if (pathname === "/") return "Overview";
  if (pathname.startsWith("/projects")) return "Projects";
  if (pathname.startsWith("/tasks")) return "Tasks";
  if (pathname.startsWith("/settings")) {
    if (settingsTab === "labels") return "Labels";
    if (settingsTab === "workspace") return "Workspace";
    return "Account";
  }
  if (pathname.startsWith("/workspace/members")) return "Members";
  if (pathname.startsWith("/create/workspace")) return "Create workspace";
  return "Zovate";
}

/** Reads `tab` for `/settings` — wrap in `<Suspense>` when used in layouts. */
export function AppHeaderPageTitle() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const settingsTab = searchParams.get("tab");
  const title = getHeaderPageTitle(pathname, settingsTab);

  return (
    <p
      className="truncate text-center text-sm font-semibold tracking-tight text-neutral-900 sm:text-base"
      title={title}
    >
      {title}
    </p>
  );
}
