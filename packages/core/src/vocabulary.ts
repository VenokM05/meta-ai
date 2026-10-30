import type { HazardTier } from "./types";

export interface ConceptSpec {
  id: string;
  /** SAM 3.1 concept prompt. Lower-case, singular, no articles. */
  prompt: string;
  label: string;
  tier: HazardTier;
  /** Typical real-world width in metres, used by the pinhole distance proxy. */
  referenceWidthM: number;
  /** Per-class floor. Deliberately conservative on hazard classes. */
  minConfidence: number;
  /** Nouns already plural in use, so narration never says "a stairs". */
  plural?: true;
}

/**
 * Twelve classes chosen by consequence, not by convenience: every entry here is
 * something a long-cane user cannot reliably detect before committing a step.
 * Anything that is merely interesting is excluded — narrow vocabulary is the point.
 */
export const VOCABULARY: ConceptSpec[] = [
  { id: "stairs",       prompt: "stairs",       label: "Stairs",       tier: "critical",    referenceWidthM: 0.9,  minConfidence: 0.35, plural: true },
  { id: "step",         prompt: "step",         label: "Step",         tier: "critical",    referenceWidthM: 0.6,  minConfidence: 0.35 },
  { id: "gap",          prompt: "gap",          label: "Gap",          tier: "critical",    referenceWidthM: 0.5,  minConfidence: 0.35 },
  { id: "cord",         prompt: "cord",         label: "Cord",         tier: "critical",    referenceWidthM: 0.6,  minConfidence: 0.3 },
  { id: "person",       prompt: "person",       label: "Person",       tier: "critical",    referenceWidthM: 0.5,  minConfidence: 0.35 },
  { id: "open_door",    prompt: "open door",    label: "Open door",    tier: "critical",    referenceWidthM: 0.9,  minConfidence: 0.3 },
  { id: "crossing",     prompt: "crossing",     label: "Crossing",     tier: "critical",    referenceWidthM: 1.4,  minConfidence: 0.3 },
  { id: "curb",         prompt: "curb",         label: "Curb",         tier: "caution",     referenceWidthM: 1.2,  minConfidence: 0.3 },
  { id: "chair",        prompt: "chair",        label: "Chair",        tier: "caution",     referenceWidthM: 0.5,  minConfidence: 0.3 },
  { id: "pole",         prompt: "pole",         label: "Pole",         tier: "caution",     referenceWidthM: 0.25, minConfidence: 0.3 },
  { id: "cup_liquid",   prompt: "cup",          label: "Cup of liquid", tier: "informative", referenceWidthM: 0.09, minConfidence: 0.4 },
  { id: "doorway",      prompt: "doorway",      label: "Doorway",      tier: "informative", referenceWidthM: 0.9,  minConfidence: 0.35 },
];

export const CONCEPTS_BY_ID: ReadonlyMap<string, ConceptSpec> = new Map(
  VOCABULARY.map((c) => [c.id, c]),
);

export const TIER_ORDER: Record<HazardTier, number> = {
  critical: 0,
  caution: 1,
  informative: 2,
};

/**
 * Acoustic identity per tier. Conveying priority by sound as well as colour means the
 * interface works with the display off — which is the actual use case.
 */
export const TIER_SONIFICATION: Record<HazardTier, { baseHz: number; panRange: number }> = {
  critical: { baseHz: 880, panRange: 0.9 },
  caution: { baseHz: 520, panRange: 0.7 },
  informative: { baseHz: 330, panRange: 0.5 },
};
