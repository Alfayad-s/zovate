"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getCaretClientRect,
  getSerializedCaretOffset,
  populateMentionEditor,
  serializeMentionEditor,
  setSerializedCaretOffset,
} from "@/lib/task-mention-editor";
import type { WorkspaceMember } from "@/lib/workspaces-api";
import { cn } from "@/lib/utils";

function memberLabel(m: WorkspaceMember) {
  return m.user.fullName?.trim() || m.user.email;
}

function filterMembers(members: WorkspaceMember[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return members;
  return members.filter((m) => {
    const name = (m.user.fullName ?? "").toLowerCase();
    const email = m.user.email.toLowerCase();
    return name.includes(q) || email.includes(q);
  });
}

type MentionState = {
  at: number;
  query: string;
};

export function TaskAssigneeMentionTextarea({
  value,
  onChange,
  assigneeUserIds,
  onAssigneeUserIdsChange,
  members,
  disabled,
  placeholder,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  assigneeUserIds: string[];
  onAssigneeUserIdsChange: (next: string[]) => void;
  members: WorkspaceMember[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isFocusedRef = useRef(false);
  const [mention, setMention] = useState<MentionState | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const filtered = useMemo(
    () => (mention ? filterMembers(members, mention.query) : []),
    [mention, members],
  );

  useEffect(() => {
    setActiveIdx(0);
  }, [mention?.at, mention?.query, filtered.length]);

  const updateMentionUi = useCallback(
    (serialized: string, caret: number) => {
      const before = serialized.slice(0, caret);
      const match = before.match(/(^|\s)@([^\s@]*)$/);
      if (match) {
        const q = match[2] ?? "";
        const at = caret - q.length - 1;
        setMention({ at, query: q });
        requestAnimationFrame(() => {
          const rect = getCaretClientRect();
          if (rect) {
            setMenuPos({
              top: rect.bottom + 4,
              left: rect.left,
            });
          }
        });
      } else {
        setMention(null);
        setMenuPos(null);
      }
    },
    [],
  );

  const syncFromEditor = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const serialized = serializeMentionEditor(el);
    onChange(serialized);
    const caret = getSerializedCaretOffset(el);
    updateMentionUi(serialized, caret);
  }, [onChange, updateMentionUi]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el || isFocusedRef.current) return;
    const current = serializeMentionEditor(el);
    if (current === value) {
      if (!value && el.childNodes.length === 0) {
        populateMentionEditor(el, "", members);
      }
      return;
    }
    populateMentionEditor(el, value, members);
  }, [value, members]);

  const onInput = () => {
    syncFromEditor();
  };

  const pickMember = (m: WorkspaceMember) => {
    const el = editorRef.current;
    if (!el || !mention) return;

    const s = serializeMentionEditor(el);
    const caret = getSerializedCaretOffset(el);
    const before = s.slice(0, mention.at);
    const after = s.slice(caret);
    const label = memberLabel(m).replace(/\]/g, "");
    const insert = `@[${label}](m:${m.userId}) `;
    const next = before + insert + after;
    onChange(next);
    populateMentionEditor(el, next, members);

    if (!assigneeUserIds.includes(m.userId)) {
      onAssigneeUserIdsChange([...assigneeUserIds, m.userId]);
    }

    setMention(null);
    setMenuPos(null);
    requestAnimationFrame(() => {
      const node = editorRef.current;
      if (!node) return;
      node.focus();
      setSerializedCaretOffset(node, before.length + insert.length);
    });
  };

  const removeAssignee = (userId: string) => {
    onAssigneeUserIdsChange(assigneeUserIds.filter((id) => id !== userId));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!mention || filtered.length === 0) return;

    if (e.key === "Escape") {
      e.preventDefault();
      setMention(null);
      setMenuPos(null);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % filtered.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      pickMember(filtered[activeIdx]!);
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    syncFromEditor();
  };

  const showPlaceholder = !value?.trim();

  return (
    <div className="space-y-2">
      <div className="relative">
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline
          contentEditable={!disabled}
          data-placeholder={placeholder}
          suppressContentEditableWarning
          onInput={onInput}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onBlur={() => {
            isFocusedRef.current = false;
          }}
          onClick={() => {
            const el = editorRef.current;
            if (!el) return;
            const s = serializeMentionEditor(el);
            const caret = getSerializedCaretOffset(el);
            updateMentionUi(s, caret);
          }}
          className={cn(
            "relative z-[1] min-h-[6rem] w-full resize-y overflow-auto rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/40 disabled:opacity-50",
            className,
          )}
        />
        {showPlaceholder ? (
          <div className="pointer-events-none absolute left-3 top-2 z-0 max-w-[calc(100%-1.5rem)] text-sm text-neutral-400">
            {placeholder}
          </div>
        ) : null}

        {mention && filtered.length > 0 && menuPos ? (
          <ul
            className="fixed z-[200] max-h-48 min-w-[12rem] max-w-[min(100vw-2rem,18rem)] overflow-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
            style={{ top: menuPos.top, left: menuPos.left }}
            role="listbox"
          >
            {filtered.map((m, i) => (
              <li key={m.id} role="option" aria-selected={i === activeIdx}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                    i === activeIdx
                      ? "bg-neutral-100 text-neutral-900"
                      : "text-neutral-800 hover:bg-neutral-50",
                  )}
                  onMouseDown={(ev) => {
                    ev.preventDefault();
                    pickMember(m);
                  }}
                >
                  {m.user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.user.avatarUrl}
                      alt=""
                      className="size-7 shrink-0 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-semibold text-neutral-700">
                      {memberLabel(m).slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{memberLabel(m)}</span>
                    <span className="block truncate text-xs text-neutral-500">
                      {m.user.email}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : mention &&
          filtered.length === 0 &&
          members.length > 0 &&
          mention.query.length > 0 &&
          menuPos ? (
          <div
            className="fixed z-[200] rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-500 shadow-lg"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            No one matches &ldquo;{mention.query}&rdquo;
          </div>
        ) : null}
      </div>

      {assigneeUserIds.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {assigneeUserIds.map((id) => {
            const m = members.find((x) => x.userId === id);
            const label = m ? memberLabel(m) : id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => removeAssignee(id)}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-800 hover:bg-neutral-100"
                title="Remove assignee"
              >
                <span className="truncate">{label}</span>
                <span className="text-neutral-400" aria-hidden>
                  ×
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
