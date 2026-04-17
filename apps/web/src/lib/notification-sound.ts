const SOUND_PATH = "/sounds/notification.mp3";
const MIN_MS_BETWEEN_PLAYS = 500;

let lastPlayAt = 0;

/**
 * Plays the notification chime at full volume. Debounced slightly so bursts
 * of invalidations do not stack multiple overlapping plays.
 * May fail silently if the browser blocks autoplay until a user gesture.
 */
export function playNotificationSound(): void {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastPlayAt < MIN_MS_BETWEEN_PLAYS) return;
  lastPlayAt = now;

  try {
    const audio = new Audio(SOUND_PATH);
    audio.volume = 1;
    void audio.play().catch(() => {
      /* Autoplay policy or missing file */
    });
  } catch {
    /* ignore */
  }
}
