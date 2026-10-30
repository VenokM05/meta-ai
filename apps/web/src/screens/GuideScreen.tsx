import { useEffect, useState } from "react";
import type { GuideController } from "../hooks/useGuide";
import { CameraStage } from "../components/CameraStage";
import { NarrationTicker } from "../components/NarrationTicker";
import { SonarMap } from "../components/SonarMap";
import { VocabularyRail } from "../components/VocabularyRail";
import { IconPause, IconPlay, IconSpark, IconVolume, IconVolumeOff } from "../lib/icons";

export function GuideScreen({ guide }: { guide: GuideController }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  async function toggleCamera() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
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
  }

  useEffect(
    () => () => {
      stream?.getTracks().forEach((t) => t.stop());
    },
    [stream],
  );

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

  return (
    <div className="rg-stage">
      <VocabularyRail rows={guide.vocabulary} />

      <div className="rg-canvas">
        <CameraStage
          objects={guide.objects}
          videoStream={stream}
          soundingConcepts={guide.soundingIds}
          provider="mock"
        />

        {cameraError && (
          <div className="rg-notice" role="status">
            <IconSpark />
            <span>{cameraError}</span>
          </div>
        )}

        <NarrationTicker activeLine={guide.activeLine} history={guide.history} running={guide.running} />

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

          <button type="button" className="rg-btn" onClick={toggleCamera} aria-pressed={stream !== null}>
            <span>{stream ? "Use synthetic feed" : "Use my camera"}</span>
          </button>

          <button type="button" className="rg-btn rg-btn--ghost" onClick={guide.reset}>
            <span>Reset</span>
          </button>
        </div>

        <p className="rg-shortcut-note">
          Space start or pause · D describe now · S mute speech · Esc stop
        </p>
      </div>

      <div className="rg-sonar">
        <SonarMap objects={guide.objects} soundingConcepts={guide.soundingIds} />

        <section className="rg-panel" aria-label="Pipeline metrics">
          <div className="rg-panel-head">
            <h2 className="rg-panel-title">Pipeline</h2>
          </div>
          <div className="rg-panel-body">
            <dl className="rg-dl">
              <div>
                <dt>Segmented</dt>
                <dd data-numeric>{guide.stats.segmented}</dd>
              </div>
              <div>
                <dt>Coasted on track</dt>
                <dd data-numeric>{guide.stats.coasted}</dd>
              </div>
              <div>
                <dt>Gate skip rate</dt>
                <dd data-numeric>
                  {gateTotal > 0 ? `${Math.round(guide.stats.hitRate * 100)}%` : "—"}
                </dd>
              </div>
              <div>
                <dt>Objects tracked</dt>
                <dd data-numeric>{guide.stats.objectsTracked}</dd>
              </div>
            </dl>
            <p className="rg-hint">
              Skip rate is the share of loop iterations that avoided a segmentation call. A high number is
              the gate working, not the model being idle.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
