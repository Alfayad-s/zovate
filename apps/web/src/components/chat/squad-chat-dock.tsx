"use client";

import {
  CheckCheck,
  ChevronDown,
  FileText,
  GripVertical,
  Menu,
  Paperclip,
  Plus,
  Send,
  Sparkles,
  Video,
  X,
} from "lucide-react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

import {
  ChatChannelRoomSync,
  type ChannelRenamedPayload,
  type MessageReadPayload,
  type PresenceUpdatePayload,
  type UserTypingPayload,
} from "@/components/chat/chat-channel-room-sync";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { useAuthUser } from "@/hooks/use-auth";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  fetchOrCreateSquadChannel,
  fetchOgPreview,
  renameChatChannel,
  uploadChatAttachment,
  type ChatAttachment,
} from "@/lib/chat-api";
import {
  fetchChannelMessages,
  getMessagesErrorMessage,
  postMarkMessageRead,
  type ChannelMessageDto,
  type ChatNewMessagePayload,
} from "@/lib/messages-api";
import { workspaceKeys } from "@/lib/query-keys";
import { fetchWorkspaceMembers, type WorkspaceMember } from "@/lib/workspaces-api";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "zovate:squad-chat-collapsed";
const WIDTH_STORAGE_KEY = "zovate:squad-chat-width-px";

/** Default / minimum width — current chat column size. */
const CHAT_MIN_WIDTH_PX = 380;
const CHAT_MAX_WIDTH_PX = 720;
const CHAT_DEFAULT_WIDTH_PX = CHAT_MIN_WIDTH_PX;

// Dummy chat rendering removed; we show a skeleton while loading instead.

function ChatSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 8 }).map((_, i) => {
        const outgoing = i % 3 === 0;
        return (
          <div
            key={i}
            className={cn("flex", outgoing ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "h-12 w-[75%] max-w-[320px] animate-pulse rounded-2xl border border-neutral-200/70 bg-white/70",
                outgoing ? "rounded-br-md" : "rounded-bl-md",
              )}
            />
          </div>
        );
      })}
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "?";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

function MemberAvatar({
  user,
  className,
}: {
  user: Pick<WorkspaceMember["user"], "fullName" | "email" | "avatarUrl">;
  className: string;
}) {
  const initial = (user.fullName?.[0] ?? user.email[0] ?? "?").toUpperCase();
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt=""
        className={cn(className, "rounded-full object-cover")}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div
      className={cn(
        className,
        "flex items-center justify-center rounded-full bg-neutral-200 text-[10px] font-semibold text-neutral-800",
      )}
    >
      {initial}
    </div>
  );
}

function senderLabel(user: ChannelMessageDto["user"]) {
  const n = user.fullName?.trim();
  if (n) return n;
  const u = user.username?.trim();
  if (u) return u;
  return user.email.split("@")[0] ?? "Member";
}

function renderTextWithLinks(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(https?:\/\/[^\s<>()]+)/gi;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push(text.slice(last, idx));
    const url = m[0] ?? "";
    parts.push(
      <a
        key={`${idx}-${url}`}
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-primary underline underline-offset-2"
      >
        {url}
      </a>,
    );
    last = idx + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function AttachmentBlock({ a }: { a: ChatAttachment }) {
  if (a.kind === "image") {
    return (
      <a href={a.url} target="_blank" rel="noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={a.url}
          alt={a.name}
          className="max-h-56 w-auto max-w-full rounded-xl border border-neutral-200 object-cover"
          referrerPolicy="no-referrer"
        />
      </a>
    );
  }
  if (a.kind === "video") {
    return (
      <video
        src={a.url}
        controls
        className="max-h-56 w-full max-w-full rounded-xl border border-neutral-200 bg-black"
      />
    );
  }
  return (
    <a
      href={a.url}
      target="_blank"
      rel="noreferrer"
      className="flex max-w-full items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[12px] text-neutral-800 hover:bg-neutral-50"
    >
      <FileText className="size-4 shrink-0 text-neutral-500" strokeWidth={1.75} />
      <span className="truncate">{a.name}</span>
    </a>
  );
}

function LinkPreviewCard({
  p,
}: {
  p: NonNullable<ChannelMessageDto["linkPreview"]>;
}) {
  return (
    <a
      href={p.url}
      target="_blank"
      rel="noreferrer"
      className="mt-2 block overflow-hidden rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50"
    >
      {p.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={p.image}
          alt=""
          className="h-28 w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : null}
      <div className="p-3">
        <p className="line-clamp-1 text-[12px] font-semibold text-neutral-900">
          {p.title || p.siteName || p.url}
        </p>
        {p.description ? (
          <p className="mt-0.5 line-clamp-2 text-[11px] text-neutral-500">
            {p.description}
          </p>
        ) : null}
        <p className="mt-1 line-clamp-1 text-[10px] font-medium text-neutral-400">
          {p.siteName || new URL(p.url).hostname}
        </p>
      </div>
    </a>
  );
}

function formatChatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function clampChatWidthPx(w: number, viewportW?: number) {
  const vw =
    typeof viewportW === "number"
      ? viewportW
      : typeof window !== "undefined"
        ? window.innerWidth
        : CHAT_MAX_WIDTH_PX;
  const maxByViewport = Math.max(
    CHAT_MIN_WIDTH_PX,
    Math.min(CHAT_MAX_WIDTH_PX, vw - 48),
  );
  return Math.min(maxByViewport, Math.max(CHAT_MIN_WIDTH_PX, Math.round(w)));
}

export function SquadChatDock() {
  const { data: authUser } = useAuthUser();
  const { currentWorkspaceId } = useWorkspace();
  const prependInProgressRef = useRef(false);
  const chatSocketRef = useRef<Socket | null>(null);
  const liveMessagesRef = useRef<ChannelMessageDto[]>([]);
  const typingIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingPeerTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  /** REST mark-read dedupe when socket is offline */
  const lastMarkReadRestRef = useRef<string | null>(null);

  const [collapsed, setCollapsed] = useState(false);
  const [chatWidthPx, setChatWidthPx] = useState(CHAT_DEFAULT_WIDTH_PX);
  const [isResizingChat, setIsResizingChat] = useState(false);
  const [liveMessages, setLiveMessages] = useState<ChannelMessageDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [typingPeerIds, setTypingPeerIds] = useState<string[]>([]);
  const [readAckMessageIds, setReadAckMessageIds] = useState<string[]>([]);
  const [chatConnected, setChatConnected] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const chatResizeDragRef = useRef<{
    startPointerX: number;
    startWidth: number;
    lastAppliedWidth: number;
  } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "1") setCollapsed(true);
      const wRaw = localStorage.getItem(WIDTH_STORAGE_KEY);
      if (wRaw != null) {
        const parsed = Number.parseInt(wRaw, 10);
        if (!Number.isNaN(parsed)) {
          setChatWidthPx(clampChatWidthPx(parsed));
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    const onResize = () => {
      setChatWidthPx((w) => clampChatWidthPx(w));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (collapsed || prependInProgressRef.current) return;
    const id = requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [collapsed, chatWidthPx]);

  const envSquadChatChannelId = useMemo(
    () => process.env.NEXT_PUBLIC_SQUAD_CHAT_CHANNEL_ID?.trim() ?? null,
    [],
  );
  const [resolvedSquadChannelId, setResolvedSquadChannelId] = useState<
    string | null
  >(envSquadChatChannelId);
  const [resolvingChannel, setResolvingChannel] = useState(false);
  const [channelTitle, setChannelTitle] = useState("Influencer Squad");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [draftAttachments, setDraftAttachments] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draftOg, setDraftOg] = useState<ChannelMessageDto["linkPreview"]>(null);
  const [draftOgLoading, setDraftOgLoading] = useState(false);
  const lastOgUrlRef = useRef<string | null>(null);
  const ogReqIdRef = useRef(0);
  const [systemNotices, setSystemNotices] = useState<
    { id: string; text: string }[]
  >([]);

  useEffect(() => {
    if (envSquadChatChannelId) {
      setResolvedSquadChannelId(envSquadChatChannelId);
      return;
    }
    if (!currentWorkspaceId || !authUser?.id) return;
    let cancelled = false;
    setResolvingChannel(true);
    void fetchOrCreateSquadChannel({ workspaceId: currentWorkspaceId })
      .then((r) => {
        if (cancelled) return;
        setResolvedSquadChannelId(r.channelId);
        setChannelTitle(r.name || "Influencer Squad");
      })
      .catch(() => {
        if (!cancelled) setResolvedSquadChannelId(null);
      })
      .finally(() => {
        if (!cancelled) setResolvingChannel(false);
      });
    return () => {
      cancelled = true;
    };
  }, [envSquadChatChannelId, currentWorkspaceId, authUser?.id]);

  const squadChatChannelId = resolvedSquadChannelId;

  const useLiveChannel = Boolean(squadChatChannelId);
  const showLoadingSkeleton =
    !collapsed && (resolvingChannel || (useLiveChannel && liveLoading && liveMessages.length === 0));

  const { data: workspaceMembers = [] } = useQuery({
    queryKey: currentWorkspaceId
      ? workspaceKeys.members(currentWorkspaceId)
      : ["workspaces", "members", "none"],
    queryFn: () => fetchWorkspaceMembers(currentWorkspaceId!),
    enabled: Boolean(currentWorkspaceId && authUser),
    staleTime: 30 * 1000,
  });

  const memberByUserId = useMemo(() => {
    const map = new Map<string, WorkspaceMember>();
    for (const m of workspaceMembers) map.set(m.userId, m);
    return map;
  }, [workspaceMembers]);

  const canRenameChannel = useMemo(() => {
    if (!authUser?.id) return false;
    const me = workspaceMembers.find((m) => m.userId === authUser.id);
    return me?.role === "OWNER" || me?.role === "ADMIN";
  }, [workspaceMembers, authUser?.id]);

  const onlineMembers = useMemo(() => {
    const selfId = authUser?.id;
    return onlineUserIds
      .filter((id) => (selfId ? id !== selfId : true))
      .map((id) => memberByUserId.get(id))
      .filter(Boolean) as WorkspaceMember[];
  }, [onlineUserIds, memberByUserId, authUser?.id]);

  const typingMembers = useMemo(() => {
    return typingPeerIds
      .map((id) => memberByUserId.get(id))
      .filter(Boolean) as WorkspaceMember[];
  }, [typingPeerIds, memberByUserId]);

  liveMessagesRef.current = liveMessages;

  const emitTyping = useCallback(
    (typing: boolean) => {
      const s = chatSocketRef.current;
      if (!s?.connected || !squadChatChannelId) return;
      s.emit("user_typing", { channelId: squadChatChannelId, typing });
    },
    [squadChatChannelId],
  );

  const onDraftChange = useCallback(
    (value: string) => {
      setDraftMessage(value);
      if (!useLiveChannel) return;
      emitTyping(true);
      if (typingIdleTimerRef.current) {
        clearTimeout(typingIdleTimerRef.current);
      }
      typingIdleTimerRef.current = setTimeout(() => {
        emitTyping(false);
        typingIdleTimerRef.current = null;
      }, 2800);
    },
    [useLiveChannel, emitTyping],
  );

  useEffect(() => {
    if (!useLiveChannel) return;
    const m = draftMessage.match(/https?:\/\/[^\s<>()]+/i);
    const url = m?.[0]?.trim() ?? null;
    if (!url) {
      lastOgUrlRef.current = null;
      setDraftOg(null);
      setDraftOgLoading(false);
      return;
    }
    if (lastOgUrlRef.current === url) return;
    lastOgUrlRef.current = url;
    const reqId = ++ogReqIdRef.current;
    setDraftOgLoading(true);
    const t = setTimeout(() => {
      void fetchOgPreview({ url })
        .then((p) => {
          if (ogReqIdRef.current !== reqId) return;
          setDraftOg(p);
        })
        .catch(() => {
          if (ogReqIdRef.current !== reqId) return;
          setDraftOg(null);
        })
        .finally(() => {
          if (ogReqIdRef.current !== reqId) return;
          setDraftOgLoading(false);
        });
    }, 450);
    return () => clearTimeout(t);
  }, [draftMessage, useLiveChannel]);

  const onPickFiles = useCallback(async () => {
    if (!useLiveChannel || !squadChatChannelId) return;
    fileInputRef.current?.click();
  }, [useLiveChannel, squadChatChannelId]);

  const onFilesSelected = useCallback(
    async (files: FileList | null) => {
      if (!files || !useLiveChannel || !squadChatChannelId) return;
      const arr = Array.from(files);
      if (arr.length === 0) return;
      setUploading(true);
      try {
        const uploaded: ChatAttachment[] = [];
        for (const f of arr) {
          // Simple hard cap mirrored from API (25MB).
          if (f.size > 25 * 1024 * 1024) continue;
          uploaded.push(await uploadChatAttachment({ channelId: squadChatChannelId, file: f }));
        }
        if (uploaded.length) {
          setDraftAttachments((cur) => [...cur, ...uploaded]);
        }
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [useLiveChannel, squadChatChannelId],
  );

  useEffect(() => {
    if (!collapsed || !useLiveChannel) return;
    if (typingIdleTimerRef.current) {
      clearTimeout(typingIdleTimerRef.current);
      typingIdleTimerRef.current = null;
    }
    emitTyping(false);
  }, [collapsed, useLiveChannel, emitTyping]);

  const sendLiveMessage = useCallback(() => {
    const s = chatSocketRef.current;
    if (!s?.connected || !squadChatChannelId) return;
    const text = draftMessage.trim();
    if (!text && draftAttachments.length === 0) return;
    s.emit(
      "send_message",
      {
        channelId: squadChatChannelId,
        content: text,
        attachments: draftAttachments,
      },
      (ack: { ok?: boolean; error?: string } | undefined) => {
        if (ack?.ok) {
          setDraftMessage("");
          setDraftAttachments([]);
          if (typingIdleTimerRef.current) {
            clearTimeout(typingIdleTimerRef.current);
            typingIdleTimerRef.current = null;
          }
          emitTyping(false);
        }
      },
    );
  }, [draftMessage, draftAttachments, squadChatChannelId, emitTyping]);

  const onPresenceUpdate = useCallback(
    (p: PresenceUpdatePayload) => {
      if (!squadChatChannelId || p.channelId !== squadChatChannelId) return;
      setOnlineUserIds(p.onlineUserIds);
    },
    [squadChatChannelId],
  );

  const onUserTyping = useCallback(
    (p: UserTypingPayload) => {
      if (!squadChatChannelId || p.channelId !== squadChatChannelId) return;
      if (!authUser?.id || p.userId === authUser.id) return;
      const timers = typingPeerTimersRef.current;
      const prev = timers.get(p.userId);
      if (prev) clearTimeout(prev);
      if (!p.typing) {
        timers.delete(p.userId);
        setTypingPeerIds((ids) => ids.filter((id) => id !== p.userId));
        return;
      }
      setTypingPeerIds((ids) => (ids.includes(p.userId) ? ids : [...ids, p.userId]));
      timers.set(
        p.userId,
        setTimeout(() => {
          timers.delete(p.userId);
          setTypingPeerIds((ids) => ids.filter((id) => id !== p.userId));
        }, 3200),
      );
    },
    [squadChatChannelId, authUser?.id],
  );

  const onMessageRead = useCallback(
    (p: MessageReadPayload) => {
      if (!authUser?.id || p.userId === authUser.id) return;
      const row = liveMessagesRef.current.find((m) => m.id === p.messageId);
      if (row?.userId === authUser.id) {
        setReadAckMessageIds((prev) =>
          prev.includes(p.messageId) ? prev : [...prev, p.messageId],
        );
      }
    },
    [authUser?.id],
  );

  const onChatSocket = useCallback((socket: Socket | null) => {
    chatSocketRef.current = socket;
    if (!socket) {
      setChatConnected(false);
      return;
    }
    const syncConnected = () => setChatConnected(socket.connected);
    syncConnected();
    socket.on("connect", syncConnected);
    socket.on("disconnect", syncConnected);
  }, []);

  const pushSystemNotice = useCallback((text: string) => {
    setSystemNotices((cur) => [
      ...cur,
      { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, text },
    ]);
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const onChannelRenamed = useCallback(
    (p: ChannelRenamedPayload) => {
      if (!squadChatChannelId || p.channelId !== squadChatChannelId) return;
      setChannelTitle(p.name);
      const actorName = p.actor.fullName?.trim() || p.actor.email;
      pushSystemNotice(`"${p.oldName}" renamed to "${p.name}" by ${actorName}`);
    },
    [squadChatChannelId, pushSystemNotice],
  );

  useEffect(() => {
    if (!squadChatChannelId) return;
    setOnlineUserIds([]);
    setTypingPeerIds([]);
    setReadAckMessageIds([]);
    lastMarkReadRestRef.current = null;
    for (const t of typingPeerTimersRef.current.values()) {
      clearTimeout(t);
    }
    typingPeerTimersRef.current.clear();
  }, [squadChatChannelId]);

  useEffect(() => {
    const peerTimers = typingPeerTimersRef.current;
    return () => {
      if (typingIdleTimerRef.current) {
        clearTimeout(typingIdleTimerRef.current);
      }
      for (const t of peerTimers.values()) {
        clearTimeout(t);
      }
      peerTimers.clear();
    };
  }, []);

  useEffect(() => {
    if (!useLiveChannel || !squadChatChannelId || liveMessages.length === 0) {
      return;
    }
    const last = liveMessages[liveMessages.length - 1];
    if (!last) return;
    const s = chatSocketRef.current;
    if (s?.connected) {
      s.emit("mark_read", {
        channelId: squadChatChannelId,
        messageId: last.id,
      });
      return;
    }
    if (lastMarkReadRestRef.current === last.id) return;
    void postMarkMessageRead({
      channelId: squadChatChannelId,
      messageId: last.id,
    })
      .then(() => {
        lastMarkReadRestRef.current = last.id;
      })
      .catch(() => {
        /* ignore */
      });
  }, [useLiveChannel, squadChatChannelId, liveMessages, chatConnected]);

  useEffect(() => {
    if (!useLiveChannel || collapsed || !squadChatChannelId) return;
    let cancelled = false;
    setLiveLoading(true);
    setLiveError(null);
    void fetchChannelMessages({ channelId: squadChatChannelId, limit: 40 })
      .then((r) => {
        if (cancelled) return;
        setLiveMessages(r.messages);
        setNextCursor(r.nextCursor);
        setHasMore(r.hasMore);
        requestAnimationFrame(() => {
          const el = listRef.current;
          if (el) el.scrollTop = el.scrollHeight;
        });
      })
      .catch((e: unknown) => {
        if (!cancelled) setLiveError(getMessagesErrorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLiveLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [useLiveChannel, collapsed, squadChatChannelId]);

  const loadOlderMessages = useCallback(async () => {
    if (
      !squadChatChannelId ||
      !nextCursor ||
      !hasMore ||
      olderLoading ||
      liveLoading
    ) {
      return;
    }
    const el = listRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;
    const prevScrollTop = el?.scrollTop ?? 0;
    prependInProgressRef.current = true;
    setOlderLoading(true);
    try {
      const r = await fetchChannelMessages({
        channelId: squadChatChannelId,
        cursor: nextCursor,
        limit: 30,
      });
      setLiveMessages((cur) => [...r.messages, ...cur]);
      setNextCursor(r.nextCursor);
      setHasMore(r.hasMore);
      requestAnimationFrame(() => {
        const node = listRef.current;
        if (node) {
          node.scrollTop = node.scrollHeight - prevScrollHeight + prevScrollTop;
        }
        prependInProgressRef.current = false;
      });
    } catch {
      prependInProgressRef.current = false;
    } finally {
      setOlderLoading(false);
    }
  }, [
    squadChatChannelId,
    nextCursor,
    hasMore,
    olderLoading,
    liveLoading,
  ]);

  const onMessageListScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || !useLiveChannel) return;
    if (el.scrollTop > 100) return;
    void loadOlderMessages();
  }, [useLiveChannel, loadOlderMessages]);

  const onLiveChannelMessage = useCallback(
    (p: ChatNewMessagePayload) => {
      if (!squadChatChannelId || p.channelId !== squadChatChannelId) return;
      setLiveMessages((cur) => {
        if (cur.some((m) => m.id === p.id)) return cur;
        return [
          ...cur,
          {
            id: p.id,
            workspaceId: p.workspaceId,
            channelId: p.channelId,
            userId: p.userId,
            content: p.content,
            attachments: p.attachments ?? null,
            linkPreview: p.linkPreview ?? null,
            createdAt: p.createdAt,
            user: p.user,
          },
        ];
      });
      requestAnimationFrame(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    },
    [squadChatChannelId],
  );

  const chatPanelWidthStyle = `min(${chatWidthPx}px, calc(100vw - 1.5rem))`;

  const onChatResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      chatResizeDragRef.current = {
        startPointerX: e.clientX,
        startWidth: chatWidthPx,
        lastAppliedWidth: chatWidthPx,
      };
      setIsResizingChat(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [chatWidthPx],
  );

  const onChatResizePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      const d = chatResizeDragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startPointerX;
      const next = clampChatWidthPx(d.startWidth - dx);
      d.lastAppliedWidth = next;
      setChatWidthPx(next);
    },
    [],
  );

  const finishChatResize = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = chatResizeDragRef.current;
      chatResizeDragRef.current = null;
      setIsResizingChat(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      if (drag) {
        try {
          localStorage.setItem(
            WIDTH_STORAGE_KEY,
            String(drag.lastAppliedWidth),
          );
        } catch {
          /* ignore */
        }
      }
    },
    [],
  );

  return (
    <>
      <ChatChannelRoomSync
        open={!collapsed}
        channelId={squadChatChannelId}
        onChatSocket={onChatSocket}
        onNewMessage={onLiveChannelMessage}
        onPresenceUpdate={onPresenceUpdate}
        onUserTyping={onUserTyping}
        onMessageRead={onMessageRead}
        onChannelRenamed={onChannelRenamed}
      />
      {collapsed ? (
        <button
          type="button"
          aria-label="Open squad chat"
          className={cn(
            "group fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center gap-0 overflow-hidden rounded-full border border-neutral-200/90 bg-white shadow-[0_12px_40px_-10px_rgba(0,0,0,0.18)]",
            "transition-[width,padding,gap] duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300",
            "hover:w-[min(320px,calc(100vw-2.5rem))] hover:px-4 hover:justify-start",
            "hover:gap-3",
            "focus-visible:w-[min(320px,calc(100vw-2.5rem))] focus-visible:px-4 focus-visible:justify-start",
            "focus-visible:gap-3",
          )}
          onClick={() => setCollapsed(false)}
        >
          <span className="flex size-10 shrink-0 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo/chat-logo.svg"
              alt=""
              className="h-9 w-9"
              aria-hidden
            />
          </span>
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap",
              "w-0 opacity-0 translate-x-2 pointer-events-none",
              "transition-all duration-300 ease-out",
              "group-hover:w-auto group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto",
              "group-focus-visible:w-auto group-focus-visible:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:pointer-events-auto",
            )}
          >
            <span className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight text-neutral-900">
                Let&apos;s Chat
              </span>
              <span className="text-2xl" aria-hidden>
                🤩
              </span>
            </span>
          </span>
        </button>
      ) : (
        <>
          <button
            type="button"
            aria-label="Close chat backdrop"
            className="fixed inset-0 z-30 bg-black/25 backdrop-blur-[1px] xl:hidden"
            onClick={() => setCollapsed(true)}
          />
          <aside
            style={{ width: chatPanelWidthStyle }}
            className={cn(
              "relative z-40 flex shrink-0 flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_40px_-18px_rgba(0,0,0,0.12)]",
              "max-xl:fixed max-xl:right-3 max-xl:top-3 max-xl:h-[calc(100dvh-1.5rem)]",
              "xl:relative xl:h-full",
              !isResizingChat &&
                "transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none",
            )}
          >
            <button
              type="button"
              aria-label="Resize chat panel"
              title="Drag to resize"
              className="group absolute left-0 top-0 z-50 flex h-full w-3 cursor-col-resize touch-none select-none items-center justify-center border-0 bg-transparent p-0 outline-none"
              onPointerDown={onChatResizePointerDown}
              onPointerMove={onChatResizePointerMove}
              onPointerUp={finishChatResize}
              onPointerCancel={finishChatResize}
            >
              <span className="absolute inset-y-0 left-0 w-px bg-neutral-300/90 transition-colors group-hover:bg-neutral-400 group-active:bg-neutral-600" />
              <GripVertical
                className="relative size-3.5 text-neutral-400 transition-colors group-hover:text-neutral-600 group-active:text-neutral-700"
                strokeWidth={2}
                aria-hidden
              />
            </button>
            <header className="flex shrink-0 items-center gap-2 border-b border-neutral-200/80 px-3 py-3 pl-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-xl text-neutral-600 hover:bg-neutral-100"
              aria-label="Chat menu"
            >
              <Menu className="size-[18px]" strokeWidth={1.75} />
            </Button>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo/chat-logo.svg"
                alt="Chat"
                className="h-6 w-6"
              />
            </div>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                className={cn(
                  "block w-full truncate text-left text-[15px] font-semibold tracking-tight text-neutral-900",
                  canRenameChannel &&
                    useLiveChannel &&
                    "cursor-pointer hover:underline",
                )}
                onClick={() => {
                  if (!canRenameChannel || !useLiveChannel) return;
                  setRenameDraft(channelTitle);
                  setRenameOpen(true);
                }}
                disabled={!canRenameChannel || !useLiveChannel}
              >
                {channelTitle}
              </button>
              {useLiveChannel ? (
                <p className="truncate text-[11px] text-neutral-500">
                  {chatConnected
                    ? `${onlineUserIds.length} online`
                    : "Connecting…"}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="hidden items-center sm:flex">
                {useLiveChannel && onlineMembers.length > 0 ? (
                  <>
                    {onlineMembers.slice(0, 3).map((m, i) => (
                      <span
                        key={m.userId}
                        className={cn(
                          "relative flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-white",
                          i > 0 && "-ml-2",
                        )}
                        style={{ zIndex: 10 - i }}
                        title={m.user.fullName?.trim() || m.user.email}
                      >
                        <MemberAvatar
                          user={m.user}
                          className="h-full w-full"
                        />
                      </span>
                    ))}
                    {onlineMembers.length > 3 ? (
                      <span className="-ml-1 rounded-full border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
                        +{onlineMembers.length - 3}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <>
                    {["RF", "RY", "KX"].map((tag, i) => (
                      <span
                        key={tag}
                        className={cn(
                          "flex size-7 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-neutral-200 to-neutral-300 text-[10px] font-semibold text-neutral-800",
                          i > 0 && "-ml-2",
                        )}
                        aria-hidden
                      >
                        {tag}
                      </span>
                    ))}
                    <span className="-ml-1 rounded-full border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
                      +14
                    </span>
                  </>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                aria-label="Video call"
              >
                <Video className="size-[18px]" strokeWidth={1.75} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl text-neutral-500 hover:bg-neutral-100"
                aria-label="More"
              >
                <ChevronDown className="size-[18px]" strokeWidth={1.75} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl text-neutral-500 hover:bg-neutral-100"
                aria-label="Collapse chat"
                onClick={() => setCollapsed(true)}
              >
                <X className="size-[18px]" strokeWidth={1.75} />
              </Button>
            </div>
            </header>

            <div className="relative flex min-h-0 flex-1 flex-col bg-[#fafafa]">

              <div
                ref={listRef}
                onScroll={useLiveChannel ? onMessageListScroll : undefined}
                className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-4 pb-3 [scrollbar-width:thin]"
              >
              {liveError ? (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-800">
                  {liveError}
                </p>
              ) : null}
              {useLiveChannel && olderLoading ? (
                <p className="text-center text-[11px] text-neutral-400">
                  Loading older messages…
                </p>
              ) : null}
              {showLoadingSkeleton ? <ChatSkeleton /> : null}
              {!showLoadingSkeleton && useLiveChannel
                ? liveMessages.map((m, idx) => {
                    const outgoing = authUser?.id === m.userId;
                    const groupStart =
                      idx === 0 ||
                      liveMessages[idx - 1]!.userId !== m.userId;
                    const label = senderLabel(m.user);
                    const time = formatChatTime(m.createdAt);
                    return (
                      <div key={m.id}>
                        {outgoing ? (
                          <div className="flex flex-col items-end gap-1">
                            <div className="relative max-w-[92%] rounded-2xl rounded-br-md bg-[#e1effe] px-3.5 py-2.5 pb-6 pr-14 text-[13px] leading-relaxed text-neutral-900">
                              {m.attachments && m.attachments.length > 0 ? (
                                <div className="mb-2 grid gap-2">
                                  {m.attachments.map((a) => (
                                    <AttachmentBlock
                                      key={`${a.url}-${a.name}`}
                                      a={a as ChatAttachment}
                                    />
                                  ))}
                                </div>
                              ) : null}
                              {m.content ? (
                                <span className="block whitespace-pre-wrap break-words">
                                  {renderTextWithLinks(m.content)}
                                </span>
                              ) : null}
                              {m.linkPreview ? <LinkPreviewCard p={m.linkPreview} /> : null}
                              <div className="absolute bottom-1.5 right-2 flex items-center gap-1 whitespace-nowrap text-[10px] leading-none text-neutral-500">
                                <span>{time}</span>
                                {readAckMessageIds.includes(m.id) ? (
                                  <CheckCheck
                                    className="size-3.5 text-primary"
                                    strokeWidth={2.25}
                                    aria-label="Read"
                                  />
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={cn(
                              "flex gap-2",
                              groupStart ? "items-end" : "items-end pl-10",
                            )}
                          >
                            {groupStart ? (
                              <div className="mb-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[11px] font-semibold text-neutral-800">
                                {initials(label)}
                              </div>
                            ) : (
                              <span className="w-8 shrink-0" aria-hidden />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="relative inline-block max-w-full rounded-2xl rounded-bl-md bg-[#f1f1f1] px-3.5 py-2.5 pb-6 pr-14 text-[13px] leading-relaxed text-neutral-900">
                                {m.attachments && m.attachments.length > 0 ? (
                                  <div className="mb-2 grid gap-2">
                                    {m.attachments.map((a) => (
                                      <AttachmentBlock
                                        key={`${a.url}-${a.name}`}
                                        a={a as ChatAttachment}
                                      />
                                    ))}
                                  </div>
                                ) : null}
                                {m.content ? (
                                  <span className="block whitespace-pre-wrap break-words">
                                    {renderTextWithLinks(m.content)}
                                  </span>
                                ) : null}
                                {m.linkPreview ? <LinkPreviewCard p={m.linkPreview} /> : null}
                                <div className="absolute bottom-1.5 right-2 flex items-center gap-1 whitespace-nowrap text-[10px] leading-none text-neutral-500">
                                  <span className="font-medium text-neutral-700">
                                    {label}
                                  </span>
                                  <span aria-hidden>·</span>
                                  <span>{time}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                : null}
              {useLiveChannel
                ? systemNotices.map((n) => (
                    <div key={n.id} className="flex justify-center">
                      <div className="max-w-[92%] rounded-full border border-neutral-200 bg-white/80 px-3 py-1 text-center text-[11px] font-medium text-neutral-600 shadow-sm backdrop-blur">
                        {n.text}
                      </div>
                    </div>
                  ))
                : null}
              
              </div>
              {useLiveChannel && typingPeerIds.length > 0 ? (
                <div className="flex shrink-0 items-center gap-2 border-t border-neutral-200/60 bg-[#fafafa] px-3 py-2 text-[11px] text-neutral-600">
                  {typingMembers[0] ? (
                    <span className="relative size-5 shrink-0 overflow-hidden rounded-full border border-neutral-200 bg-white">
                      <MemberAvatar
                        user={typingMembers[0].user}
                        className="h-full w-full"
                      />
                    </span>
                  ) : (
                    <span className="relative size-5 shrink-0 overflow-hidden rounded-full border border-neutral-200 bg-white" />
                  )}
                  <span className="truncate">
                    {typingMembers.length <= 1 ? (
                      <>
                        <span className="font-medium text-neutral-800">
                          {typingMembers[0]?.user.fullName?.trim() ||
                            typingMembers[0]?.user.email ||
                            "Someone"}
                        </span>{" "}
                        is typing…
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-neutral-800">
                          {typingMembers[0]?.user.fullName?.trim() ||
                            typingMembers[0]?.user.email ||
                            "Someone"}
                        </span>{" "}
                        and {typingMembers.length - 1} others are typing…
                      </>
                    )}
                  </span>
                </div>
              ) : null}
            </div>

            <footer className="shrink-0 border-t border-neutral-200/80 bg-white px-3 py-3">
            <div className="rounded-2xl bg-neutral-100/90 p-2">
              <div className="px-2 pb-2 pt-1">
                <label className="sr-only" htmlFor="squad-chat-input">
                  Message
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => void onFilesSelected(e.target.files)}
                />
                {useLiveChannel && (draftAttachments.length > 0 || uploading) ? (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {draftAttachments.map((a) => (
                      <button
                        key={`${a.url}-${a.name}`}
                        type="button"
                        className="flex max-w-full items-center gap-2 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] text-neutral-700"
                        title="Remove attachment"
                        onClick={() =>
                          setDraftAttachments((cur) =>
                            cur.filter((x) => x.url !== a.url),
                          )
                        }
                      >
                        <span className="truncate">{a.name}</span>
                        <span className="text-neutral-400">×</span>
                      </button>
                    ))}
                    {uploading ? (
                      <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] text-neutral-500">
                        Uploading…
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {useLiveChannel && (draftOgLoading || draftOg) ? (
                  <div className="mb-2">
                    {draftOg ? (
                      <LinkPreviewCard p={draftOg} />
                    ) : (
                      <div className="h-20 animate-pulse rounded-xl border border-neutral-200 bg-white/70" />
                    )}
                  </div>
                ) : null}
                <textarea
                  id="squad-chat-input"
                  rows={2}
                  readOnly={!useLiveChannel}
                  value={useLiveChannel ? draftMessage : ""}
                  onChange={
                    useLiveChannel
                      ? (e) => onDraftChange(e.target.value)
                      : undefined
                  }
                  onBlur={
                    useLiveChannel
                      ? () => {
                          if (typingIdleTimerRef.current) {
                            clearTimeout(typingIdleTimerRef.current);
                            typingIdleTimerRef.current = null;
                          }
                          emitTyping(false);
                        }
                      : undefined
                  }
                  onKeyDown={
                    useLiveChannel
                      ? (e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendLiveMessage();
                          }
                        }
                      : undefined
                  }
                  placeholder="Type a new message"
                  className="w-full resize-none border-0 bg-transparent text-[13px] text-neutral-900 outline-none placeholder:text-neutral-400"
                />
              </div>
              <div className="flex items-center justify-between gap-2 px-1 pb-1">
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-xl border-white bg-white text-neutral-700 shadow-sm hover:bg-neutral-50"
                    aria-label="Add"
                  >
                    <Plus className="size-[18px]" strokeWidth={1.75} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl text-neutral-500 hover:bg-white/80 hover:text-neutral-900"
                    aria-label="Assist"
                  >
                    <Sparkles className="size-[17px]" strokeWidth={1.75} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl text-neutral-500 hover:bg-white/80 hover:text-neutral-900"
                    aria-label="Attach file"
                    onClick={useLiveChannel ? () => void onPickFiles() : undefined}
                    disabled={useLiveChannel ? uploading || !chatConnected : false}
                  >
                    <Paperclip className="size-[17px]" strokeWidth={1.75} />
                  </Button>
                </div>
                <Button
                  type="button"
                  className="h-10 gap-1.5 rounded-full bg-neutral-900 px-4 text-white hover:bg-neutral-800 disabled:opacity-50"
                  aria-label={useLiveChannel ? "Send message" : "Send (demo)"}
                  disabled={
                    useLiveChannel
                      ? !chatConnected ||
                        uploading ||
                        (!draftMessage.trim() && draftAttachments.length === 0)
                      : false
                  }
                  onClick={useLiveChannel ? sendLiveMessage : undefined}
                >
                  <Send className="size-4" strokeWidth={1.75} />
                  <span className="mx-0.5 h-4 w-px bg-white/25" aria-hidden />
                  <ChevronDown className="size-4 opacity-90" strokeWidth={1.75} />
                </Button>
              </div>
            </div>
            </footer>
          </aside>
        </>
      )}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
            <DialogDescription>
              Only workspace owners and admins can rename this chat.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Input
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              placeholder="Chat name"
              maxLength={64}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const next = renameDraft.trim();
                  if (!next || !squadChatChannelId || renameSaving) return;
                  setRenameSaving(true);
                  void renameChatChannel({
                    channelId: squadChatChannelId,
                    name: next,
                  })
                    .then((r) => {
                      setChannelTitle(r.name);
                      const actorName =
                        r.actor.fullName?.trim() || r.actor.email;
                      pushSystemNotice(
                        `"${r.oldName}" renamed to "${r.name}" by ${actorName}`,
                      );
                      setRenameOpen(false);
                    })
                    .finally(() => setRenameSaving(false));
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenameOpen(false)}
              disabled={renameSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                const next = renameDraft.trim();
                if (!next || !squadChatChannelId || renameSaving) return;
                setRenameSaving(true);
                void renameChatChannel({
                  channelId: squadChatChannelId,
                  name: next,
                })
                  .then((r) => {
                    setChannelTitle(r.name);
                    const actorName = r.actor.fullName?.trim() || r.actor.email;
                    pushSystemNotice(
                      `"${r.oldName}" renamed to "${r.name}" by ${actorName}`,
                    );
                    setRenameOpen(false);
                  })
                  .finally(() => setRenameSaving(false));
              }}
              disabled={!renameDraft.trim() || renameSaving || !squadChatChannelId}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
