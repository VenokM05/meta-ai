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
  type NarrationLine,
  type Scene,
  type SpatialObject,
} from "@roomguide/core";
import { blip, ensureAudio, speak, stopSpeech } from "../lib/audio";
import { mockSceneAt } from "../lib/mockScenes";
import {
  LIVE_CONCEPTS,
  SWEEP_BUDGET_MS,
  grabFrame,
  runSweep,
  type ConceptOutcome,
} from "../lib/metaProvider";

/** Parallel per-concept requests. Above this, rate limiting becomes the failure mode. */
const SWEEP_CONCURRENCY = 4;

/**
 * Minimum coast time between live sweeps. The gate's 1.2s ceiling was tuned for sub-frame
 * mock calls; at ~2.5s per live sweep it would restart the moment the last one landed. This
 * also stops a fast-failing proxy from being retried every loop tick.
 */
const LIVE_SWEEP_INTERVAL_MS = 4_000;

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

export function useGuide() {
  const [running, setRunning] = useState(false);
  const [objects, setObjects] = useState<SpatialObject[]>([]);
  const [history, setHistory] = useState<NarrationLine[]>([]);
  const [activeLine, setActiveLine] = useState<NarrationLine | null>(null);
  const [soundingIds, setSoundingIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<GuideStats>({
    fps: 0,
    latencyMs: 0,
    segmented: 0,
    coasted: 0,
    hitRate: 0,
    objectsTracked: 0,
  });
  const [speechOn, setSpeechOn] = useState(true);
  const [sonarOn, setSonarOn] = useState(true);

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
  const sweepBusy = useRef(false);
  const sweepAbort = useRef<AbortController | null>(null);
  const sweepGen = useRef(0);
  const nextSweepAt = useRef(0);
  const counters = useRef<LoopCounters>({
    segmented: 0,
    coasted: 0,
    frames: 0,
    startedAt: 0,
    lastFpsAt: 0,
    lastFrames: 0,
  });
  const speechRef = useRef(speechOn);
  const sonarRef = useRef(sonarOn);
  speechRef.current = speechOn;
  sonarRef.current = sonarOn;

  const emit = useCallback((lines: NarrationLine[]) => {
    if (lines.length === 0) return;
    const [head, ...rest] = lines;
    setActiveLine(head!);
    setHistory((prev) => [head!, ...rest, ...prev].slice(0, HISTORY_CAP));
    setSoundingIds(new Set(lines.map((l) => l.concept)));
    if (speechRef.current) speak(head!.text, head!.tier, head!.tier === "critical");
    if (sonarRef.current) for (const l of lines) blip(l.tier, l.bearingDeg);
    window.setTimeout(() => setSoundingIds(new Set()), 900);
  }, []);

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
          emit(engine.update(next, completedAt));
        } else {
          c.segmented += 1;
          setStats((s) => ({ ...s, segmented: c.segmented, coasted: c.coasted }));
        }

        if (result.allFailed) {
          stopSpeech();
          setActiveLine(null);
        } else if (failed.length > 0) {
          // Partial failure is the dangerous case: the screen shows six watched classes but
          // only four answered, and silence about a class reads as "nothing there".
          setCameraError(
            `No answer for ${failed
              .map((f) => CONCEPTS_BY_ID.get(f.concept)?.label ?? f.concept)
              .join(", ")} — those classes are untracked, not absent.`,
          );
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
  }, [emit, engine, gate]);

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

  const start = useCallback(() => {
    ensureAudio();
    setCameraError(null);
    setSweep({ inFlight: false, lastDurationMs: null, outcomes: [] });
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
    setRunning(true);
  }, [engine, gate]);

  const stop = useCallback(() => {
    setRunning(false);
    // A sweep that lands after pause must not speak or repopulate the scene.
    sweepGen.current += 1;
    sweepAbort.current?.abort();
    sweepAbort.current = null;
    sweepBusy.current = false;
    stopSpeech();
    // The guarded completion will not run, so clear the in-flight flag here.
    setSweep((s) => ({ ...s, inFlight: false }));
    // A stale "6.0 fps" reads as a running loop, which is the one thing this status
    // row must never imply when the pipeline is actually halted.
    setStats((s) => ({ ...s, fps: 0, latencyMs: 0 }));
  }, []);

  const describeNow = useCallback(() => {
    const tracked = lastScene.current ? sceneToSpatial(lastScene.current) : [];
    const line: NarrationLine = {
      id: `manual-${Date.now()}`,
      text: summarizeScene(tracked),
      concept: "summary",
      tier: tracked.some((o) => o.tier === "critical") ? "critical" : "informative",
      bearingDeg: tracked[0]?.bearingDeg ?? 0,
      distanceBand: tracked[0]?.distanceBand ?? "unknown",
      timestampMs: performance.now(),
      trigger: "manual",
    };
    setActiveLine(line);
    setHistory((prev) => [line, ...prev].slice(0, HISTORY_CAP));
    if (speechRef.current) speak(line.text, line.tier, true);
  }, []);

  const toggleCamera = useCallback(async () => {
    // A provider switch must not coast across feeds: narrating the last synthetic scene as
    // if the camera had seen it is exactly the kind of false claim this product forbids.
    sweepGen.current += 1;
    sweepAbort.current?.abort();
    sweepAbort.current = null;
    sweepBusy.current = false;
    lastScene.current = null;
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
    counters.current = {
      segmented: 0,
      coasted: 0,
      frames: 0,
      startedAt: performance.now(),
      lastFpsAt: 0,
      lastFrames: 0,
    };
    setStats({ fps: 0, latencyMs: 0, segmented: 0, coasted: 0, hitRate: 0, objectsTracked: 0 });

    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
      setCameraError(null);
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" },
        audio: false,
      });
      setStream(s);
      setCameraError(null);
    } catch {
      setCameraError("Camera unavailable. The synthetic feed keeps the pipeline fully explorable.");
    }
  }, [engine, gate, stream]);

  const reset = useCallback(() => {
    stop();
    engine.reset();
    gate.reset();
    nextSweepAt.current = 0;
    lastScene.current = null;
    setObjects([]);
    setHistory([]);
    setActiveLine(null);
    setCameraError(null);
    setSweep({ inFlight: false, lastDurationMs: null, outcomes: [] });
    setStats({ fps: 0, latencyMs: 0, segmented: 0, coasted: 0, hitRate: 0, objectsTracked: 0 });
  }, [engine, gate, stop]);

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
    },
    [],
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
        label: spec.label,
        tier: spec.tier,
        count: e?.count ?? 0,
        confidence: e?.confidence ?? 0,
      };
    });
  }, [objects]);

  /**
   * Degraded mode. An assistive device that cannot see must say so; the failure state that
   * matters is the silent one where the UI keeps looking healthy while the model is gone.
   */
  const degraded = useMemo<string | null>(() => {
    if (provider === "mock") return cameraError;
    // A paused guide is not a degraded one. Failure banners describe the live loop.
    if (!running) return null;
    if (sweep.outcomes.length === 0) {
      return sweep.inFlight
        ? null
        : "Live mode is on but no sweep has completed. Is the proxy running on port 8787?";
    }
    const failed = sweep.outcomes.filter((o) => !o.ok);
    if (failed.length === sweep.outcomes.length) {
      const reason = failed[0]?.error ?? "unknown";
      if (reason.includes("timeout")) {
        return `SAM 3.1 did not answer within ${Math.round(SWEEP_BUDGET_MS / 1000)}s. Narration is paused — the geometry on screen is stale.`;
      }
      if (reason === "aborterror") {
        return "The live sweep was cancelled. Narration is paused until a sweep completes.";
      }
      return `Segmentation is unavailable (${reason}). Narration is paused rather than guessed.`;
    }
    return cameraError;
  }, [cameraError, provider, running, sweep.inFlight, sweep.outcomes]);

  return {
    running,
    start,
    stop,
    reset,
    describeNow,
    objects,
    vocabulary,
    history,
    activeLine,
    soundingIds,
    stats,
    speechOn,
    setSpeechOn,
    sonarOn,
    setSonarOn,
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
