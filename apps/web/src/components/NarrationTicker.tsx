import type { NarrationLine } from "@roomguide/core";
import { UI, lineText, type Locale } from "../lib/i18n";
import { IconRepeat } from "../lib/icons";
import { TierGlyph } from "./TierGlyph";

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * The latest guidance card. On a phone it sits directly under the camera and above
 * everything else, because the last thing the guide said is the thing a user needs
 * to confirm. Freshness lives in the card so old geometry can never masquerade as new.
 */
export function NowSpeaking({
  activeLine,
  running,
  lineCount,
  locale,
  viewAgeMs,
  stale,
  provider,
  onReplay,
}: {
  activeLine: NarrationLine | null;
  running: boolean;
  lineCount: number;
  locale: Locale;
  viewAgeMs: number | null;
  stale: boolean;
  provider: "mock" | "meta";
  onReplay: () => void;
}) {
  const t = UI[locale];
  const ageS = viewAgeMs === null ? null : Math.max(0, Math.round(viewAgeMs / 1000));
  const freshness =
    stale && ageS !== null
      ? t.outdated
      : running && ageS !== null
        ? t.updatedAgo(ageS)
        : t.lineCount(lineCount);

  return (
    <section className="rg-now" data-stale={stale || undefined} aria-label={t.spokenNow}>
      <div className="rg-now-eyebrow">
        <span className="rg-now-signal" data-on={running} aria-hidden="true" />
        <span className="rg-now-state">
          {running ? (provider === "mock" ? t.feedSynthetic : t.feedLive) : t.pausedNow}
        </span>
        <span className="rg-now-freshness" data-numeric data-stale={stale || undefined}>
          {freshness}
        </span>
      </div>

      <div className="rg-now-body">
        {/* Live region wraps only what changed; the replay control is not announcement. */}
        <div className="rg-now-live" aria-live="polite">
          {activeLine && (
            <div className="rg-now-meta">
              <span className="rg-tag" data-tier={activeLine.tier}>
                {activeLine.tier === "critical" ? <TierGlyph tier="critical" /> : null}
                {t.tier[activeLine.tier]}
              </span>
              <span className="rg-now-trigger">{t.trigger[activeLine.trigger]}</span>
            </div>
          )}

          <p className="rg-now-line">
            {activeLine
              ? lineText(activeLine, locale)
              : running
                ? t.listening
                : t.notRunning}
          </p>
        </div>

        <div className="rg-now-foot">
          <span className="rg-now-label">{t.spokenNow}</span>
          {activeLine && (
            <time className="rg-now-time" data-numeric>
              {clock(activeLine.timestampMs)}
            </time>
          )}
          <button
            type="button"
            className="rg-now-replay"
            onClick={onReplay}
            disabled={!activeLine}
          >
            <IconRepeat />
            <span>{t.repeat}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * The audit trail. Every line carries the reason it fired, which turns a
 * black-box demo into something a judge can interrogate.
 */
export function NarrationLog({
  history,
  activeId,
  locale,
}: {
  history: NarrationLine[];
  activeId?: string | null | undefined;
  locale: Locale;
}) {
  const t = UI[locale];
  const rows = activeId ? history.filter((line) => line.id !== activeId) : history;

  return (
    <section className="rg-panel rg-log" aria-label={t.logTitle}>
      <div className="rg-panel-head">
        <h2 className="rg-panel-title">{t.logTitle}</h2>
        <span className="rg-chip">
          <b data-numeric>{t.logLines(history.length)}</b>
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="rg-log-empty">
          {history.length > 0 ? t.logOnlyLine : t.logEmpty}
        </p>
      ) : (
        <ul className="rg-log-list">
          {rows.map((line) => (
            <li key={line.id}>
              <time data-numeric>{clock(line.timestampMs)}</time>
              <TierGlyph tier={line.tier} />
              <div className="rg-log-entry">
                <span className="rg-log-text">{lineText(line, locale)}</span>
                <span className="rg-log-meta" data-tier={line.tier}>
                  {t.trigger[line.trigger]} · {t.tier[line.tier]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
