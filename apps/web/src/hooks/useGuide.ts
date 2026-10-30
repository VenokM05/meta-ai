import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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

  const engine = useMemo(() => new NarrationEngine(DEFAULT_NARRATION), []);
  const gate = useMemo(() => new KeyframeGate(DEFAULT_GATE), []);
  const rafRef = useRef<number | null>(null);
  const lastScene = useRef<Scene | null>(null);
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

  const step = useCallback(
    (nowMs: number) => {
      const c = counters.current;
      const tracked = lastScene.current ? sceneToSpatial(lastScene.current) : [];
      const needsRun = gate.shouldSegment(nowMs, tracked);

      if (needsRun) {
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
    [emit, engine, gate],
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
    stopSpeech();
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

  const reset = useCallback(() => {
    stop();
    engine.reset();
    gate.reset();
    lastScene.current = null;
    setObjects([]);
    setHistory([]);
    setActiveLine(null);
    setStats({ fps: 0, latencyMs: 0, segmented: 0, coasted: 0, hitRate: 0, objectsTracked: 0 });
  }, [engine, gate, stop]);

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
  };
}

export type GuideController = ReturnType<typeof useGuide>;
