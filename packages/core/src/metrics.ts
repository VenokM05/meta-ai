import { CONCEPTS_BY_ID } from "./vocabulary";
import type { HazardTier } from "./types";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GroundTruth {
  concept: string;
  bbox: Box;
  /** Human label: would a miss here cause a fall or a collision? */
  hazard: boolean;
}

export interface EvalPrediction {
  concept: string;
  bbox: Box;
  confidence: number;
}

export interface LabeledTruth {
  truth: GroundTruth;
  matched: boolean;
}

export interface ClassStats {
  tp: number;
  fp: number;
  fn: number;
  recall: number;
  precision: number;
  falseNegativeRate: number;
}

export interface EvalImageResult {
  image: string;
  labeled: LabeledTruth[];
  predictions: EvalPrediction[];
  perClass: Record<string, ClassStats>;
  missed: GroundTruth[];
  /** Ground-truth hazards with no matching prediction. The safety-critical number. */
  missedHazards: GroundTruth[];
}

export function iou(a: Box, b: Box): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union <= 0 ? 0 : inter / union;
}

/**
 * Greedy one-to-one matching, highest IoU first.
 *
 * Matching uses bounding boxes, not mask polygons. That is a real limitation and should
 * be stated in the submission: a model can localise a hazard sloppily yet overlap it
 * enough to be counted a hit. Mask IoU is the follow-up measurement.
 */
export function match(truth: GroundTruth[], preds: EvalPrediction[], iouThreshold: number) {
  const pairs: Array<{ t: number; p: number; score: number }> = [];
  truth.forEach((t, ti) =>
    preds.forEach((p, pi) => {
      if (t.concept !== p.concept) return;
      const score = iou(t.bbox, p.bbox);
      if (score >= iouThreshold) pairs.push({ t: ti, p: pi, score });
    }),
  );
  pairs.sort((a, b) => b.score - a.score);

  const usedT = new Set<number>();
  const usedP = new Set<number>();
  for (const pair of pairs) {
    if (usedT.has(pair.t) || usedP.has(pair.p)) continue;
    usedT.add(pair.t);
    usedP.add(pair.p);
  }
  return { usedT, usedP };
}

export function emptyStats(): ClassStats {
  return { tp: 0, fp: 0, fn: 0, recall: 0, precision: 0, falseNegativeRate: 0 };
}

export function finalize(s: ClassStats): ClassStats {
  const detected = s.tp + s.fn;
  return {
    tp: s.tp,
    fp: s.fp,
    fn: s.fn,
    recall: detected === 0 ? 0 : s.tp / detected,
    precision: s.tp + s.fp === 0 ? 0 : s.tp / (s.tp + s.fp),
    falseNegativeRate: detected === 0 ? 0 : s.fn / detected,
  };
}

function addonto(target: Map<string, ClassStats>, id: string, delta: Partial<ClassStats>): ClassStats {
  if (!target.has(id)) target.set(id, emptyStats());
  const s = target.get(id)!;
  s.tp += delta.tp ?? 0;
  s.fp += delta.fp ?? 0;
  s.fn += delta.fn ?? 0;
  return s;
}

export function scoreImage(
  image: string,
  truth: GroundTruth[],
  preds: EvalPrediction[],
  iouThreshold = 0.5,
): EvalImageResult {
  const { usedT, usedP } = match(truth, preds, iouThreshold);

  const perClass = new Map<string, ClassStats>();
  truth.forEach((t, i) => {
    addonto(perClass, t.concept, usedT.has(i) ? { tp: 1 } : { fn: 1 });
  });
  preds.forEach((p, i) => {
    if (!usedP.has(i)) addonto(perClass, p.concept, { fp: 1 });
  });

  const missed = truth.filter((_, i) => !usedT.has(i));

  return {
    image,
    labeled: truth.map((t, i) => ({ truth: t, matched: usedT.has(i) })),
    predictions: preds,
    missed,
    missedHazards: missed.filter((t) => t.hazard),
    perClass: Object.fromEntries([...perClass].map(([k, v]) => [k, finalize(v)])),
  };
}

export interface TierStats extends ClassStats {
  /** How many hazard-labelled truths were in this tier at all. */
  hazardTruth: number;
  hazardMissed: number;
}

export interface AggregateReport {
  images: number;
  totalTruth: number;
  overall: ClassStats;
  perClass: Record<string, ClassStats>;
  perTier: Record<string, TierStats>;
  /** Headline safety number: of everything a human labelled hazard-critical, what went unseen. */
  hazardRecall: number;
  results: EvalImageResult[];
}

export const TIER_LABELS: HazardTier[] = ["critical", "caution", "informative"];

export function aggregate(results: EvalImageResult[]): AggregateReport {
  const perClass = new Map<string, ClassStats>();
  const perTier = new Map<string, TierStats>();
  let totalTruth = 0;
  let hazardTruth = 0;
  let hazardMissed = 0;

  // Seed every tier so consumers can iterate the result without guarding for absent
  // classes; a tier with no labelled truths renders as 0%, not as a missing row.
  for (const tier of TIER_LABELS) tierStatRef(perTier, tier);

  function tierStatRef(map: Map<string, TierStats>, tier: string): TierStats {
    if (!map.has(tier)) map.set(tier, { ...emptyStats(), hazardTruth: 0, hazardMissed: 0 });
    return map.get(tier)!;
  }

  const tierStat = (tier: string) => tierStatRef(perTier, tier);

  for (const r of results) {
    for (const [id, s] of Object.entries(r.perClass)) addonto(perClass, id, s);

    for (const { truth, matched } of r.labeled) {
      const tier = CONCEPTS_BY_ID.get(truth.concept)?.tier ?? "informative";
      const t = tierStat(tier);
      if (matched) t.tp += 1;
      else t.fn += 1;
      if (truth.hazard) {
        hazardTruth += 1;
        t.hazardTruth += 1;
        if (!matched) {
          hazardMissed += 1;
          t.hazardMissed += 1;
        }
      }
      totalTruth += 1;
    }
  }

  const overall = emptyStats();
  for (const s of perClass.values()) {
    overall.tp += s.tp;
    overall.fp += s.fp;
    overall.fn += s.fn;
  }

  const finalizedTiers: Record<string, TierStats> = {};
  for (const [tier, s] of perTier) finalizedTiers[tier] = { ...finalize(s), hazardTruth: s.hazardTruth, hazardMissed: s.hazardMissed };

  return {
    images: results.length,
    totalTruth,
    overall: finalize(overall),
    perClass: Object.fromEntries([...perClass].map(([k, v]) => [k, finalize(v)])),
    perTier: finalizedTiers,
    hazardRecall: hazardTruth === 0 ? 0 : (hazardTruth - hazardMissed) / hazardTruth,
    results,
  };
}
