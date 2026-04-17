"use client";

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { Toaster } from "sonner";

/**
 * Pill-shaped toast: icon + text row vertically centered; close button centered
 * on the same axis (Sonner renders [close][icon][content]).
 */
const BASE =
  "group !relative !flex !items-center !gap-3 !rounded-full !border !px-4 !py-3 !pr-12 !shadow-sm !min-h-[3.25rem] !w-[min(380px,calc(100vw-1.5rem))]";

const ICON_WRAP =
  "flex size-9 shrink-0 items-center justify-center rounded-full";

export function AppToaster() {
  return (
    <Toaster
      theme="light"
      position="bottom-center"
      closeButton
      richColors={false}
      expand={false}
      gap={8}
      visibleToasts={4}
      offset={{
        bottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))",
      }}
      mobileOffset={{
        bottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
      }}
      toastOptions={{
        duration: 4500,
        classNames: {
          toast: `${BASE}
            !border-black/[0.06]
            !bg-white
            !shadow-[0_2px_12px_rgba(0,0,0,0.06),0_0_0_0.5px_rgba(0,0,0,0.04)]`,
          content:
            "!m-0 !min-w-0 !flex-1 !flex-col !justify-center !gap-0.5 !self-center !py-0",
          title:
            "!block !text-[13px] !font-medium !leading-[1.35] !tracking-[-0.01em] !text-neutral-900",
          description:
            "!mt-0 !text-[12px] !font-normal !leading-relaxed !text-neutral-500",
          success: `${BASE}
            !border-emerald-500/[0.15]
            !bg-white
            !shadow-[0_2px_12px_rgba(0,0,0,0.05),0_0_0_0.5px_rgba(16,185,129,0.1)]`,
          error: `${BASE}
            !border-red-500/[0.15]
            !bg-white
            !shadow-[0_2px_12px_rgba(0,0,0,0.05),0_0_0_0.5px_rgba(239,68,68,0.1)]`,
          warning: `${BASE}
            !border-amber-500/[0.15]
            !bg-white
            !shadow-[0_2px_12px_rgba(0,0,0,0.05),0_0_0_0.5px_rgba(245,158,11,0.1)]`,
          info: `${BASE}
            !border-blue-500/[0.15]
            !bg-white
            !shadow-[0_2px_12px_rgba(0,0,0,0.05),0_0_0_0.5px_rgba(59,130,246,0.1)]`,
          closeButton: `
            !absolute !right-3 !top-1/2 !left-auto
            !size-[26px] !shrink-0
            !-translate-y-1/2 !translate-x-0
            !rounded-full !border-0
            !bg-neutral-100/90 !text-neutral-500
            transition-colors duration-150
            hover:!bg-neutral-200/90 hover:!text-neutral-800`,
          icon: "!m-0 !shrink-0 !self-center",
        },
      }}
      icons={{
        success: (
          <span className={`${ICON_WRAP} bg-emerald-50 ring-1 ring-emerald-500/10`}>
            <CheckCircle2
              className="size-[17px] text-emerald-600"
              strokeWidth={2.25}
              aria-hidden
            />
          </span>
        ),
        error: (
          <span className={`${ICON_WRAP} bg-red-50 ring-1 ring-red-500/10`}>
            <XCircle
              className="size-[17px] text-red-600"
              strokeWidth={2.25}
              aria-hidden
            />
          </span>
        ),
        warning: (
          <span className={`${ICON_WRAP} bg-amber-50 ring-1 ring-amber-500/10`}>
            <AlertTriangle
              className="size-[17px] text-amber-600"
              strokeWidth={2.25}
              aria-hidden
            />
          </span>
        ),
        info: (
          <span className={`${ICON_WRAP} bg-blue-50 ring-1 ring-blue-500/10`}>
            <Info
              className="size-[17px] text-blue-600"
              strokeWidth={2.25}
              aria-hidden
            />
          </span>
        ),
      }}
    />
  );
}
