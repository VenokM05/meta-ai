import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CONCEPTS_BY_ID,
  DEFAULT_GATE,
  DEFAULT_NARRATION,
  KeyframeGate,
  NarrationEngine,
  VOCABULARY,
  sceneToSpatial,
  summarizeScene,
  type HazardTier,
  type NarrationLine,
  type Scene,
  type SpatialObject,
} from "@roomguide/core";
import {
  announce as announceAudio,
  blip,
  earcon,
  ensureAudio,
  setAudioPreferences,
  speak,
  stopSpeech,
} from "../lib/audio";
import {
  LOCALE_TAGS,
  UI,
  conceptLabel,
  describeSummary,
  lineText,
  localeSpec,
  type Locale,
} from "../lib/i18n";
import { mockSceneAt } from "../lib/mockScenes";
import {
  LIVE_CONCEPTS,
  SWEEP_BUDGET_MS,
  grabFrame,
  runSweep,
  type ConceptOutcome,
} from "../lib/metaProvider";
import {
  loadPreferences,
  savePreferences,
  type DetailLevel,
  type Preferences,
  type SpeechSpeed,
} from "../lib/preferences";

/** Parallel per-concept requests. Above this, rate limiting becomes the failure mode. */
const SWEEP_CONCURRENCY = 4;

/**
 * Minimum coast time between live sweeps. The gate's 1.2s ceiling was tuned for sub-frame
 * mock calls; at ~2.5s per live sweep it would restart the moment the last one landed. This
 * also stops a fast-failing proxy from being retried every loop tick.
 */
const LIVE_SWEEP_INTERVAL_MS = 4_000;

/**
 * Geometry older than this is outside the loop's normal worst case (~11s), so the guide
 * says so once rather than letting old observations sound current.
 */
export const STALE_AFTER_MS = 12_000;

/** How long a freshly started live loop waits for its first sweep before flagging it. */
const FIRST_SWEEP_GRACE_MS = 6_000;

/** A camera whose frames cannot be analysed is worse than no camera, so check first. */
const LIVE_PROBE_MS = 2_500;

/**
 * Ask the proxy whether it is present and has a key before opening a camera. The hosted
 * build has no /api route, and opening the camera anyway would narrate a synthetic scene
 * while the user believes their own room is being scanned.
 */
async function liveProxyReady(): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), LIVE_PROBE_MS);
  try {
    const res = await fetch("/api/healthz", { signal: controller.signal, cache: "no-store" });
    if (!res.ok) return false;
    const body = (await res.json()) as { ok?: boolean; configured?: boolean };
    return body.ok === true && body.configured !== false;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

export interface GuideStats {
  fps: number;
  latencyMs: number;
  segmented: number;
  coasted: number;
  /** Fraction of frames that skipped segmentation — the gate's whole point. */
  hitRate: number;
  objectsTracked: number;
}

export interface VocabularyRow {
  concept: string;
  label: string;
  tier: "critical" | "caution" | "informative";
  count: number;
  confidence: number;
}

interface LoopCounters {
  segmented: number;
  coasted: number;
  frames: number;
  startedAt: number;
  lastFpsAt: number;
  lastFrames: number;
}

const HISTORY_CAP = 40;

function tierAllowed(tier: HazardTier, detail: DetailLevel): boolean {
  if (detail === "all") return true;
  if (detail === "caution") return tier !== "informative";
  return tier === "critical";
}

export function useGuide() {
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const [objects, setObjects] = useState<SpatialObject[]>([]);
  const [history, setHistory] = useState<NarrationLine[]>([]);
  const [activeLine, setActiveLine] = useState<NarrationLine | null>(null);
  const [soundingIds, setSoundingIds] = useState<Set<string>>(new Set());
  const [statusText, setStatusText] = useState("");
  const [viewAgeMs, setViewAgeMs] = useState<number | null>(null);
  const [stats, setStats] = useState<GuideStats>({
    fps: 0,
    latencyMs: 0,
    segmented: 0,
    coasted: 0,
    hitRate: 0,
    objectsTracked: 0,
  });

  // Camera state lives here rather than in the screen because the provider switch is
  // pipeline state: turning the camera on is what makes a sweep real.
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const provider: "mock" | "meta" = stream ? "meta" : "mock";

  const [sweep, setSweep] = useState<{
    inFlight: boolean;
    lastDurationMs: number | null;
    outcomes: ConceptOutcome[];
  }>({ inFlight: false, lastDurationMs: null, outcomes: [] });

  const engine = useMemo(() => new NarrationEngine(DEFAULT_NARRATION), []);
  const gate = useMemo(() => new KeyframeGate(DEFAULT_GATE), []);
  const rafRef = useRef<number | null>(null);
  const lastScene = useRef<Scene | null>(null);
  const lastLine = useRef<NarrationLine | null>(null);
  const lastScanAt = useRef<number | null>(null);
  const staleNotified = useRef(false);
  const sweepBusy = useRef(false);
  const sweepAbort = useRef<AbortController | null>(null);
  const sweepGen = useRef(0);
  const nextSweepAt = useRef(0);
  const firstSweepTimer = useRef<number | null>(null);
  const [firstSweepSlow, setFirstSweepSlow] = useState(false);
  const counters = useRef<LoopCounters>({
    segmented: 0,
    coasted: 0,
    frames: 0,
    startedAt: 0,
    lastFpsAt: 0,
    lastFrames: 0,
  });

  useEffect(() => {
    savePreferences(prefs);
  }, [prefs]);

  useEffect(() => {
    setAudioPreferences({ speed: prefs.speed, earconsOn: prefs.earconsOn, locale: prefs.locale });
  }, [prefs.speed, prefs.earconsOn, prefs.locale]);

  // Screen readers and the browser's own UI read this to choose pronunciation.
  useEffect(() => {
    document.documentElement.lang = LOCALE_TAGS[prefs.locale];
  }, [prefs.locale]);

  const updatePrefs = useCallback((patch: Partial<Preferences>) => {
    setPrefs((p) => ({ ...p, ...patch }));
  }, []);

  /** System messages: spoken unless a screen reader owns the voice, always announced to it. */
  const sayStatus = useCallback((text: string, interrupt = false) => {
    setStatusText(text);
    if (prefsRef.current.screenReaderMode) return;
    announceAudio(text, interrupt);
  }, []);

  /** Speech without a status update, for content that is already visible on screen. */
  const speakText = useCallback((text: string, interrupt = false) => {
    if (prefsRef.current.screenReaderMode) return;
    announceAudio(text, interrupt);
  }, []);

  const cue = useCallback((kind: Parameters<typeof earcon>[0]) => {
    if (!prefsRef.current.earconsOn) return;
    earcon(kind);
  }, []);

  const clearFirstSweepTimer = useCallback(() => {
    if (firstSweepTimer.current !== null) window.clearTimeout(firstSweepTimer.current);
    firstSweepTimer.current = null;
    setFirstSweepSlow(false);
  }, []);

  const emit = useCallback(
    (lines: NarrationLine[]) => {
      const delivered = lines.filter((l) => tierAllowed(l.tier, prefsRef.current.detail));
      if (delivered.length === 0) return;
      const [head, ...rest] = delivered;
      lastLine.current = head!;
      setActiveLine(head!);
      setHistory((prev) => [head!, ...rest, ...prev].slice(0, HISTORY_CAP));
      setSoundingIds(new Set(delivered.map((l) => l.concept)));
      if (!prefsRef.current.screenReaderMode) {
        if (prefsRef.current.speechOn) {
          speak(lineText(head!, prefsRef.current.locale), head!.tier, head!.tier === "critical");
        }
        if (prefsRef.current.earconsOn) for (const l of delivered) blip(l.tier, l.bearingDeg);
      } else if (prefsRef.current.earconsOn) {
        for (const l of delivered) blip(l.tier, l.bearingDeg);
      }
      window.setTimeout(() => setSoundingIds(new Set()), 900);
    },
    [],
  );

  const startSweep = useCallback(() => {
    const el = videoRef.current;
    const frame = el ? grabFrame(el) : null;
    if (!frame) return;

    sweepBusy.current = true;
    setSweep((s) => ({ ...s, inFlight: true }));

    const generation = ++sweepGen.current;
    const controller = new AbortController();
    sweepAbort.current = controller;
    const deadline = window.setTimeout(() => controller.abort(), SWEEP_BUDGET_MS);

    void runSweep(frame, LIVE_CONCEPTS, SWEEP_CONCURRENCY, controller.signal)
      .then((result) => {
        // Pause, reset, or a feed switch supersedes this sweep; late results must not
        // repopulate the scene or speak after the user stopped the loop.
        if (generation !== sweepGen.current) return;
        const c = counters.current;
        clearFirstSweepTimer();
        setSweep({ inFlight: false, lastDurationMs: result.durationMs, outcomes: result.outcomes });

        const failed = result.outcomes.filter((o) => !o.ok);
        if (result.scene) {
          lastScene.current = result.scene;
          const next = sceneToSpatial(result.scene);
          const completedAt = performance.now();
          gate.markRun(completedAt, next);
          c.segmented += 1;
          setObjects(next);
          setStats((s) => ({
            ...s,
            latencyMs: result.durationMs,
            segmented: c.segmented,
            coasted: c.coasted,
            objectsTracked: next.length,
          }));
          lastScanAt.current = completedAt;
          staleNotified.current = false;
          setViewAgeMs(0);
          cue("scan");
          emit(engine.update(next, completedAt));
        } else {
          c.segmented += 1;
          setStats((s) => ({ ...s, segmented: c.segmented, coasted: c.coasted }));
        }

        if (result.allFailed) {
          stopSpeech();
          setActiveLine(null);
        } else if (failed.length > 0) {
          // Partial failure is the dangerous case: the screen shows seven watched classes but
          // only four answered, and silence about a class reads as "nothing there".
          const locale = prefsRef.current.locale;
          const labels = failed
            .map((f) => conceptLabel(f.concept, locale, CONCEPTS_BY_ID.get(f.concept)?.label ?? f.concept))
            .join(", ");
          setCameraError(UI[locale].partialFailure(labels));
        }
      })
      .catch(() => {
        if (generation !== sweepGen.current) return;
        setSweep((s) => ({ ...s, inFlight: false }));
      })
      .finally(() => {
        if (generation !== sweepGen.current) return;
        window.clearTimeout(deadline);
        sweepBusy.current = false;
        sweepAbort.current = null;
        nextSweepAt.current = performance.now() + LIVE_SWEEP_INTERVAL_MS;
      });
  }, [clearFirstSweepTimer, cue, emit, engine, gate]);

  const step = useCallback(
    (nowMs: number) => {
      const c = counters.current;
      const tracked = lastScene.current ? sceneToSpatial(lastScene.current) : [];
      const needsRun = gate.shouldSegment(nowMs, tracked);

      if (provider === "meta") {
        // A sweep takes ~2s, so it can never happen inside the frame callback. The loop
        // always coasts on the last completed geometry and merely kicks off a refresh.
        if (needsRun && !sweepBusy.current && nowMs >= nextSweepAt.current) startSweep();
        c.coasted += 1;
        setStats((s) => ({ ...s, segmented: c.segmented, coasted: c.coasted }));
        emit(engine.update(tracked, nowMs));
      } else if (needsRun) {
        const scene = mockSceneAt(nowMs, c.frames);
        lastScene.current = scene;
        gate.markRun(nowMs, sceneToSpatial(scene));
        c.segmented += 1;
        const next = sceneToSpatial(scene);
        setObjects(next);
        setStats((s) => ({
          ...s,
          latencyMs: scene.latencyMs,
          segmented: c.segmented,
          coasted: c.coasted,
          objectsTracked: next.length,
        }));
        emit(engine.update(next, nowMs));
      } else {
        // Coast on tracked geometry: no API call, but narration still evaluates.
        c.coasted += 1;
        setStats((s) => ({ ...s, segmented: c.segmented, coasted: c.coasted }));
        emit(engine.update(tracked, nowMs));
      }

      c.frames += 1;
      if (nowMs - c.lastFpsAt > 500) {
        const span = (nowMs - c.lastFpsAt) / 1000;
        const fps = span > 0 ? (c.frames - (c.lastFrames ?? 0)) / span : 0;
        c.lastFrames = c.frames;
        c.lastFpsAt = nowMs;
        setStats((s) => ({
          ...s,
          fps: Math.round(fps * 10) / 10,
          hitRate: c.segmented + c.coasted === 0 ? 0 : c.coasted / (c.segmented + c.coasted),
        }));
      }
    },
    [emit, engine, gate, provider, startSweep],
  );

  useEffect(() => {
    if (!running) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    // Roughly 6fps of loop headroom; the gate, not the timer, decides real API volume.
    const interval = 160;
    let last = 0;
    const tick = (t: number) => {
      if (t - last >= interval) {
        last = t;
        step(t);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [running, step]);

  /**
   * View age and the staleness alarm. One tick per second is enough for both the readout
   * and a warning that has to interrupt a user's belief that the picture is current.
   */
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const at = lastScanAt.current;
      if (at === null) return;
      const age = performance.now() - at;
      setViewAgeMs(age);
      if (age >= STALE_AFTER_MS && !staleNotified.current) {
        staleNotified.current = true;
        cue("stale");
        sayStatus(UI[prefsRef.current.locale].stale(Math.round(age / 1000)));
      }
    }, 1_000);
    return () => window.clearInterval(id);
  }, [cue, running, sayStatus]);

  const start = useCallback(() => {
    ensureAudio();
    const firstRun = !prefsRef.current.onboarded;
    setCameraError(null);
    setSweep({ inFlight: false, lastDurationMs: null, outcomes: [] });
    setFirstSweepSlow(false);
    if (firstSweepTimer.current !== null) window.clearTimeout(firstSweepTimer.current);
    firstSweepTimer.current = window.setTimeout(
      () => setFirstSweepSlow(true),
      FIRST_SWEEP_GRACE_MS,
    );
    lastScanAt.current = null;
    staleNotified.current = false;
    setViewAgeMs(null);
    counters.current = {
      segmented: 0,
      coasted: 0,
      frames: 0,
      startedAt: performance.now(),
      lastFpsAt: 0,
      lastFrames: 0,
    };
    engine.reset();
    gate.reset();
    runningRef.current = true;
    setRunning(true);
    const t = UI[prefsRef.current.locale];
    if (firstRun) updatePrefs({ onboarded: true });
    // A blind user cannot see the Synthetic badge. Starting without a camera has to say so
    // before the first synthetic line is mistaken for their room.
    const opening = firstRun ? `${t.welcome} ${t.syntheticNotice}` : t.syntheticNotice;
    sayStatus(stream ? (firstRun ? t.welcome : t.started) : opening, true);
    cue("start");
  }, [cue, engine, gate, sayStatus, stream, updatePrefs]);

  const stop = useCallback(
    (spoken = true) => {
      const wasRunning = runningRef.current;
      runningRef.current = false;
      setRunning(false);
      // A sweep that lands after pause must not speak or repopulate the scene.
      sweepGen.current += 1;
      sweepAbort.current?.abort();
      sweepAbort.current = null;
      sweepBusy.current = false;
      stopSpeech();
      clearFirstSweepTimer();
      // The guarded completion will not run, so clear the in-flight flag here.
      setSweep((s) => ({ ...s, inFlight: false }));
      // A stale "6.0 fps" reads as a running loop, which is the one thing this status
      // row must never imply when the pipeline is actually halted.
      setStats((s) => ({ ...s, fps: 0, latencyMs: 0 }));
      if (spoken && wasRunning) {
        sayStatus(UI[prefsRef.current.locale].guidePaused, true);
        cue("stop");
      }
    },
    [clearFirstSweepTimer, cue, sayStatus],
  );

  const describeNow = useCallback(() => {
    const tracked = lastScene.current ? sceneToSpatial(lastScene.current) : [];
    const locale = prefsRef.current.locale;
    const text = describeSummary(tracked, locale, summarizeScene(tracked));
    const line: NarrationLine = {
      id: `manual-${Date.now()}`,
      text,
      concept: "summary",
      tier: tracked.some((o) => o.tier === "critical") ? "critical" : "informative",
      bearingDeg: tracked[0]?.bearingDeg ?? 0,
      distanceBand: tracked[0]?.distanceBand ?? "unknown",
      count: tracked.length,
      distanceM: tracked[0]?.distanceM ?? null,
      timestampMs: performance.now(),
      trigger: "manual",
    };
    lastLine.current = line;
    setActiveLine(line);
    setHistory((prev) => [line, ...prev].slice(0, HISTORY_CAP));
    // Explicit requests always answer, even with ambient narration muted; a screen
    // reader hears it through the live region instead of competing synthesis.
    if (prefsRef.current.screenReaderMode) setStatusText(text);
    else speak(text, line.tier, true);
  }, []);

  const repeatLast = useCallback(() => {
    const line = lastLine.current;
    if (!line) {
      sayStatus(UI[prefsRef.current.locale].nothingToRepeat);
      return;
    }
    const text = lineText(line, prefsRef.current.locale);
    setActiveLine(line);
    if (prefsRef.current.screenReaderMode) setStatusText(text);
    else speak(text, line.tier, true);
  }, [sayStatus]);

  const toggleCamera = useCallback(async () => {
    // A provider switch must not coast across feeds: narrating the last synthetic scene as
    // if the camera had seen it is exactly the kind of false claim this product forbids.
    sweepGen.current += 1;
    sweepAbort.current?.abort();
    sweepAbort.current = null;
    sweepBusy.current = false;
    lastScene.current = null;
    lastScanAt.current = null;
    staleNotified.current = false;
    setViewAgeMs(null);
    nextSweepAt.current = 0;
    gate.reset();
    engine.reset();
    stopSpeech();
    setObjects([]);
    setActiveLine(null);
    setSoundingIds(new Set());
    // Narration from the previous feed is not evidence about this one.
    setHistory([]);
    setSweep({ inFlight: false, lastDurationMs: null, outcomes: [] });
    clearFirstSweepTimer();
    counters.current = {
      segmented: 0,
      coasted: 0,
      frames: 0,
      startedAt: performance.now(),
      lastFpsAt: 0,
      lastFrames: 0,
    };
    setStats({ fps: 0, latencyMs: 0, segmented: 0, coasted: 0, hitRate: 0, objectsTracked: 0 });
    // A running loop needs a fresh grace window for the new feed's first sweep.
    if (runningRef.current) {
      firstSweepTimer.current = window.setTimeout(
        () => setFirstSweepSlow(true),
        FIRST_SWEEP_GRACE_MS,
      );
    }

    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
      setCameraError(null);
      sayStatus(UI[prefsRef.current.locale].cameraOff, true);
      cue("ready");
      return;
    }
    const t = UI[prefsRef.current.locale];
    if (!(await liveProxyReady())) {
      setCameraError(t.cameraNoProxy);
      return;
    }
    try {
      // A phone held upright should see the frame the user is looking at, not a landscape
      // crop of it. Asking for 9:16 lets the browser rotate or crop to portrait; the stage
      // then follows whatever aspect the stream actually delivers.
      const phonePortrait = window.matchMedia("(orientation: portrait) and (max-width: 760px)").matches;
      const s = await navigator.mediaDevices.getUserMedia({
        video: phonePortrait
          ? {
              width: { ideal: 720 },
              height: { ideal: 1280 },
              aspectRatio: { ideal: 9 / 16 },
              facingMode: "environment",
            }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" },
        audio: false,
      });
      setStream(s);
      setCameraError(null);
      sayStatus(UI[prefsRef.current.locale].cameraReady, true);
      cue("ready");
    } catch (error) {
      // The degraded notice speaks this, so it is not duplicated here. The failure names
      // differ by cause, and each one has a different recovery step for the user.
      const name = error instanceof DOMException ? error.name : "";
      const message = !window.isSecureContext
        ? t.cameraInsecure
        : name === "NotAllowedError" || name === "SecurityError"
          ? t.cameraDenied
          : name === "NotFoundError" || name === "DevicesNotFoundError"
            ? t.cameraMissing
            : name === "NotReadableError" || name === "TrackStartError" || name === "AbortError"
              ? t.cameraBusy
              : t.cameraUnavailable;
      setCameraError(message);
    }
  }, [clearFirstSweepTimer, cue, engine, gate, sayStatus, stream]);

  const reset = useCallback(() => {
    stop(false);
    engine.reset();
    gate.reset();
    nextSweepAt.current = 0;
    lastScene.current = null;
    lastLine.current = null;
    lastScanAt.current = null;
    staleNotified.current = false;
    setViewAgeMs(null);
    setObjects([]);
    setHistory([]);
    setActiveLine(null);
    setCameraError(null);
    setSweep({ inFlight: false, lastDurationMs: null, outcomes: [] });
    setStats({ fps: 0, latencyMs: 0, segmented: 0, coasted: 0, hitRate: 0, objectsTracked: 0 });
    sayStatus(UI[prefsRef.current.locale].guideReset);
  }, [engine, gate, sayStatus, stop]);

  useEffect(
    () => () => {
      stream?.getTracks().forEach((t) => t.stop());
    },
    [stream],
  );

  // Unmount only. This used to share the [stream] effect and its cleanup raced the first
  // sweep of a newly enabled camera, aborting it a few hundred milliseconds in.
  useEffect(
    () => () => {
      sweepAbort.current?.abort();
      if (firstSweepTimer.current !== null) window.clearTimeout(firstSweepTimer.current);
    },
    [],
  );

  const setSpeechOn = useCallback(
    (on: boolean) => {
      updatePrefs({ speechOn: on });
      const t = UI[prefsRef.current.locale];
      sayStatus(on ? t.narrationSpeechOn : t.narrationSpeechOff);
    },
    [sayStatus, updatePrefs],
  );

  const setDetail = useCallback(
    (detail: DetailLevel) => {
      updatePrefs({ detail });
      sayStatus(UI[prefsRef.current.locale].detailSpoken[detail]);
    },
    [sayStatus, updatePrefs],
  );

  const setSpeed = useCallback(
    (speed: SpeechSpeed) => {
      updatePrefs({ speed });
      setAudioPreferences({ speed, earconsOn: prefsRef.current.earconsOn });
      sayStatus(UI[prefsRef.current.locale].speedSpoken[speed]);
    },
    [sayStatus, updatePrefs],
  );

  const setEarconsOn = useCallback(
    (on: boolean) => {
      updatePrefs({ earconsOn: on });
      setAudioPreferences({ speed: prefsRef.current.speed, earconsOn: on });
      if (on) earcon("ready");
      const t = UI[prefsRef.current.locale];
      sayStatus(on ? t.earconsOnSpeech : t.earconsOffSpeech);
    },
    [sayStatus, updatePrefs],
  );

  const setScreenReaderMode = useCallback(
    (on: boolean) => {
      updatePrefs({ screenReaderMode: on });
      const t = UI[prefsRef.current.locale];
      if (on) {
        stopSpeech();
        setStatusText(t.screenReaderOn);
      } else {
        // prefsRef still holds the old value inside this handler, so sayStatus would
        // stay silent; the confirmation must be the first thing spoken again.
        setStatusText(t.screenReaderOff);
        announceAudio(t.screenReaderOff, true);
      }
    },
    [updatePrefs],
  );

  const setLocale = useCallback(
    (locale: Locale) => {
      updatePrefs({ locale });
      // Switch the voice before speaking the confirmation, so it lands in the new language.
      setAudioPreferences({
        speed: prefsRef.current.speed,
        earconsOn: prefsRef.current.earconsOn,
        locale,
      });
      const spec = localeSpec(locale);
      sayStatus(UI[locale].languageSpeech(spec.label), true);
    },
    [sayStatus, updatePrefs],
  );

  const vocabulary = useMemo<VocabularyRow[]>(() => {
    const byConcept = new Map<string, { count: number; confidence: number }>();
    for (const o of objects) {
      const e = byConcept.get(o.concept) ?? { count: 0, confidence: 0 };
      e.count += 1;
      e.confidence = Math.max(e.confidence, o.confidence);
      byConcept.set(o.concept, e);
    }
    return VOCABULARY.map((spec) => {
      const e = byConcept.get(spec.id);
      return {
        concept: spec.id,
        label: conceptLabel(spec.id, prefs.locale, spec.label),
        tier: spec.tier,
        count: e?.count ?? 0,
        confidence: e?.confidence ?? 0,
      };
    });
  }, [objects, prefs.locale]);

  /**
   * Degraded mode. An assistive device that cannot see must say so; the failure state that
   * matters is the silent one where the UI keeps looking healthy while the model is gone.
   */
  const degraded = useMemo<string | null>(() => {
    if (provider === "mock") return cameraError;
    // A paused guide is not a degraded one. Failure banners describe the live loop.
    if (!running) return null;
    const t = UI[prefs.locale];
    if (sweep.outcomes.length === 0) {
      if (!firstSweepSlow) return null;
      return sweep.inFlight ? null : t.degradedProxy;
    }
    const failed = sweep.outcomes.filter((o) => !o.ok);
    if (failed.length === sweep.outcomes.length) {
      const reason = failed[0]?.error ?? "unknown";
      if (reason.includes("timeout")) {
        return t.degradedTimeout(Math.round(SWEEP_BUDGET_MS / 1000));
      }
      if (reason === "aborterror") return t.degradedAborted;
      if (reason === "no_proxy" || reason === "bad_response") return t.degradedNoProxy;
      if (reason === "typeerror" || reason === "networkerror") return t.degradedUnreachable;
      return t.degradedUnavailable(reason);
    }
    return cameraError;
  }, [cameraError, firstSweepSlow, prefs.locale, provider, running, sweep.inFlight, sweep.outcomes]);

  // A banner nobody hears is not a warning. Speak each distinct degraded state once,
  // including camera failures in synthetic mode.
  const spokenDegraded = useRef<string | null>(null);
  useEffect(() => {
    if (!degraded) {
      spokenDegraded.current = null;
      return;
    }
    if (spokenDegraded.current === degraded) return;
    spokenDegraded.current = degraded;
    sayStatus(degraded);
    cue("error");
  }, [cue, degraded, sayStatus]);

  return {
    running,
    start,
    stop,
    reset,
    describeNow,
    repeatLast,
    objects,
    vocabulary,
    history,
    activeLine,
    soundingIds,
    stats,
    speechOn: prefs.speechOn,
    setSpeechOn,
    earconsOn: prefs.earconsOn,
    setEarconsOn,
    detail: prefs.detail,
    setDetail,
    speed: prefs.speed,
    setSpeed,
    locale: prefs.locale,
    setLocale,
    screenReaderMode: prefs.screenReaderMode,
    setScreenReaderMode,
    statusText,
    speakStatus: sayStatus,
    speakText,
    viewAgeMs,
    provider,
    stream,
    videoRef,
    toggleCamera,
    degraded,
    clearNotice: () => setCameraError(null),
    sweep,
    liveConcepts: LIVE_CONCEPTS,
  };
}

export type GuideController = ReturnType<typeof useGuide>;
