import type { HazardTier } from "@roomguide/core";
import type { VocabularyRow } from "../hooks/useGuide";
import { TierGlyph } from "./TierGlyph";

const GROUPS: Array<{ tier: HazardTier; title: string; note: string }> = [
  { tier: "critical", title: "Critical", note: "cannot be missed" },
  { tier: "caution", title: "Caution", note: "changes a step" },
  { tier: "informative", title: "Informative", note: "context, not verdict" },
];

/**
 * The attention budget. Twelve classes is the entire vocabulary of this system, and
 * showing it as a live ledger makes two things obvious to a judge: how narrow the scope
 * is, and which parts of it are actually firing right now. Grouping by consequence keeps
 * the hierarchy visible even when the counts are all zero.
 *
 * In live mode a third state is essential. One SAM 3.1 call answers one concept, so a sweep
 * queries a subset. A class that was never asked about must not render the same "—" as a
 * class that was asked and came back empty — that is precisely the untracked-vs-absent
 * confusion the rest of the product is built to avoid.
 */
export function VocabularyRail({
  rows,
  watched,
  failed,
}: {
  rows: VocabularyRow[];
  /** Concepts queried by the current sweep; null means every class is available (mock). */
  watched: Set<string> | null;
  /** Concepts that were asked about and got no answer. Neither empty nor untracked. */
  failed?: Set<string> | undefined;
}) {
  const activeCount = rows.filter((r) => r.count > 0).length;
  const queried = watched ? rows.filter((r) => watched.has(r.concept)).length : rows.length;

  return (
    <section className="rg-panel rg-rail" aria-label="Tracked vocabulary">
      <div className="rg-panel-head">
        <h2 className="rg-panel-title">Attention budget</h2>
        <span className="rg-chip">
          <b data-numeric>{activeCount}</b>/{watched ? `${queried} watched` : `${rows.length} live`}
        </span>
      </div>
      <div className="rg-panel-body">
        {GROUPS.map((group) => {
          const groupRows = rows.filter((r) => r.tier === group.tier);
          const firing = groupRows.filter((r) => r.count > 0).length;
          return (
            <div className="rg-vocab-group" key={group.tier}>
              <div className="rg-vocab-group-head">
                <h3 className="rg-vocab-group-title" data-tier={group.tier}>
                  {group.title}
                </h3>
                <span className="rg-vocab-group-note">{group.note}</span>
                <span className="rg-vocab-group-count" data-numeric>
                  {firing}/{groupRows.length}
                </span>
              </div>
              <ul className="rg-vocab-list">
                {groupRows.map((r) => {
                  const skipped = watched !== null && !watched.has(r.concept);
                  const unanswered = !skipped && failed?.has(r.concept) === true;
                  return (
                    <li
                      className="rg-concept"
                      key={r.concept}
                      data-active={r.count > 0}
                      data-skipped={skipped || undefined}
                      data-failed={unanswered || undefined}
                    >
                      <TierGlyph tier={r.tier} label={`${r.label}, ${r.tier}`} />
                      <span className="rg-concept-name">{r.label}</span>
                      <span
                        className="rg-concept-count"
                        data-zero={r.count === 0}
                        data-numeric
                        title={
                          skipped
                            ? "Not in the live watch list"
                            : unanswered
                              ? "No answer returned this sweep"
                              : undefined
                        }
                      >
                        {skipped ? "n/a" : unanswered ? "?" : r.count === 0 ? "—" : r.count}
                      </span>
                      {skipped && <span className="rg-visually-hidden">not in the live watch list</span>}
                      {unanswered && <span className="rg-visually-hidden">no answer this sweep</span>}
                      {!skipped && !unanswered && r.count > 0 && (
                        <span
                          className="rg-concept-bar"
                          data-tier={r.tier}
                          role="img"
                          aria-label={`${r.label} confidence ${Math.round(r.confidence * 100)} percent`}
                        >
                          <i style={{ width: `${Math.round(r.confidence * 100)}%` }} />
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        <p className="rg-hint">
          {watched
            ? "One SAM 3.1 call answers one concept, so a live sweep watches this subset and marks the rest n/a. A question mark means the call failed; not in the watch list is not the same as not there."
            : "Classes are chosen by fall consequence, not by convenience. Anything a sighted person would merely find interesting is deliberately absent."}
        </p>
      </div>
    </section>
  );
}
