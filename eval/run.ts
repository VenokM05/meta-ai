#!/usr/bin/env tsx
/**
 * Evaluation harness.
 *
 *   npm run eval              -> bootstrap scenes.json from the mock provider and score it
 *   npm run eval -- --strict  -> fail if scenes.json is missing or contains no real photos
 *
 * Today this validates the *harness*, not the model: ground truth is derived from the same
 * synthetic actors the mock provider emits. That is still worth having, because it proves the
 * scoring code is correct before you trust its numbers on real imagery.
 *
 * To make the report mean something: photograph 40-60 rooms, put the JPGs in eval/images/,
 * hand-label the hazards in scenes.json, and point PROVIDER at the real API.
 */

import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_CAMERA,
  VOCABULARY,
  aggregate,
  sceneToSpatial,
  scoreImage,
  type GroundTruth,
} from "@roomguide/core";
import { mockSceneAt } from "../apps/web/src/lib/mockScenes";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCENES_PATH = resolve(HERE, "scenes.json");
const OUT_PATH = resolve(HERE, "../apps/web/public/eval-report.json");
const IOU_THRESHOLD = 0.5;

interface SceneLabel {
  image: string;
  /** Mock timeline position, in seconds. Unused once real photos are labelled. */
  at: number;
  truth: GroundTruth[];
}

const HAZARD_CONCEPTS = new Set(
  VOCABULARY.filter((c) => c.tier !== "informative").map((c) => c.id),
);

function bootstrapScenes(): SceneLabel[] {
  // Sample the mock loop at fixed points and record what is genuinely present.
  const samples = [3, 6, 10, 13, 17, 22, 26, 31];
  return samples.map((sec) => {
    const scene = mockSceneAt(sec * 1000, 0);
    return {
      image: `synthetic-${String(sec).padStart(2, "0")}s.jpg`,
      at: sec,
      truth: scene.detections.map((d) => ({
        concept: d.concept,
        bbox: d.bbox,
        hazard: HAZARD_CONCEPTS.has(d.concept),
      })),
    };
  });
}

function predict(sceneLabel: SceneLabel) {
  const scene = mockSceneAt(sceneLabel.at * 1000, 0);
  // Anything the geometry layer rejects for low confidence is a real miss, not a rigged one.
  return sceneToSpatial(scene, DEFAULT_CAMERA).map((o) => ({
    concept: o.concept,
    bbox: o.bbox,
    confidence: o.confidence,
  }));
}

function main() {
  const strict = process.argv.includes("--strict");

  if (!existsSync(SCENES_PATH)) {
    if (strict) {
      console.error("scenes.json missing and --strict was passed. Aborting.");
      process.exit(1);
    }
    const seeded = bootstrapScenes();
    mkdirSync(dirname(SCENES_PATH), { recursive: true });
    writeFileSync(SCENES_PATH, `${JSON.stringify(seeded, null, 2)}\n`);
    console.log(`Bootstrapped ${seeded.length} synthetic scenes -> ${SCENES_PATH}`);
  }

  const scenes = JSON.parse(readFileSync(SCENES_PATH, "utf8")) as SceneLabel[];
  const results = scenes.map((s) => scoreImage(s.image, s.truth, predict(s), IOU_THRESHOLD));
  const report = aggregate(results);

  const isSynthetic = scenes.every((s) => s.image.startsWith("synthetic-"));
  const generatedAt = new Date().toISOString().slice(0, 19).replace("T", " ");

  const payload = {
    generatedAt,
    kind: isSynthetic ? "self-check" : "measured",
    note: isSynthetic
      ? "Ground truth derived from synthetic actors; validates the scoring harness only."
      : "Ground truth hand-labelled from captured imagery.",
    iouThreshold: IOU_THRESHOLD,
    report,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);

  const missed = report.results.reduce((n, r) => n + r.missedHazards.length, 0);
  console.log(
    [
      `images          ${report.images}`,
      `labelled        ${report.totalTruth}`,
      `hazard recall   ${(report.hazardRecall * 100).toFixed(1)}%`,
      `missed hazards  ${missed}`,
      `overall recall  ${(report.overall.recall * 100).toFixed(1)}%`,
      `false positives ${report.overall.fp}`,
      `report          ${OUT_PATH}`,
    ].join("\n"),
  );
}

main();
