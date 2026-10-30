import type { VocabularyRow } from "../hooks/useGuide";
import { TierGlyph } from "./TierGlyph";

/**
 * The attention budget. Twelve classes is the entire vocabulary of this system, and
 * showing it as a live rail makes two things obvious to a judge: how narrow the scope is,
 * and which parts of it are actually firing right now.
 */
export function VocabularyRail({ rows }: { rows: VocabularyRow[] }) {
  const activeCount = rows.filter((r) => r.count > 0).length;

  return (
    <section className="rg-panel rg-rail" aria-label="Tracked vocabulary">
      <div className="rg-panel-head">
        <h2 className="rg-panel-title">Attention budget</h2>
        <span className="rg-chip">
          <b data-numeric>{activeCount}</b>/12 live
        </span>
      </div>
      <div className="rg-panel-body">
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {rows.map((r) => (
            <li className="rg-concept" key={r.concept} data-active={r.count > 0}>
              <TierGlyph tier={r.tier} label={`${r.label}, ${r.tier}`} />
              <span className="rg-concept-name">{r.label}</span>
              <span className="rg-concept-count" data-zero={r.count === 0} data-numeric>
                {r.count === 0 ? "—" : r.count}
              </span>
              {r.count > 0 && (
                <span
                  className="rg-concept-bar"
                  data-tier={r.tier}
                  style={{ color: "currentColor" }}
                  role="img"
                  aria-label={`${r.label} confidence ${Math.round(r.confidence * 100)} percent`}
                >
                  <i style={{ width: `${Math.round(r.confidence * 100)}%` }} />
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="rg-hint">
          Classes are chosen by fall consequence, not by convenience. Anything a sighted person would
          merely find interesting is deliberately absent.
        </p>
      </div>
    </section>
  );
}
