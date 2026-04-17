"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useAuthUser } from "@/hooks/use-auth";
import { fetchUnreadNotifications } from "@/lib/notifications-api";
import { playNotificationSound } from "@/lib/notification-sound";
import { notificationKeys } from "@/lib/query-keys";
import { workspaceLiveQueryOptions } from "@/lib/realtime-query";

/**
 * Plays `/sounds/notification.mp3` when the unread notification count increases
 * (e.g. new assignment or invite), not on first load or when count goes down.
 */
export function NotificationSoundBridge() {
  const { data: user } = useAuthUser();
  const { data: items } = useQuery({
    queryKey: notificationKeys.list(),
    queryFn: fetchUnreadNotifications,
    enabled: !!user,
    staleTime: 15 * 1000,
    ...workspaceLiveQueryOptions,
  });

  const prevUnreadRef = useRef<number | null>(null);
  const didInitRef = useRef(false);

  useEffect(() => {
    if (!user || items === undefined) return;

    const unread = items.length;

    if (!didInitRef.current) {
      didInitRef.current = true;
      prevUnreadRef.current = unread;
      return;
    }

    const prev = prevUnreadRef.current ?? 0;
    if (unread > prev) {
      playNotificationSound();
    }
    prevUnreadRef.current = unread;
  }, [user, items]);

  return null;
}
