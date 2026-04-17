"use client";

import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  PRESET_CIRCLE_PATHS,
  PRESET_MEMOJI_PATHS,
  PRESET_POPOUT_PATHS,
  avatarMatchesPreset,
  presetAvatarAbsoluteUrl,
} from "@/lib/preset-avatars";
import { cn } from "@/lib/utils";

type AvatarTab = "popout" | "circle" | "memoji";

type PresetAvatarPickerProps = {
  currentAvatarUrl: string | null | undefined;
  disabled?: boolean;
  onSelectPreset: (absoluteUrl: string) => void;
  isPending?: boolean;
};

export function PresetAvatarPicker({
  currentAvatarUrl,
  disabled,
  onSelectPreset,
  isPending,
}: PresetAvatarPickerProps) {
  const [tab, setTab] = useState<AvatarTab>("popout");
  const [showAll, setShowAll] = useState(false);

  const paths =
    tab === "popout"
      ? PRESET_POPOUT_PATHS
      : tab === "circle"
        ? PRESET_CIRCLE_PATHS
        : PRESET_MEMOJI_PATHS;

  const initialCount = 24;
  const visiblePaths = useMemo(
    () => (showAll ? paths : paths.slice(0, initialCount)),
    [paths, showAll],
  );

  const switchTab = (next: AvatarTab) => {
    setTab(next);
    setShowAll(false);
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Choose an avatar</p>
        <p className="text-xs text-muted-foreground">
          {tab === "popout"
            ? "Pop-out style illustrations. Images load as you scroll."
            : tab === "circle"
              ? "Circular frame presets. Images load as you scroll."
              : "Memoji-style character pack. Images load as you scroll."}
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-neutral-200">
        <button
          type="button"
          onClick={() => switchTab("popout")}
          className={cn(
            "border-b-2 px-2.5 py-2 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
            tab === "popout"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-neutral-800",
          )}
        >
          Pop-out
        </button>
        <button
          type="button"
          onClick={() => switchTab("circle")}
          className={cn(
            "border-b-2 px-2.5 py-2 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
            tab === "circle"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-neutral-800",
          )}
        >
          Circle
        </button>
        <button
          type="button"
          onClick={() => switchTab("memoji")}
          className={cn(
            "border-b-2 px-2.5 py-2 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
            tab === "memoji"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-neutral-800",
          )}
        >
          Memoji
        </button>
      </div>

      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10">
        {visiblePaths.map((path) => {
          const src = presetAvatarAbsoluteUrl(path);
          const selected = avatarMatchesPreset(currentAvatarUrl, path);
          return (
            <button
              key={path}
              type="button"
              disabled={disabled || isPending}
              title="Use this avatar"
              onClick={() => onSelectPreset(src)}
              className={cn(
                "relative aspect-square overflow-hidden rounded-full border-0 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selected
                  ? "ring-2 ring-primary/25"
                  : "ring-0 hover:opacity-90",
                (disabled || isPending) && "opacity-50",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-full object-cover"
              />
            </button>
          );
        })}
      </div>
      {paths.length > initialCount ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-lg"
          disabled={disabled || isPending}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Show fewer" : `Show all (${paths.length})`}
        </Button>
      ) : null}
      {isPending ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Updating avatar…
        </p>
      ) : null}
    </div>
  );
}
