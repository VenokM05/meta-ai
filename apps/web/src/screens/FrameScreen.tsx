import { useMemo, useState } from "react";
import { DEFAULT_CAMERA, VOCABULARY, sceneToSpatial, summarizeScene } from "@roomguide/core";
import { mockSceneAt } from "../lib/mockScenes";
import { CameraStage } from "../components/CameraStage";
import { SonarMap } from "../components/SonarMap";
import { IconPlay } from "../lib/icons";

/**
 * Single-frame mode: one photo, one description, no loop. This is the v1 path — the one
 * that cannot fail during judging because there is no streaming, no gate and no timing
 * budget to hold together.
 */
export function FrameScreen() {
  const [frameTime, setFrameTime] = useState(11_000);
  const [analysed, setAnalysed] = useState<{ at: number; seed: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const objects = useMemo(() => {
    if (!analysed) return [];
    const scene = mockSceneAt(analysed.at + analysed.seed, 0);
    return sceneToSpatial(scene, DEFAULT_CAMERA);
  }, [analysed]);

  async function analyse() {
    setBusy(true);
    // Stands in for the real round trip so loading states are exercised, not decorative.
    await new Promise((r) => setTimeout(r, 420));
    setAnalysed({ at: frameTime, seed: Math.floor(Math.random() * 34_000) });
    setBusy(false);
  }

  return (
    <div className="rg-page">
      <header className="rg-page-head">
        <p className="rg-eyebrow">Mode 02 · one image, one description</p>
        <h1>Single frame</h1>
        <p>
          One image in, one description out. Nothing streams, nothing races a latency budget, and the
          narration is produced by the same geometry and language code the live guide uses.
        </p>
      </header>

      <div className="rg-notice rg-notice--accent" role="note">
        <IconPlay />
        <span>
          Mock provider active: the detections below are synthetic scene fixtures, so this screen validates
          the pipeline end to end. It is not evidence of model accuracy — that is what the Quality page is for.
        </span>
      </div>

      <div className="rg-hero">
        <div className="rg-hero-media">
          <CameraStage
            objects={objects}
            videoStream={null}
            soundingConcepts={new Set()}
            provider="mock"
          />
        </div>

        <aside className="rg-hero-side" aria-label="Frame analysis">
          <section className="rg-reading" aria-label="Reading">
            <p className="rg-eyebrow">Reading</p>
            <p className="rg-reading-line" aria-live="polite">
              {analysed ? summarizeScene(objects) : "No frame analysed yet."}
            </p>
            <p className="rg-hint">
              {VOCABULARY.length} concepts are promptable. Any object outside them is reported as untracked,
              never as absent.
            </p>
          </section>

          <section className="rg-panel" aria-label="Source">
            <div className="rg-panel-head">
              <h2 className="rg-panel-title">Source</h2>
            </div>
            <div className="rg-panel-body">
              <div className="rg-field">
                <label htmlFor="frame-time">Scene moment</label>
                <div className="rg-slider-row">
                  <input
                    id="frame-time"
                    type="range"
                    min={0}
                    max={33}
                    step={1}
                    value={Math.round(frameTime / 1000)}
                    onChange={(e) => setFrameTime(Number(e.target.value) * 1000)}
                  />
                  <output htmlFor="frame-time" data-numeric className="rg-chip">
                    {Math.round(frameTime / 1000)} s
                  </output>
                </div>
                <p className="rg-hint">Drag to pick a different synthetic scene, then analyse it.</p>
              </div>

              <button
                type="button"
                className="rg-btn rg-btn--primary"
                onClick={analyse}
                disabled={busy}
                style={{ marginTop: "var(--rg-sp-4)", width: "100%" }}
              >
                <span>{busy ? "Analysing…" : "Analyse frame"}</span>
              </button>
            </div>
          </section>
        </aside>
      </div>

      {analysed && <SonarMap objects={objects} soundingConcepts={new Set()} />}
    </div>
  );
}
