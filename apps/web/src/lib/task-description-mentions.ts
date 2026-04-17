/** Stored format: @[Display name](m:user-uuid) — readable in plain text, parseable for rich UI. */
const MENTION_RE =
  /@\[([^\]]*)\]\(m:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

export type DescriptionSegment =
  | { kind: "text"; text: string }
  | { kind: "mention"; label: string; userId: string };

export function parseTaskDescriptionMentions(text: string): DescriptionSegment[] {
  if (!text) return [];

  const segments: DescriptionSegment[] = [];
  let last = 0;
  const re = new RegExp(MENTION_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      segments.push({ kind: "text", text: text.slice(last, m.index) });
    }
    segments.push({
      kind: "mention",
      label: (m[1] ?? "").trim() || "Member",
      userId: m[2]!,
    });
    last = re.lastIndex;
  }
  if (last < text.length) {
    segments.push({ kind: "text", text: text.slice(last) });
  }
  if (segments.length === 0) {
    return [{ kind: "text", text }];
  }
  return segments;
}
