import { useCallback, useEffect, useRef, useState } from "react";
import { STALE_AFTER_MS, type GuideController } from "../hooks/useGuide";
import { useAimCoach } from "../hooks/useAimCoach";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useWakeLock } from "../hooks/useWakeLock";
import { LOCALES, UI, type Locale } from "../lib/i18n";
import type { DetailLevel, SpeechSpeed } from "../lib/preferences";
import { AimCoachPanel } from "../components/AimCoachPanel";
import { CameraStage } from "../components/CameraStage";
import { NarrationLog, NowSpeaking } from "../components/NarrationTicker";
import { SonarMap } from "../components/SonarMap";
import { TierGlyph } from "../components/TierGlyph";
import { VocabularyRail } from "../components/VocabularyRail";
import {
  IconAlert,
  IconCamera,
  IconHelp,
  IconPause,
  IconPlay,
  IconRepeat,
  IconSettings,
  IconSpark,
  IconTarget,
  IconVolume,
  IconVolumeOff,
} from "../lib/icons";

export function GuideScreen({ guide }: { guide: GuideController }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const helpHeading = useRef<HTMLHeadingElement | null>(null);
  const helpButton = useRef<HTMLButtonElement | null>(null);
  const t = UI[guide.locale];
  const compact = useMediaQuery("(max-width: 760px)");

  // Status messages are one-off events, not a steady state. Leaving the last one on screen
  // makes a running guide still look like it is starting, and it truncates on a phone.
  const [showStatus, setShowStatus] = useState(false);
  useEffect(() => {
    if (!guide.statusText) {
      setShowStatus(false);
      return;
    }
    setShowStatus(true);
    const id = window.setTimeout(() => setShowStatus(false), 7_000);
    return () => window.clearTimeout(id);
  }, [guide.statusText]);

  // The screen is not being watched; keep it from sleeping mid-session.
  useWakeLock(guide.running);

  const aim = useAimCoach({
    cameraOn: guide.stream !== null,
    announce: guide.speakStatus,
    locale: guide.locale,
  });

  // Scanning owns the audio channel. Starting it silently ends aim coaching rather than
  // layering direction calls over hazard narration.
  const startGuide = useCallback(() => {
    if (aim.active) aim.stop(null);
    guide.start();
  }, [aim, guide]);

  const toggleHelp = useCallback(() => {
    const next = !helpOpen;
    setHelpOpen(next);
    if (next) {
      // A screen reader will read the panel itself; everyone else hears it.
      guide.speakText(t.helpSpoken, true);
      requestAnimationFrame(() => helpHeading.current?.focus());
    } else {
      helpButton.current?.focus();
    }
  }, [guide, helpOpen, t]);

  // Keyboard shortcuts mirror every primary control; nothing here is mouse-only.
  // Space is left to focused buttons and form fields so standard activation still works.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "SELECT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "BUTTON" ||
          el.tagName === "A" ||
          el.isContentEditable)
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (e.key === " ") {
        e.preventDefault();
        guide.running ? guide.stop() : startGuide();
      } else if (e.key === "Escape") {
        if (helpOpen) {
          setHelpOpen(false);
          helpButton.current?.focus();
        } else {
          guide.stop();
        }
      } else if (key === "d") {
        e.preventDefault();
        guide.describeNow();
      } else if (key === "r") {
        e.preventDefault();
        guide.repeatLast();
      } else if (key === "s") {
        guide.setSpeechOn(!guide.speechOn);
      } else if (key === "a") {
        e.preventDefault();
        aim.toggle();
      } else if (key === "h") {
        e.preventDefault();
        toggleHelp();
      } else if (key === "1") {
        guide.setDetail("critical");
      } else if (key === "2") {
        guide.setDetail("caution");
      } else if (key === "3") {
        guide.setDetail("all");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aim, guide, helpOpen, startGuide, toggleHelp]);

  const gateTotal = guide.stats.segmented + guide.stats.coasted;
  const live = guide.provider === "meta";
  const unanswered = new Set(guide.sweep.outcomes.filter((o) => !o.ok).map((o) => o.concept));
  const unansweredCount = guide.sweep.outcomes.filter((o) => !o.ok).length;
  const viewAgeS =
    guide.viewAgeMs === null ? null : Math.max(0, Math.round(guide.viewAgeMs / 1000));
  const stale = guide.running && guide.viewAgeMs !== null && guide.viewAgeMs >= STALE_AFTER_MS;

  const readouts: Array<{ label: string; value: string | number; stale?: boolean; title?: string }> = [
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
          {
            label: "View age",
            value: viewAgeS === null ? "—" : `${viewAgeS} s`,
            stale,
            title: `Seconds since the last completed live sweep. Past ${STALE_AFTER_MS / 1000}s the guide tones and says the view is stale.`,
          },
          { label: "Unanswered", value: unansweredCount },
        ]
      : []),
  ];

  return (
    <div className="rg-guide">
      {/* The other screens have a real h1; without one, heading navigation lands on Sonar. */}
      <h1 className="rg-visually-hidden">{t.navGuide}</h1>

      {/* System messages for screen readers: start, pause, camera, failures, staleness. */}
      <p className="rg-visually-hidden" role="status" aria-live="polite">
        {guide.statusText}
      </p>

      <div className="rg-hero">
        <div className="rg-hero-media">
          <CameraStage
            objects={guide.objects}
            videoStream={guide.stream}
            soundingConcepts={guide.soundingIds}
            provider={guide.provider}
            videoRef={guide.videoRef}
            locale={guide.locale}
          />
          <SonarMap
            objects={guide.objects}
            soundingConcepts={guide.soundingIds}
            variant="hud"
          />

          <div className="rg-stage-legend" aria-label={t.legendAria}>
            <span className="rg-legend-item">
              <span aria-hidden="true">
                <TierGlyph tier="critical" label={t.tier.critical} />
              </span>
              {t.tier.critical}
            </span>
            <span className="rg-legend-item">
              <span aria-hidden="true">
                <TierGlyph tier="caution" label={t.tier.caution} />
              </span>
              {t.tier.caution}
            </span>
            <span className="rg-legend-item">
              <span aria-hidden="true">
                <TierGlyph tier="informative" label={t.tier.informative} />
              </span>
              {t.tier.informative}
            </span>
            <span className="rg-legend-note">{t.corridorNote}</span>
          </div>
        </div>

        <aside className="rg-hero-side" aria-label={t.asideLabel}>
          <p className="rg-standfirst">{t.standfirst}</p>

          <NowSpeaking
            activeLine={guide.activeLine}
            running={guide.running}
            lineCount={guide.history.length}
            locale={guide.locale}
          />

          <div className="rg-hero-actions">
            <div className="rg-controls">
              {/* On phones these five live in the fixed bottom dock; rendering them here
                  too would duplicate every command in the accessibility tree. */}
              {!compact && (
                <>
                  <button
                    type="button"
                    className="rg-btn rg-btn--primary"
                    onClick={() => (guide.running ? guide.stop() : startGuide())}
                    aria-keyshortcuts="Space"
                  >
                    {guide.running ? <IconPause /> : <IconPlay />}
                    <span>{guide.running ? t.pause : t.start}</span>
                  </button>

                  <button
                    type="button"
                    className="rg-btn"
                    onClick={guide.describeNow}
                    aria-keyshortcuts="D"
                  >
                    <IconSpark />
                    <span>{t.describe}</span>
                  </button>

                  <button
                    type="button"
                    className="rg-btn"
                    onClick={guide.repeatLast}
                    aria-keyshortcuts="R"
                  >
                    <IconRepeat />
                    <span>{t.repeat}</span>
                  </button>

                  <button
                    type="button"
                    className={guide.speechOn ? "rg-btn" : "rg-btn rg-btn--ghost"}
                    onClick={() => guide.setSpeechOn(!guide.speechOn)}
                    aria-pressed={guide.speechOn}
                    aria-keyshortcuts="S"
                  >
                    {guide.speechOn ? <IconVolume /> : <IconVolumeOff />}
                    <span>{guide.speechOn ? t.narrationOn : t.narrationOff}</span>
                  </button>
                </>
              )}

              <button
                type="button"
                className="rg-btn"
                onClick={() => void guide.toggleCamera()}
                aria-pressed={guide.stream !== null}
              >
                <IconCamera />
                <span>{guide.stream ? t.useSynthetic : t.useCamera}</span>
              </button>

              <button
                type="button"
                className={aim.active ? "rg-btn rg-btn--active" : "rg-btn"}
                onClick={aim.toggle}
                aria-pressed={aim.active}
                aria-keyshortcuts="A"
                title={t.aimTitle}
              >
                <IconTarget />
                <span>{aim.active ? t.stopAiming : t.aimCoach}</span>
              </button>

              {!compact && (
                <button
                  type="button"
                  className={helpOpen ? "rg-btn rg-btn--active" : "rg-btn"}
                  onClick={toggleHelp}
                  aria-expanded={helpOpen}
                  aria-controls="rg-help"
                  aria-keyshortcuts="H"
                  ref={helpButton}
                >
                  <IconHelp />
                  <span>{t.help}</span>
                </button>
              )}

            </div>

            {aim.active && <AimCoachPanel aim={aim} locale={guide.locale} />}

            <p className="rg-voice-status" aria-hidden="true">
              <span className="rg-voice-status-dot" data-on={guide.running} />
              <span className="rg-voice-status-text">
                {showStatus ? guide.statusText : guide.running ? t.voiceScanning : t.voiceStopped}
              </span>
            </p>

            <p className="rg-shortcut-note">{t.shortcutNote}</p>

            <details className="rg-audio-settings">
              <summary>
                <IconSettings />
                {t.audioSettings}
              </summary>
              <div className="rg-audio-grid">
                <div className="rg-field">
                  <label htmlFor="rg-detail">{t.detailLabel}</label>
                  <select
                    id="rg-detail"
                    value={guide.detail}
                    onChange={(e) => guide.setDetail(e.target.value as DetailLevel)}
                  >
                    <option value="critical">{t.detailCriticalOption}</option>
                    <option value="caution">{t.detailCautionOption}</option>
                    <option value="all">{t.detailAllOption}</option>
                  </select>
                </div>

                <div className="rg-field">
                  <label htmlFor="rg-speed">{t.speedLabel}</label>
                  <select
                    id="rg-speed"
                    value={guide.speed}
                    onChange={(e) => guide.setSpeed(e.target.value as SpeechSpeed)}
                  >
                    <option value="slow">{t.speedSlowOption}</option>
                    <option value="normal">{t.speedNormalOption}</option>
                    <option value="fast">{t.speedFastOption}</option>
                  </select>
                </div>

                <div className="rg-field rg-field--wide">
                  <label htmlFor="rg-language">{t.languageLabel}</label>
                  <select
                    id="rg-language"
                    value={guide.locale}
                    onChange={(e) => guide.setLocale(e.target.value as Locale)}
                  >
                    {LOCALES.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                  <small className="rg-field-hint">{t.languageHint}</small>
                </div>

                <label className="rg-check">
                  <input
                    type="checkbox"
                    checked={guide.earconsOn}
                    onChange={(e) => guide.setEarconsOn(e.target.checked)}
                  />
                  <span>
                    <b>{t.earconsLabel}</b>
                    <small>{t.earconsHint}</small>
                  </span>
                </label>

                <label className="rg-check">
                  <input
                    type="checkbox"
                    checked={guide.screenReaderMode}
                    onChange={(e) => guide.setScreenReaderMode(e.target.checked)}
                  />
                  <span>
                    <b>{t.screenReaderLabel}</b>
                    <small>{t.screenReaderHint}</small>
                  </span>
                </label>
              </div>
              <p className="rg-audio-note">{t.detailNote}</p>
            </details>

            {/* Destructive controls sit last, away from the buttons a thumb reaches for. */}
            <button type="button" className="rg-btn rg-btn--ghost rg-btn--wide" onClick={guide.reset}>
              <span>{t.resetSession}</span>
            </button>
          </div>
        </aside>
      </div>

      {helpOpen && (
        <section className="rg-help" id="rg-help" aria-labelledby="rg-help-title">
          <div className="rg-help-head">
            <h2 className="rg-help-title" id="rg-help-title" tabIndex={-1} ref={helpHeading}>
              {t.helpTitle}
            </h2>
            <button
              type="button"
              className="rg-btn rg-btn--ghost"
              onClick={() => {
                setHelpOpen(false);
                helpButton.current?.focus();
              }}
            >
              <span>{t.close}</span>
            </button>
          </div>

          <p className="rg-help-lead">{t.helpLead}</p>

          <ul className="rg-help-list">
            {t.helpKeys.map((s) => (
              <li key={s.keys}>
                <kbd>{s.keys}</kbd>
                <span>{s.action}</span>
              </li>
            ))}
          </ul>

          <p className="rg-help-note">{t.helpNoteDetail}</p>

          <p className="rg-help-note">{t.helpNoteAim}</p>
        </section>
      )}

      {guide.degraded && (
        <div className="rg-notice rg-notice--warn" role="alert">
          <IconAlert />
          <span>{guide.degraded}</span>
          <button type="button" className="rg-btn rg-btn--ghost" onClick={guide.clearNotice}>
            <span>{t.dismiss}</span>
          </button>
        </div>
      )}

      <dl className="rg-readout-strip" aria-label="Pipeline readout">
        {readouts.map((r) => (
          <div className="rg-readout" key={r.label} title={r.title}>
            <dt>{r.label}</dt>
            <dd data-numeric data-stale={r.stale || undefined}>
              {r.value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="rg-hint rg-hint--strip">
        {live
          ? `Each sweep is ${guide.liveConcepts.length} separate SAM 3.1 calls — one concept per call, measured at roughly 1.6-2.2s each — four lanes at a time. A sweep takes 4.2-6.8s wall clock, then a 4s coast follows, so geometry can be up to ~11s old. View age counts from the last completed sweep; past ${STALE_AFTER_MS / 1000}s the guide tones and says the view is stale.`
          : "Skip rate is the share of loop iterations that avoided a segmentation call. A high number is the gate working, not the model being idle."}
      </p>

      <div className="rg-deck">
        <VocabularyRail
          rows={guide.vocabulary}
          watched={live ? new Set(guide.liveConcepts) : null}
          failed={live ? unanswered : undefined}
        />
        <NarrationLog history={guide.history} activeId={guide.activeLine?.id} locale={guide.locale} />
      </div>

      {/* Phone shell: five thumb-sized commands pinned to the bottom edge. Everything
          else (camera, aim, settings, log) stays in the scrolling page. */}
      {compact && (
        <nav className="rg-dock" aria-label={t.asideLabel}>
          <button
            type="button"
            className="rg-dock-btn rg-dock-btn--primary"
            onClick={() => (guide.running ? guide.stop() : startGuide())}
            aria-keyshortcuts="Space"
          >
            {guide.running ? <IconPause /> : <IconPlay />}
            <span>{guide.running ? t.pause : t.start}</span>
          </button>
          <button type="button" className="rg-dock-btn" onClick={guide.describeNow} aria-keyshortcuts="D">
            <IconSpark />
            <span>{t.dockDescribe}</span>
          </button>
          <button type="button" className="rg-dock-btn" onClick={guide.repeatLast} aria-keyshortcuts="R">
            <IconRepeat />
            <span>{t.dockRepeat}</span>
          </button>
          <button
            type="button"
            className="rg-dock-btn"
            onClick={() => guide.setSpeechOn(!guide.speechOn)}
            aria-pressed={guide.speechOn}
            aria-keyshortcuts="S"
          >
            {guide.speechOn ? <IconVolume /> : <IconVolumeOff />}
            <span>{guide.speechOn ? t.dockNarrationOn : t.dockNarrationOff}</span>
          </button>
          <button
            type="button"
            className={helpOpen ? "rg-dock-btn rg-dock-btn--active" : "rg-dock-btn"}
            onClick={toggleHelp}
            aria-expanded={helpOpen}
            aria-controls="rg-help"
            aria-keyshortcuts="H"
            ref={helpButton}
          >
            <IconHelp />
            <span>{t.help}</span>
          </button>
        </nav>
      )}
    </div>
  );
}
