"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  type HeadlineSegment,
  headlinePlainText,
} from "@/components/auth/auth-media";
import { cn } from "@/lib/utils";

function renderDisplayedHeadline(
  displayed: string,
  segments: HeadlineSegment[],
): ReactNode {
  let remaining = displayed.length;
  if (remaining <= 0) return null;
  const nodes: ReactNode[] = [];
  let k = 0;
  for (const seg of segments) {
    if (remaining <= 0) break;
    if (seg.text.length === 0) continue;
    const take = Math.min(seg.text.length, remaining);
    const chunk = seg.text.slice(0, take);
    remaining -= take;
    if (chunk.length === 0) continue;
    if (seg.accent) {
      nodes.push(
        <span key={k++} className="text-primary">
          {chunk}
        </span>,
      );
    } else {
      nodes.push(<span key={k++}>{chunk}</span>);
    }
  }
  return <>{nodes}</>;
}

type AuthTypingHeadlineProps = {
  segments: HeadlineSegment[];
  /** Changes when the slide changes — restarts typing */
  slideKey: number;
  className?: string;
};

export function AuthTypingHeadline({
  segments,
  slideKey,
  className,
}: AuthTypingHeadlineProps) {
  const fullText = useMemo(() => headlinePlainText(segments), [segments]);

  const [displayed, setDisplayed] = useState("");
  const [cursorOn, setCursorOn] = useState(true);

  useEffect(() => {
    setDisplayed("");
    let cancelled = false;
    let timeoutId: number | undefined;

    const step = (nextLen: number) => {
      if (cancelled) return;
      setDisplayed(fullText.slice(0, nextLen));
      if (nextLen >= fullText.length) return;
      const ch = fullText[nextLen];
      const delay =
        ch === " "
          ? 100
          : ch === "." || ch === ","
            ? 280
            : 38 + Math.floor(Math.random() * 18);
      timeoutId = window.setTimeout(() => step(nextLen + 1), delay);
    };

    timeoutId = window.setTimeout(() => step(1), 220);
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [fullText, slideKey]);

  const isTyping = displayed.length < fullText.length;

  useEffect(() => {
    if (!isTyping) {
      setCursorOn(false);
      return;
    }
    const id = window.setInterval(() => {
      setCursorOn((c) => !c);
    }, 520);
    return () => window.clearInterval(id);
  }, [isTyping]);

  return (
    <h2
      className={cn(
        "min-h-[7rem] text-balance font-bold tracking-tight text-neutral-900 sm:min-h-[8.5rem] lg:min-h-[10rem]",
        "text-[2rem] leading-[1.18] sm:text-[2.5rem] sm:leading-[1.14] lg:text-[3rem] lg:leading-[1.1] xl:text-[3.5rem] xl:leading-[1.08]",
        className,
      )}
    >
      {renderDisplayedHeadline(displayed, segments)}
      <span
        className={cn(
          "ml-0.5 inline-block w-1 translate-y-px align-baseline text-primary sm:w-[5px]",
          isTyping ? (cursorOn ? "opacity-100" : "opacity-25") : "opacity-0",
        )}
        aria-hidden
      >
        |
      </span>
    </h2>
  );
}
