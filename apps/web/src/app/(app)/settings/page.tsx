import { Suspense } from "react";

import { SettingsView } from "@/components/settings/settings-view";

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 md:p-10 text-sm text-muted-foreground">
          Loading settings…
        </div>
      }
    >
      <SettingsView />
    </Suspense>
  );
}
