import type { NarrationLine } from "@roomguide/core";
import { UI, lineText, type Locale } from "../lib/i18n";
import { TierGlyph } from "./TierGlyph";

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * The teleprompter. It sits beside the image rather than on top of it: for a
 * low-vision reader, a stable high-contrast column beats text over moving video.
 */
export function NowSpeaking({
  activeLine,
  running,
  lineCount,
  locale,
}: {
  activeLine: NarrationLine | null;
  running: boolean;
  lineCount: number;
  locale: Locale;
}) {
  const t = UI[locale];
  return (
    <section className="rg-now" aria-label={t.spokenNow}>
      <div className="rg-now-eyebrow">
        <span className="rg-now-signal" data-on={running} aria-hidden="true" />
        <span>{running ? t.spokenNow : t.pausedNow}</span>
        <span className="rg-now-count" data-numeric>
          {t.lineCount(lineCount)}
        </span>
      </div>

      {/* polite, not assertive: the screen reader must not be interrupted by ambient chatter. */}
      <div className="rg-now-body" aria-live="polite" aria-busy={!running}>
        <p className="rg-now-line">
          {activeLine
            ? lineText(activeLine, locale)
            : running
              ? t.listening
              : t.notRunning}
        </p>
        {activeLine && (
          <div className="rg-now-meta">
            <span className="rg-tag" data-tier={activeLine.tier}>
              {t.tier[activeLine.tier]}
            </span>
            <span className="rg-tag" data-tone="neutral">
              {t.trigger[activeLine.trigger]}
            </span>
            <time className="rg-now-time" data-numeric>
              {clock(activeLine.timestampMs)}
            </time>
          </div>
        )}
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
