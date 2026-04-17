import { AppShell } from "@/components/app-shell";
import { ProjectRouteGate } from "@/components/projects/project-route-gate";
import { WorkspaceOnboardingGate } from "@/components/workspace/workspace-onboarding-gate";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkspaceOnboardingGate>
      <ProjectRouteGate>
        <AppShell>{children}</AppShell>
      </ProjectRouteGate>
    </WorkspaceOnboardingGate>
  );
}
