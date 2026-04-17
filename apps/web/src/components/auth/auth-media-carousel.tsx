"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AUTH_SLIDES } from "@/components/auth/auth-media";
import { AuthTypingHeadline } from "@/components/auth/auth-typing-headline";
import { cn } from "@/lib/utils";

const AUTO_MS = 9000;

export function AuthMediaCarousel() {
  const [index, setIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const len = AUTH_SLIDES.length;
  const go = useCallback(
    (delta: number) => {
      if (len === 0) return;
      setIndex((i) => (i + delta + len) % len);
    },
    [len],
  );

  useEffect(() => {
    if (len === 0) return;
    const t = window.setInterval(() => go(1), AUTO_MS);
    return () => window.clearInterval(t);
  }, [go, len]);

  const slide =
    len > 0 ? AUTH_SLIDES[index % len] : undefined;

  useEffect(() => {
    if (!slide || slide.kind !== "video" || !videoRef.current) return;
    void videoRef.current.play().catch(() => {
      /* autoplay policies */
    });
  }, [slide]);

  if (!slide) {
    return (
      <div className="flex h-full min-h-[12rem] items-center justify-center bg-[#fff] text-sm text-neutral-400">
        No media configured
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-[12rem] w-full flex-col bg-[#fff] lg:min-h-0">
      {/* subtle grid on white */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(to right, rgb(0 0 0 / 0.06) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(0 0 0 / 0.06) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10 shrink-0 px-6 pb-2 pt-8 sm:px-10 sm:pt-10 sm:pb-4">
        <AuthTypingHeadline
          key={index}
          segments={slide.headline}
          slideKey={index}
        />
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-6 pt-2 sm:p-10">
        <div
          className="relative aspect-[4/3] w-full max-w-lg overflow-hidden rounded-[1.75rem] bg-[#fff] shadow-[0_20px_60px_-16px_rgba(0,0,0,0.12)] ring-1 ring-neutral-200/90"
          key={index}
        >
          {slide.kind === "video" ? (
            <video
              ref={videoRef}
              src={slide.src}
              className="h-full w-full object-cover"
              muted
              playsInline
              loop
              autoPlay
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={slide.src}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-between gap-3 bg-[#fff] px-4 pb-6 pt-2 sm:px-8">
        <button
          type="button"
          onClick={() => go(-1)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-[#fff] text-neutral-700 shadow-sm transition hover:bg-neutral-50"
          aria-label="Previous slide"
        >
          <ChevronLeft className="size-5" strokeWidth={1.5} />
        </button>

        <div className="flex flex-1 flex-col items-center gap-2">
          <p className="text-center text-xs font-medium tracking-wide text-neutral-500">
            {slide.label}
          </p>
          <div className="flex items-center justify-center gap-1.5">
            {AUTH_SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === index
                    ? "w-6 bg-primary"
                    : "w-1.5 bg-neutral-300 hover:bg-neutral-400",
                )}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => go(1)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-[#fff] text-neutral-700 shadow-sm transition hover:bg-neutral-50"
          aria-label="Next slide"
        >
          <ChevronRight className="size-5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
