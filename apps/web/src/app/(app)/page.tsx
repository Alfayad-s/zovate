import type { HealthStatus } from "@repo/shared-types";

import { ApiStatusCard } from "@/components/status-card";

export default async function HomePage() {
  let health: HealthStatus | null = null;
  try {
    const base =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
    const res = await fetch(`${base}/auth/health`, {
      cache: "no-store",
    });
    if (res.ok) {
      health = (await res.json()) as HealthStatus;
    }
  } catch {
    health = null;
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-10">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Workspace</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome to Zovate
        </h1>
        <p className="mt-2 max-w-prose text-muted-foreground">
          Your AI-integrated collaborative workspace. Use the sidebar to
          navigate; connect the API to unlock live data.
        </p>
      </div>
      <ApiStatusCard health={health} />
    </div>
  );
}
