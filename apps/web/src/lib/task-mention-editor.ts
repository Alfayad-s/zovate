import { parseTaskDescriptionMentions } from "@/lib/task-description-mentions";
import type { WorkspaceMember } from "@/lib/workspaces-api";

/** Serialize editor DOM to stored @[label](m:uuid) string. */
export function serializeMentionEditor(root: HTMLElement): string {
  let out = "";
  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (el.tagName === "BR") {
      out += "\n";
      return;
    }
    if (el.dataset.userId && el.dataset.label !== undefined) {
      const label = el.dataset.label ?? "";
      const id = el.dataset.userId ?? "";
      out += `@[${label}](m:${id})`;
      return;
    }
    for (let i = 0; i < el.childNodes.length; i++) {
      walk(el.childNodes[i]!);
    }
  }
  for (let i = 0; i < root.childNodes.length; i++) {
    walk(root.childNodes[i]!);
  }
  return out;
}

function memberForUser(
  members: WorkspaceMember[],
  userId: string,
): WorkspaceMember | undefined {
  return members.find((m) => m.userId === userId);
}

export function createMentionChipElement(
  userId: string,
  label: string,
  avatarUrl: string | null,
): HTMLSpanElement {
  const span = document.createElement("span");
  span.contentEditable = "false";
  span.dataset.userId = userId;
  span.dataset.label = label;
  span.className =
    "mention-chip mx-0.5 inline-flex max-w-[min(100%,12rem)] select-none items-center gap-1 rounded-md border border-primary/30 bg-primary/[0.09] py-0.5 pl-0.5 pr-2 align-middle text-sm font-medium text-neutral-900 shadow-sm";

  if (avatarUrl) {
    const img = document.createElement("img");
    img.src = avatarUrl;
    img.alt = "";
    img.className = "size-5 shrink-0 rounded-full object-cover";
    img.referrerPolicy = "no-referrer";
    span.appendChild(img);
  } else {
    const initial = document.createElement("span");
    initial.className =
      "flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary";
    initial.textContent = label.trim().slice(0, 1).toUpperCase() || "?";
    span.appendChild(initial);
  }
  const name = document.createElement("span");
  name.className = "min-w-0 truncate";
  name.textContent = label;
  span.appendChild(name);
  return span;
}

/** Replace editor contents from stored string (no innerHTML). */
export function populateMentionEditor(
  container: HTMLElement,
  text: string,
  members: WorkspaceMember[],
) {
  container.replaceChildren();
  if (!text) {
    container.appendChild(document.createElement("br"));
    return;
  }
  const segments = parseTaskDescriptionMentions(text);
  for (const seg of segments) {
    if (seg.kind === "text") {
      if (seg.text) container.appendChild(document.createTextNode(seg.text));
    } else {
      const mem = memberForUser(members, seg.userId);
      const avatar = mem?.user.avatarUrl ?? null;
      container.appendChild(
        createMentionChipElement(seg.userId, seg.label, avatar),
      );
    }
  }
  if (container.childNodes.length === 0) {
    container.appendChild(document.createElement("br"));
  }
}

export function getSerializedCaretOffset(root: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  let offset = 0;
  let found = false;

  function walk(node: Node): void {
    if (found) return;
    if (node === range.endContainer) {
      if (node.nodeType === Node.TEXT_NODE) {
        offset += range.endOffset;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const hit = node as HTMLElement;
        if (hit.tagName === "BR") {
          offset += range.endOffset > 0 ? 1 : 0;
        }
      }
      found = true;
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      offset += (node.textContent ?? "").length;
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === "BR") {
        offset += 1;
        return;
      }
      if (el.dataset.userId && el.dataset.label !== undefined) {
        const label = el.dataset.label ?? "";
        const id = el.dataset.userId ?? "";
        offset += `@[${label}](m:${id})`.length;
        return;
      }
      for (let i = 0; i < node.childNodes.length; i++) {
        walk(node.childNodes[i]!);
        if (found) return;
      }
    }
  }

  for (let i = 0; i < root.childNodes.length; i++) {
    walk(root.childNodes[i]!);
    if (found) return offset;
  }
  return offset;
}

export function setSerializedCaretOffset(root: HTMLElement, target: number): void {
  const sel = window.getSelection();
  if (sel === null) return;
  const selection = sel;
  let pos = 0;
  let found = false;

  function walk(node: Node): void {
    if (found) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent ?? "").length;
      if (pos + len >= target) {
        const r = document.createRange();
        const off = Math.max(0, Math.min(target - pos, len));
        r.setStart(node, off);
        r.collapse(true);
        selection.removeAllRanges();
        selection.addRange(r);
        found = true;
        return;
      }
      pos += len;
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === "BR") {
        if (pos + 1 >= target) {
          const r = document.createRange();
          r.setStartBefore(el);
          r.collapse(true);
          selection.removeAllRanges();
          selection.addRange(r);
          found = true;
          return;
        }
        pos += 1;
        return;
      }
      if (el.dataset.userId && el.dataset.label !== undefined) {
        const label = el.dataset.label ?? "";
        const id = el.dataset.userId ?? "";
        const len = `@[${label}](m:${id})`.length;
        if (pos + len >= target) {
          const r = document.createRange();
          r.setStartAfter(el);
          r.collapse(true);
          selection.removeAllRanges();
          selection.addRange(r);
          found = true;
          return;
        }
        pos += len;
        return;
      }
      for (let i = 0; i < node.childNodes.length; i++) {
        walk(node.childNodes[i]!);
        if (found) return;
      }
    }
  }

  for (let i = 0; i < root.childNodes.length; i++) {
    walk(root.childNodes[i]!);
    if (found) return;
  }

  if (!found) {
    const r = document.createRange();
    r.selectNodeContents(root);
    r.collapse(false);
    selection.removeAllRanges();
    selection.addRange(r);
  }
}

export function getCaretClientRect(): DOMRect | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0).cloneRange();
  range.collapse(true);
  const rects = range.getClientRects();
  if (rects.length === 0) return null;
  return rects[0] ?? null;
}
