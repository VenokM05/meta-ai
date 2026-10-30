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
 * The ticker is the audit trail for the narration. Every line carries the reason it fired,
 * which turns a black-box demo into something a judge can interrogate.
 */
export function NarrationTicker({
  activeLine,
  history,
  running,
}: {
  activeLine: NarrationLine | null;
  history: NarrationLine[];
  running: boolean;
}) {
  return (
    <section className="rg-panel rg-ticker" aria-label="Narration">
      <div className="rg-panel-head">
        <h2 className="rg-panel-title">Spoken now</h2>
        <span className="rg-chip">
          <b data-numeric>{history.length}</b> lines
        </span>
      </div>

      {/* polite, not assertive: the screen reader must not be interrupted by ambient chatter. */}
      <div className="rg-ticker-live" aria-live="polite" aria-busy={!running}>
        <p className="rg-ticker-now">
          {activeLine ? activeLine.text : running ? "Listening. Nothing new to report." : "Not running."}
        </p>
        {activeLine && (
          <div className="rg-ticker-meta">
            <span className="rg-tag" data-tier={activeLine.tier}>
              {activeLine.tier}
            </span>
            <span className="rg-tag" data-tone="neutral">
              {TRIGGER_LABEL[activeLine.trigger]}
            </span>
            <span className="rg-tag" data-tone="neutral">
              {clock(activeLine.timestampMs)}
            </span>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <ul className="rg-history">
          {history.slice(1, 9).map((line, i) => (
            <li key={`${line.id}-${i}`}>
              <time dateTime={undefined}>{clock(line.timestampMs)}</time>
              <TierGlyph tier={line.tier} />
              <span>{line.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
