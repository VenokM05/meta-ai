import { useEffect } from "react";
import type { GuideController } from "../hooks/useGuide";
import { CameraStage } from "../components/CameraStage";
import { NarrationLog, NowSpeaking } from "../components/NarrationTicker";
import { SonarMap } from "../components/SonarMap";
import { TierGlyph } from "../components/TierGlyph";
import { VocabularyRail } from "../components/VocabularyRail";
import {
  IconAlert,
  IconCamera,
  IconPause,
  IconPlay,
  IconSpark,
  IconVolume,
  IconVolumeOff,
} from "../lib/icons";

export function GuideScreen({ guide }: { guide: GuideController }) {
  // Keyboard shortcuts mirror every primary control; nothing here is mouse-only.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.key === " ") {
        e.preventDefault();
        guide.running ? guide.stop() : guide.start();
      } else if (e.key.toLowerCase() === "d") {
        guide.describeNow();
      } else if (e.key.toLowerCase() === "s") {
        guide.setSpeechOn(!guide.speechOn);
      } else if (e.key === "Escape") {
        guide.stop();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [guide]);

  const gateTotal = guide.stats.segmented + guide.stats.coasted;
  const live = guide.provider === "meta";
  const unanswered = new Set(guide.sweep.outcomes.filter((o) => !o.ok).map((o) => o.concept));
  const unansweredCount = guide.sweep.outcomes.filter((o) => !o.ok).length;

  const readouts: Array<{ label: string; value: string | number }> = [
    { label: "Segmented", value: guide.stats.segmented },
    { label: "Coasted", value: guide.stats.coasted },
    {
      label: "Gate skip",
      value: gateTotal > 0 ? `${Math.round(guide.stats.hitRate * 100)}%` : "—",
    },
    { label: "Tracked", value: guide.stats.objectsTracked },
    ...(live
      ? [
          {
            label: "Sweep",
            value: guide.sweep.inFlight
              ? "running…"
              : guide.sweep.lastDurationMs !== null
                ? `${(guide.sweep.lastDurationMs / 1000).toFixed(1)} s`
                : "—",
          },
          { label: "Unanswered", value: unansweredCount },
        ]
      : []),
  ];

  return (
    <div className="rg-guide">
      <div className="rg-hero">
        <div className="rg-hero-media">
          <CameraStage
            objects={guide.objects}
            videoStream={guide.stream}
            soundingConcepts={guide.soundingIds}
            provider={guide.provider}
            videoRef={guide.videoRef}
          />
          <SonarMap
            objects={guide.objects}
            soundingConcepts={guide.soundingIds}
            variant="hud"
          />

          <div className="rg-stage-legend">
            <span className="rg-legend-item">
              <span aria-hidden="true">
                <TierGlyph tier="critical" label="Critical" />
              </span>
              Critical
            </span>
            <span className="rg-legend-item">
              <span aria-hidden="true">
                <TierGlyph tier="caution" label="Caution" />
              </span>
              Caution
            </span>
            <span className="rg-legend-item">
              <span aria-hidden="true">
                <TierGlyph tier="informative" label="Informative" />
              </span>
              Informative
            </span>
            <span className="rg-legend-note">Dashed corridor marks the path ahead</span>
          </div>
        </div>

        <aside className="rg-hero-side" aria-label="Narration and controls">
          <p className="rg-standfirst">
            A periodic scan of what is ahead. It describes what it sees, and never claims the path is
            clear.
          </p>

          <NowSpeaking
            activeLine={guide.activeLine}
            running={guide.running}
            lineCount={guide.history.length}
          />

          <div className="rg-hero-actions">
            <div className="rg-controls">
              <button
                type="button"
                className="rg-btn rg-btn--primary"
                onClick={() => (guide.running ? guide.stop() : guide.start())}
                aria-keyshortcuts="Space"
              >
                {guide.running ? <IconPause /> : <IconPlay />}
                <span>{guide.running ? "Pause guide" : "Start guide"}</span>
              </button>

              <button type="button" className="rg-btn" onClick={guide.describeNow} aria-keyshortcuts="D">
                <IconSpark />
                <span>Describe now</span>
              </button>

              <button
                type="button"
                className={guide.speechOn ? "rg-btn" : "rg-btn rg-btn--ghost"}
                onClick={() => guide.setSpeechOn(!guide.speechOn)}
                aria-pressed={guide.speechOn}
                aria-keyshortcuts="S"
              >
                {guide.speechOn ? <IconVolume /> : <IconVolumeOff />}
                <span>{guide.speechOn ? "Speech on" : "Speech muted"}</span>
              </button>

              <button
                type="button"
                className="rg-btn"
                onClick={() => void guide.toggleCamera()}
                aria-pressed={guide.stream !== null}
              >
                <IconCamera />
                <span>{guide.stream ? "Synthetic feed" : "Use my camera"}</span>
              </button>

              <button type="button" className="rg-btn rg-btn--ghost" onClick={guide.reset}>
                <span>Reset</span>
              </button>
            </div>

            <p className="rg-shortcut-note">
              Space start or pause · D describe now · S mute speech · Esc stop
            </p>
          </div>
        </aside>
      </div>

      {guide.degraded && (
        <div className="rg-notice rg-notice--warn" role="alert">
          <IconAlert />
          <span>{guide.degraded}</span>
          <button type="button" className="rg-btn rg-btn--ghost" onClick={guide.clearNotice}>
            <span>Dismiss</span>
          </button>
        </div>
      )}

      <dl className="rg-readout-strip" aria-label="Pipeline readout">
        {readouts.map((r) => (
          <div className="rg-readout" key={r.label}>
            <dt>{r.label}</dt>
            <dd data-numeric>{r.value}</dd>
          </div>
        ))}
      </dl>

      <p className="rg-hint rg-hint--strip">
        {live
          ? `Each sweep is ${guide.liveConcepts.length} separate SAM 3.1 calls — one concept per call, measured at roughly 1.6-2.2s each — four lanes at a time. A sweep takes 2.5-5.6s wall clock, then a 4s coast follows, so geometry can be up to ~10s old. Skip rate counts every frame that reused it.`
          : "Skip rate is the share of loop iterations that avoided a segmentation call. A high number is the gate working, not the model being idle."}
      </p>

      <div className="rg-deck">
        <VocabularyRail
          rows={guide.vocabulary}
          watched={live ? new Set(guide.liveConcepts) : null}
          failed={live ? unanswered : undefined}
        />
        <NarrationLog history={guide.history} activeId={guide.activeLine?.id} />
      </div>
    </div>
  );
}
