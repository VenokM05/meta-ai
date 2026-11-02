import { useCallback, useEffect, useRef, useState } from "react";
import { aimTick, levelChime } from "../lib/audio";
import { UI, type Locale } from "../lib/i18n";

/**
 * Aim coaching for a blind user holding a phone: the camera must point ahead, but there is
 * no visual way to check. Device orientation gives pitch and roll, which is enough to say
 * "tilt the top up" and to play a tone that rises as the phone approaches level.
 *
 * This coaches the phone, not the scene. "Level" never means the path is clear.
 */

const PITCH_TARGET = 90;
const PITCH_TOLERANCE_DEG = 7;
const ROLL_TOLERANCE_DEG = 8;
const SMOOTHING = 0.22;
const TICK_MS = 450;
const LEVEL_TICK_MS = 3_000;
const SPEECH_GAP_MS = 1_800;
const SPEECH_REPEAT_MS = 3_500;
const INTRO_SETTLE_MS = 1_500;
const NO_EVENTS_MS = 3_000;

export interface AimCoach {
  active: boolean;
  level: boolean;
  pitch: number;
  roll: number;
  guidance: string;
  supported: boolean;
  toggle: () => void;
  stop: (message?: string | null) => void;
}

export function useAimCoach({
  cameraOn,
  announce,
  locale,
}: {
  cameraOn: boolean;
  announce: (text: string, interrupt?: boolean) => void;
  locale: Locale;
}): AimCoach {
  const [active, setActive] = useState(false);
  const [level, setLevel] = useState(false);
  const [pitch, setPitch] = useState(PITCH_TARGET);
  const [roll, setRoll] = useState(0);
  const [guidance, setGuidance] = useState(() => UI[locale].aim.holdUpright);
  const [supported] = useState(
    () => typeof window !== "undefined" && "DeviceOrientationEvent" in window,
  );

  const activeRef = useRef(false);
  const startingRef = useRef(false);
  const levelRef = useRef(false);
  const cameraOnRef = useRef(cameraOn);
  cameraOnRef.current = cameraOn;
  const announceRef = useRef(announce);
  announceRef.current = announce;
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const strings = useCallback(() => UI[localeRef.current].aim, []);

  const raw = useRef<{ beta: number; gamma: number } | null>(null);
  const smooth = useRef<{ beta: number; gamma: number } | null>(null);
  const eventSeen = useRef(false);
  const startedAt = useRef(0);
  const lastTickAt = useRef(0);
  const lastSpeechAt = useRef(0);
  const lastDirection = useRef("");
  const interval = useRef<number | null>(null);
  const fallback = useRef<number | null>(null);
  const handler = useRef<((e: DeviceOrientationEvent) => void) | null>(null);

  const stop = useCallback((message?: string | null) => {
    const wasActive = activeRef.current;
    activeRef.current = false;
    levelRef.current = false;
    setActive(false);
    setLevel(false);
    if (interval.current !== null) window.clearInterval(interval.current);
    interval.current = null;
    if (fallback.current !== null) window.clearTimeout(fallback.current);
    fallback.current = null;
    if (handler.current) window.removeEventListener("deviceorientation", handler.current);
    handler.current = null;
    raw.current = null;
    smooth.current = null;
    if (wasActive && typeof message === "string" && message.length > 0) {
      announceRef.current(message);
    }
  }, []);

  const step = useCallback(() => {
    const r = raw.current;
    if (!r) return;
    let s = smooth.current;
    if (!s) {
      s = { beta: r.beta, gamma: r.gamma };
    } else {
      s.beta += (r.beta - s.beta) * SMOOTHING;
      s.gamma += (r.gamma - s.gamma) * SMOOTHING;
    }
    smooth.current = s;

    const pitchErr = s.beta - PITCH_TARGET;
    const absPitch = Math.abs(pitchErr);
    const absRoll = Math.abs(s.gamma);
    const now = performance.now();
    const isLevel = absPitch <= PITCH_TOLERANCE_DEG && absRoll <= ROLL_TOLERANCE_DEG;

    setPitch(s.beta);
    setRoll(s.gamma);
    setLevel(isLevel);

    if (isLevel) {
      if (!levelRef.current) {
        const a = strings();
        levelRef.current = true;
        lastDirection.current = a.level;
        levelChime();
        announceRef.current(a.level);
        setGuidance(a.levelHold);
        lastTickAt.current = now;
        return;
      }
      // A sparse, high tick confirms the phone is still level without chattering.
      if (now - lastTickAt.current >= LEVEL_TICK_MS) {
        aimTick(0, 0);
        lastTickAt.current = now;
      }
      return;
    }

    levelRef.current = false;

    if (now - lastTickAt.current >= TICK_MS) {
      const err = Math.min(1, Math.max(absPitch / 30, absRoll / 30, 0.06));
      aimTick(err, Math.max(-1, Math.min(1, s.gamma / 18)));
      lastTickAt.current = now;
    }

    const a = strings();
    let direction: string;
    if (absPitch > absRoll && absPitch > 10) {
      direction = pitchErr < 0 ? a.topUp : a.topDown;
    } else if (absRoll > 10) {
      direction = s.gamma > 0 ? a.rightSide : a.leftSide;
    } else {
      direction = a.almost;
    }
    setGuidance(direction);

    if (now - startedAt.current < INTRO_SETTLE_MS) return;
    if (now - lastSpeechAt.current < SPEECH_GAP_MS) return;
    const changed = direction !== lastDirection.current;
    // "Almost level" is an interim state; repeating it would nag without adding information.
    const stale = direction !== a.almost && now - lastSpeechAt.current > SPEECH_REPEAT_MS;
    if (!changed && !stale) return;
    lastDirection.current = direction;
    lastSpeechAt.current = now;
    announceRef.current(`${direction}.`);
  }, [strings]);

  const start = useCallback(async () => {
    if (activeRef.current || startingRef.current) return;
    const a = strings();
    if (!cameraOnRef.current) {
      announceRef.current(a.noCamera);
      return;
    }
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      announceRef.current(a.noSensors);
      return;
    }

    startingRef.current = true;
    try {
      const DOE = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      };
      if (typeof DOE.requestPermission === "function") {
        let permission: string;
        try {
          permission = await DOE.requestPermission();
        } catch {
          announceRef.current(a.unavailable);
          return;
        }
        if (permission !== "granted") {
          announceRef.current(a.denied);
          return;
        }
      }
    } finally {
      startingRef.current = false;
    }

    // The user may have turned the camera off while the permission prompt was open.
    if (!cameraOnRef.current) {
      announceRef.current(a.noCamera);
      return;
    }

    activeRef.current = true;
    levelRef.current = false;
    raw.current = null;
    smooth.current = null;
    eventSeen.current = false;
    setActive(true);
    setLevel(false);
    setPitch(PITCH_TARGET);
    setRoll(0);
    setGuidance(a.holdUpright);
    startedAt.current = performance.now();
    lastTickAt.current = 0;
    lastSpeechAt.current = 0;
    lastDirection.current = "";

    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      eventSeen.current = true;
      raw.current = { beta: e.beta, gamma: e.gamma };
      if (fallback.current !== null) {
        window.clearTimeout(fallback.current);
        fallback.current = null;
      }
    };
    handler.current = onOrient;
    window.addEventListener("deviceorientation", onOrient);

    fallback.current = window.setTimeout(() => {
      if (!eventSeen.current) stop(strings().noSensors);
    }, NO_EVENTS_MS);

    interval.current = window.setInterval(step, 120);
    announceRef.current(a.on);
  }, [step, stop, strings]);

  const toggle = useCallback(() => {
    if (activeRef.current) {
      stop(strings().off);
      return;
    }
    void start();
  }, [start, stop, strings]);

  useEffect(() => {
    if (!cameraOn && activeRef.current) stop(strings().cameraOff);
  }, [cameraOn, stop, strings]);

  useEffect(() => () => stop(null), [stop]);

  return { active, level, pitch, roll, guidance, supported, toggle, stop };
}
