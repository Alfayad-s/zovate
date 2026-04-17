import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { AuthMediaCarousel } from "@/components/auth/auth-media-carousel";
import { cn } from "@/lib/utils";

export function AuthSplitShell({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid min-h-dvh w-full grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]",
        className,
      )}
    >
      <div className="relative min-h-[14rem] bg-[#fff] lg:min-h-dvh lg:sticky lg:top-0 lg:h-dvh">
        <AuthMediaCarousel />
      </div>

      <div className="relative flex flex-col justify-center bg-[#fff] px-6 py-12 sm:px-10 lg:px-14 xl:px-20">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgb(0 0 0 / 0.05) 1px, transparent 0)`,
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative mx-auto w-full max-w-[420px]">
          <Link
            href="/"
            className="mb-10 inline-flex items-center transition-opacity hover:opacity-90"
            aria-label="Zovate home"
          >
            <Image
              src="/logo/logo-with-text.svg"
              alt="Zovate"
              width={220}
              height={88}
              className="h-16 w-auto max-w-[240px] object-contain object-left sm:h-[4.5rem]"
              priority
            />
          </Link>
          <div className="space-y-2 pb-8">
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-neutral-900 sm:text-[2rem] sm:leading-tight">
              {title}
            </h1>
            <p className="text-pretty text-[15px] leading-relaxed text-neutral-500">
              {description}
            </p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
