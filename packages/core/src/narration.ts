import { bearingPhrase, distancePhrase } from "./geometry";
import { CONCEPTS_BY_ID, TIER_ORDER } from "./vocabulary";
import type { DistanceBand, NarrationLine, SpatialObject } from "./types";

export interface NarrationConfig {
  /** Global minimum gap between any two utterances, so audio stays followable. */
  minGapMs: number;
  /** After this long unobserved, an object returning is announced as new again. */
  forgetAfterMs: number;
  /** Hard cap on sentences per update. */
  maxLinesPerUpdate: number;
  /** Objects seen in fewer frames than this are ignored, killing single-frame flicker. */
  minSeenFrames: number;
}

export const DEFAULT_NARRATION: NarrationConfig = {
  minGapMs: 2_200,
  forgetAfterMs: 12_000,
  maxLinesPerUpdate: 2,
  minSeenFrames: 2,
};

interface TrackState {
  firstSeenMs: number;
  lastSeenMs: number;
  lastSpokenMs: number | null;
  lastBand: DistanceBand | null;
  seenFrames: number;
  /**
   * How long this track was absent immediately before its current sighting. Captured
   * during the presence pass because `lastSeenMs` is overwritten in that same pass —
   * reading it later would always report a gap of one frame.
   */
  gapMs: number;
}

const BAND_DEPTH: Record<DistanceBand, number> = { near: 0, mid: 1, far: 2, unknown: 3 };

/** Identity is concept + bearing sector, so a chair stays "the chair on the left". */
function trackKey(o: SpatialObject): string {
  const sector = o.bearingDeg < -20 ? "L" : o.bearingDeg > 20 ? "R" : "C";
  return `${o.concept}:${sector}`;
}

function pluralize(label: string, count: number, alreadyPlural: boolean): string {
  const lower = label.toLowerCase();
  if (count <= 1 || alreadyPlural) return lower;
  if (/s$|x$|z$|ch$|sh$/.test(lower)) return `${lower}es`;
  return `${lower}s`;
}

/**
 * Article choice, because "a stairs" and "a open door" make the whole system sound
 * unpolished to a judge within one sentence.
 */
function articleFor(name: string, count: number, alreadyPlural: boolean): string {
  if (count > 1) return `${count} `;
  if (alreadyPlural) return "";
  return /^[aeiou]/i.test(name) ? "an " : "a ";
}

export function sentenceFor(group: SpatialObject[]): string {
  const head = group[0]!;
  const alreadyPlural = CONCEPTS_BY_ID.get(head.concept)?.plural === true;
  const name = pluralize(head.label, group.length, alreadyPlural);
  const article = articleFor(name, group.length, alreadyPlural);
  const where = bearingPhrase(head.bearingDeg);
  const dist = distancePhrase(head.distanceBand, head.distanceM);
  // "A few steps ahead, straight ahead" says it twice; the distance already carries it.
  const bearing = where === "straight ahead" ? "" : `, ${where}`;
  return `${article}${name}, ${dist}${bearing}.`;
}

/**
 * Decides what is worth saying this frame.
 *
 * The hard part is suppression, not generation: an unfiltered loop repeats "chair" forty
 * times a minute and becomes worthless within seconds. So a stationary object is spoken
 * once and then only re-announced when something actually changed — it closed the distance,
 * or it left and came back. Everything else is silence.
 */
export class NarrationEngine {
  private tracks = new Map<string, TrackState>();
  private lastSpeechMs = -Infinity;
  private cfg: NarrationConfig;

  constructor(cfg: NarrationConfig = DEFAULT_NARRATION) {
    this.cfg = cfg;
  }

  reset(): void {
    this.tracks.clear();
    this.lastSpeechMs = -Infinity;
  }

  update(objects: SpatialObject[], nowMs: number): NarrationLine[] {
    const groups = new Map<string, SpatialObject[]>();
    for (const o of objects) {
      const key = trackKey(o);
      const bucket = groups.get(key) ?? [];
      bucket.push(o);
      groups.set(key, bucket);
    }

    // Presence bookkeeping. Absent tracks keep their old lastSeenMs, which is what makes
    // "came back" detectable at all.
    for (const [key, state] of this.tracks) {
      if (groups.has(key)) {
        // Capture the absence length only on the absent->present edge. Recapturing it on
        // every frame would overwrite it with "one frame" precisely when the debounce
        // delay consumes the sighting, so returns would never be announced.
        if (state.seenFrames === 0) state.gapMs = nowMs - state.lastSeenMs;
        state.seenFrames += 1;
        state.lastSeenMs = nowMs;
      } else {
        state.seenFrames = 0;
      }
    }

    const candidates: Array<{
      line: NarrationLine;
      state: TrackState;
      deepest: DistanceBand;
      tierOrder: number;
      rank: number;
    }> = [];

    for (const [key, group] of groups) {
      group.sort((a, b) => b.urgency - a.urgency);
      const head = group[0]!;

      let state = this.tracks.get(key);
      if (!state) {
        state = {
          firstSeenMs: nowMs,
          lastSeenMs: nowMs,
          lastSpokenMs: null,
          lastBand: null,
          seenFrames: 1,
          gapMs: 0,
        };
        this.tracks.set(key, state);
      }
      if (state.seenFrames < this.cfg.minSeenFrames) continue;

      const deepest = group.reduce(
        (acc, o) => (BAND_DEPTH[o.distanceBand] < BAND_DEPTH[acc] ? o.distanceBand : acc),
        head.distanceBand,
      );
      const closingIn =
        state.lastBand !== null && BAND_DEPTH[deepest] < BAND_DEPTH[state.lastBand];
      const wasGoneLong = state.gapMs > this.cfg.forgetAfterMs;

      let trigger: NarrationLine["trigger"] | null = null;
      if (state.lastSpokenMs === null) trigger = "new";
      else if (closingIn) trigger = "approaching";
      else if (wasGoneLong) trigger = "reappeared";
      if (trigger === null) continue;

      // A hazard outranks the throttle; an interesting object does not.
      const throttled = nowMs - this.lastSpeechMs < this.cfg.minGapMs;
      if (throttled && head.tier !== "critical") continue;

      const text =
        trigger === "approaching" ? `Moving closer: ${sentenceFor(group)}` : sentenceFor(group);

      candidates.push({
        state,
        deepest,
        line: {
          id: `${key}:${nowMs}`,
          text,
          concept: head.concept,
          tier: head.tier,
          bearingDeg: head.bearingDeg,
          distanceBand: deepest,
          count: group.length,
          distanceM: head.distanceM,
          timestampMs: nowMs,
          trigger,
        },
        tierOrder: TIER_ORDER[head.tier],
        rank: head.urgency,
      });
    }

    candidates.sort((a, b) => a.tierOrder - b.tierOrder || b.rank - a.rank);

    const chosen = candidates.slice(0, this.cfg.maxLinesPerUpdate);
    // Only mark as spoken once a line is actually emitted. Committing this earlier would
    // silently retire every object that lost the budget race and never let it speak.
    for (const c of chosen) {
      c.state.lastSpokenMs = nowMs;
      c.state.lastBand = c.deepest;
      // Consume the return flag, otherwise this object would be announced as "came back"
      // on every subsequent frame.
      c.state.gapMs = 0;
    }

    const emitted = chosen.map((c) => c.line);
    if (emitted.length > 0) this.lastSpeechMs = nowMs;
    return emitted;
  }
}
