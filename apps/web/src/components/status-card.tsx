import type { HealthStatus } from "@repo/shared-types";

export function ApiStatusCard({ health }: { health: HealthStatus | null }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
      <h2 className="text-sm font-medium">API status</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {health ? (
          <>
            Backend reports{" "}
            <span className="font-medium text-foreground">{health.status}</span>{" "}
            at {new Date(health.timestamp).toLocaleString()}.
          </>
        ) : (
          "Could not reach the API. Start `pnpm dev` with the api app or set NEXT_PUBLIC_API_URL."
        )}
      </p>
    </div>
  );
}
