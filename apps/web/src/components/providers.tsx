"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { AppToaster } from "@/components/app-toaster";
import { AuthCookieSync } from "@/components/auth-cookie-sync";
import { ProjectProvider } from "@/contexts/project-context";
import { WorkspaceProvider } from "@/contexts/workspace-context";
import { NotificationSoundBridge } from "@/components/notification-sound-bridge";
import { WorkspaceRealtimeBridge } from "@/components/workspace-realtime-bridge";
import { getAuthErrorMessage } from "@/lib/auth-errors";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
          mutations: {
            onError: (error, _variables, _context, mutation) => {
              const meta = mutation.meta as
                | { skipGlobalErrorToast?: boolean }
                | undefined;
              if (meta?.skipGlobalErrorToast) return;
              toast.error(
                getAuthErrorMessage(error, "Something went wrong"),
              );
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider>
        <WorkspaceRealtimeBridge />
        <NotificationSoundBridge />
        <ProjectProvider>
          <AuthCookieSync />
          {children}
          <AppToaster />
        </ProjectProvider>
      </WorkspaceProvider>
    </QueryClientProvider>
  );
}
