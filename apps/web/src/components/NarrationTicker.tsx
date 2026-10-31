import type { NarrationLine } from "@roomguide/core";
import { TierGlyph } from "./TierGlyph";

const TRIGGER_LABEL: Record<NarrationLine["trigger"], string> = {
  new: "first seen",
  approaching: "closing in",
  reappeared: "came back",
  manual: "on request",
};

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
}: {
  activeLine: NarrationLine | null;
  running: boolean;
  lineCount: number;
}) {
  return (
    <section className="rg-now" aria-label="Spoken now">
      <div className="rg-now-eyebrow">
        <span className="rg-now-signal" data-on={running} aria-hidden="true" />
        <span>{running ? "Spoken now" : "Paused"}</span>
        <span className="rg-now-count" data-numeric>
          {lineCount} {lineCount === 1 ? "line" : "lines"}
        </span>
      </div>

      {/* polite, not assertive: the screen reader must not be interrupted by ambient chatter. */}
      <div className="rg-now-body" aria-live="polite" aria-busy={!running}>
        <p className="rg-now-line">
          {activeLine ? activeLine.text : running ? "Listening. Nothing new to report." : "Not running."}
        </p>
        {activeLine && (
          <div className="rg-now-meta">
            <span className="rg-tag" data-tier={activeLine.tier}>
              {activeLine.tier}
            </span>
            <span className="rg-tag" data-tone="neutral">
              {TRIGGER_LABEL[activeLine.trigger]}
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
}: {
  history: NarrationLine[];
  activeId?: string | null | undefined;
}) {
  const rows = activeId ? history.filter((line) => line.id !== activeId) : history;

  return (
    <section className="rg-panel rg-log" aria-label="Narration log">
      <div className="rg-panel-head">
        <h2 className="rg-panel-title">Narration log</h2>
        <span className="rg-chip">
          <b data-numeric>{history.length}</b> lines
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="rg-log-empty">
          {history.length > 0
            ? "The current line is still the only one in this session."
            : "No narration yet. Start the guide and every spoken line lands here with the reason it fired."}
        </p>
      ) : (
        <ul className="rg-log-list">
          {rows.map((line) => (
            <li key={line.id}>
              <time data-numeric>{clock(line.timestampMs)}</time>
              <TierGlyph tier={line.tier} />
              <div className="rg-log-entry">
                <span className="rg-log-text">{line.text}</span>
                <span className="rg-log-meta" data-tier={line.tier}>
                  {TRIGGER_LABEL[line.trigger]} · {line.tier}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
