"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";

import { CreateWorkspaceForm } from "@/components/workspace/create-workspace-form";
import { cn } from "@/lib/utils";

/** Matches `AuthMediaCarousel`: subtle line grid on white. */
const authLeftGridStyle: CSSProperties = {
  backgroundImage: `linear-gradient(to right, rgb(0 0 0 / 0.06) 1px, transparent 1px),
    linear-gradient(to bottom, rgb(0 0 0 / 0.06) 1px, transparent 1px)`,
  backgroundSize: "32px 32px",
};

export default function CreateWorkspacePage() {
  const router = useRouter();

  return (
    <div className="relative min-h-dvh w-full bg-[#fff]">
      <div
        className="pointer-events-none absolute inset-0"
        style={authLeftGridStyle}
        aria-hidden
      />
      <div className="relative flex min-h-dvh w-full flex-col items-center justify-center px-6 py-12 text-center sm:px-10 lg:px-14 xl:px-20">
        <div className="w-full pb-8">
          <div className="flex w-full justify-center overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] sm:overflow-x-visible [&::-webkit-scrollbar]:hidden">
            <h1
              className={cn(
                "inline-block max-w-none whitespace-nowrap font-bold tracking-tight text-neutral-900",
                /* Same scale as `AuthTypingHeadline` on the login media panel */
                "text-[2rem] leading-[1.18] sm:text-[2.5rem] sm:leading-[1.14] lg:text-[3rem] lg:leading-[1.1] xl:text-[3.5rem] xl:leading-[1.08]",
              )}
            >
              Create your first{" "}
              <span className="text-primary">workspace</span>
            </h1>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[420px] space-y-6">
          <p className="text-pretty text-[15px] leading-relaxed text-neutral-500">
            A workspace groups your projects and tasks. You can invite members
            later.
          </p>
          <div className="rounded-2xl bg-white/80 p-6 text-left">
            <CreateWorkspaceForm
              fieldSize="lg"
              submitLabel="Continue"
              onCreated={() => router.replace("/projects")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
