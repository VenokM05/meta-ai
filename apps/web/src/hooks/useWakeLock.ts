import { useEffect } from "react";

interface WakeSentinel {
  release(): Promise<void>;
  addEventListener(type: "release", listener: () => void): void;
}

interface WakeLockNavigator {
  wakeLock?: { request(type: "screen"): Promise<WakeSentinel> };
}

/**
 * Keep the screen awake while the guide is running: a blind user is not looking at the
 * phone, and a display that sleeps is a guide that stops. The OS may refuse — that is a
 * battery-saving choice, not a reason to fail the session. Re-acquired on tab return,
 * because the browser releases the lock when the page is hidden.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const wakeLock = (navigator as Navigator & WakeLockNavigator).wakeLock;
    if (!wakeLock) return;

    let sentinel: WakeSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible" || sentinel) return;
      try {
        sentinel = await wakeLock.request("screen");
        sentinel.addEventListener("release", () => {
          sentinel = null;
        });
      } catch {
        sentinel = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [active]);
}
