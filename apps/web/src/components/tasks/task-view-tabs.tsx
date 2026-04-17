"use client";

import { Calendar, LayoutGrid, Table2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

export type TaskViewMode = "kanban" | "calendar" | "table";

const TABS: {
  id: TaskViewMode;
  label: string;
  icon: typeof LayoutGrid;
}[] = [
  { id: "kanban", label: "Kanban board", icon: LayoutGrid },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "table", label: "Table", icon: Table2 },
];

export function parseTaskViewParam(raw: string | null): TaskViewMode {
  if (raw === "calendar") return "calendar";
  if (raw === "table") return "table";
  return "kanban";
}

function tasksViewHref(
  view: TaskViewMode,
  searchParams: { toString(): string },
): string {
  const p = new URLSearchParams(searchParams.toString());
  if (view === "kanban") p.delete("view");
  else p.set("view", view);
  const qs = p.toString();
  return qs ? `/tasks?${qs}` : "/tasks";
}

const tabTriggerClass = (selected: boolean, compact?: boolean) =>
  cn(
    "inline-flex items-center gap-1.5 rounded-full font-medium transition-colors",
    compact
      ? "px-2.5 py-1.5 text-xs sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
      : "gap-2 px-3 py-2 text-sm",
    selected
      ? "bg-white text-neutral-900 shadow-sm"
      : "text-neutral-600 hover:bg-white/70 hover:text-neutral-900",
  );

/** Tabs in the app header; reads/writes `?view=` on `/tasks`. */
export function TaskViewTabsHeader() {
  const searchParams = useSearchParams();
  const current = parseTaskViewParam(searchParams.get("view"));

  return (
    <div
      role="tablist"
      aria-label="Task view"
      className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl  p-0.5 sm:p-1"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const selected = current === tab.id;
        return (
          <Link
            key={tab.id}
            href={tasksViewHref(tab.id, searchParams)}
            scroll={false}
            replace
            role="tab"
            aria-selected={selected}
            className={tabTriggerClass(selected, true)}
          >
            <Icon className="size-3.5 shrink-0 sm:size-4" strokeWidth={1.75} />
            <span className="hidden sm:inline">{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function TaskViewTabs({
  value,
  onChange,
}: {
  value: TaskViewMode;
  onChange: (next: TaskViewMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Task view"
      className="inline-flex items-center gap-0.5 rounded-full border border-neutral-200/90 bg-neutral-50/90 p-1"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const selected = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={tabTriggerClass(selected, false)}
            onClick={() => onChange(tab.id)}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.75} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
