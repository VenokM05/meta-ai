import { useEffect, useState } from "react";
import type { AggregateReport, ClassStats } from "@roomguide/core";
import { CONCEPTS_BY_ID } from "@roomguide/core";
import { BulletChart, Notice } from "../components/Charts";
import { IconGauge } from "../lib/icons";

const labelFor = (concept: string) => CONCEPTS_BY_ID.get(concept)?.label ?? concept;

const RECALL_TARGET = 0.9;
const EMPTY: AggregateReport = {
  images: 0,
  totalTruth: 0,
  overall: { tp: 0, fp: 0, fn: 0, recall: 0, precision: 0, falseNegativeRate: 0 },
  perClass: {},
  perTier: {},
  hazardRecall: 0,
  results: [],
};

function worst(rows: Array<[string, ClassStats]>): [string, number] | null {
  if (rows.length === 0) return null;
  const [name, s] = rows.reduce((a, b) => (b[1].recall < a[1].recall ? b : a));
  return [name, s.recall];
}

/**
 * The Quality page exists because "it works on demo day" is a weaker claim than
 * "here is what it misses". Everything here reads from a generated report; nothing is
 * hand-typed, so the numbers cannot drift from the code that produced them.
 */
export function EvalScreen() {
  const [report, setReport] = useState<AggregateReport>(EMPTY);
  const [source, setSource] = useState<{ generatedAt: string; kind: string; note: string } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/eval-report.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("absent"))))
      .then((json) => {
        if (cancelled) return;
        setReport(json.report);
        setSource({ generatedAt: json.generatedAt, kind: json.kind, note: json.note });
        setState("ready");
      })
      .catch(() => !cancelled && setState("missing"));
    return () => {
      cancelled = true;
    };
  }, []);

  const classRows = Object.entries(report.perClass).sort((a, b) => a[1].recall - b[1].recall);
  const tierRows = Object.entries(report.perTier);
  const bad = worst(classRows);
  const selfCheck = source?.kind === "self-check";

  return (
    <div className="rg-page">
      <div className="rg-page-head">
        <h1>Quality</h1>
        <p>
          Per-class recall, false-negative rate, and an auditable list of every hazard the system failed to
          see. Recall is the number that matters here: a missed chair costs nothing, a missed step does.
        </p>
      </div>

      {state === "loading" && (
        <div className="rg-notice rg-notice--accent" role="status">
          <IconGauge />
          <span>Loading evaluation report…</span>
        </div>
      )}

      {state === "missing" && (
        <Notice>
          No report found. Run <code data-numeric>npm run eval</code> to generate{" "}
          <code>apps/web/public/eval-report.json</code>, then reload this page.
        </Notice>
      )}

      {state === "ready" && source && (
        <Notice tone={source.kind === "self-check" ? "warn" : "info"}>
          {source.kind === "self-check"
            ? "Pipeline self-check: these numbers validate the scoring harness against synthetic scenes. They are NOT a measurement of model accuracy."
            : "Measured run against hand-labelled imagery."}{" "}
          Generated {source.generatedAt}. {source.note}
        </Notice>
      )}

      <div className="rg-metrics" hidden={state !== "ready"}>
        <div className="rg-kpi">
          <div className="rg-kpi-label">Hazard recall</div>
          <div className="rg-kpi-value" data-numeric>
            {Math.round(report.hazardRecall * 100)}%
          </div>
          <div className="rg-kpi-note">
            {selfCheck
              ? "Self-check only: ground truth here is the provider's own output, so this score is tautological."
              : "Of human-labelled hazards, what was actually seen."}
          </div>
        </div>
        <div className="rg-kpi">
          <div className="rg-kpi-label">Images scored</div>
          <div className="rg-kpi-value" data-numeric>
            {report.images}
          </div>
          <div className="rg-kpi-note">{report.totalTruth} labelled instances.</div>
        </div>
        <div className="rg-kpi">
          <div className="rg-kpi-label">False positives</div>
          <div className="rg-kpi-value" data-numeric>
            {report.overall.fp}
          </div>
          <div className="rg-kpi-note">
            {report.overall.precision > 0
              ? `${Math.round(report.overall.precision * 100)}% precision.`
              : "No false positives recorded."}
          </div>
        </div>
        <div className="rg-kpi">
          <div className="rg-kpi-label">Weakest class</div>
          <div className="rg-kpi-value" data-numeric style={{ fontSize: "var(--rg-text-lg)" }}>
            {bad ? labelFor(bad[0]) : "—"}
          </div>
          <div className="rg-kpi-note">
            {bad
              ? `${Math.round(bad[1] * 100)}% recall${
                  classRows[0]![1].recall === classRows[classRows.length - 1]![1].recall
                    ? " — every class is tied, so this run shows no weak spot."
                    : ""
                }`
              : "Awaiting data."}
          </div>
        </div>
      </div>

      <div className="rg-grid-2" hidden={state !== "ready"}>
        <section className="rg-panel">
          <div className="rg-panel-head">
            <h2 className="rg-panel-title">Recall by tier</h2>
            <span className="rg-chip">target {Math.round(RECALL_TARGET * 100)}%</span>
          </div>
          <div className="rg-panel-body">
            {tierRows.length === 0 && <p className="rg-hint">No tier data.</p>}
            {tierRows.map(([tier, s]) => (
              <BulletChart key={tier} name={tier} value={s.recall} target={RECALL_TARGET} />
            ))}
          </div>
        </section>

        <section className="rg-panel">
          <div className="rg-panel-head">
            <h2 className="rg-panel-title">Recall by class</h2>
            <span className="rg-chip">weakest first</span>
          </div>
          <div className="rg-panel-body">
            {classRows.length === 0 && <p className="rg-hint">No class data.</p>}
            {classRows.map(([concept, s]) => (
              <BulletChart key={concept} name={labelFor(concept)} value={s.recall} target={RECALL_TARGET} />
            ))}
          </div>
        </section>
      </div>

      <section className="rg-panel" hidden={state !== "ready"}>
        <div className="rg-panel-head">
          <h2 className="rg-panel-title">Missed hazards</h2>
          <span className="rg-chip">
            <b data-numeric>
              {report.results.reduce((n, r) => n + r.missedHazards.length, 0)}
            </b>{" "}
            total
          </span>
        </div>
        <div className="rg-panel-body">
          <table className="rg-table">
            <caption>
              Every ground-truth hazard with no matching prediction. This is the failure list, shown on
              purpose.
            </caption>
            <thead>
              <tr>
                <th scope="col">Image</th>
                <th scope="col">Concept</th>
                <th scope="col">Location</th>
                <th scope="col">Why it matters</th>
              </tr>
            </thead>
            <tbody>
              {report.results.flatMap((r) =>
                r.missedHazards.map((m, i) => (
                  <tr key={`${r.image}-${i}`}>
                    <td>{r.image}</td>
                    <td>{labelFor(m.concept)}</td>
                    <td data-numeric>
                      x {m.bbox.x.toFixed(2)} · y {m.bbox.y.toFixed(2)}
                    </td>
                    <td>Labelled hazard, never narrated.</td>
                  </tr>
                )),
              )}
              {report.results.every((r) => r.missedHazards.length === 0) && (
                <tr>
                  <td colSpan={4}>No missed hazards in this run.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rg-panel">
        <div className="rg-panel-head">
          <h2 className="rg-panel-title">Known limitations</h2>
        </div>
        <div className="rg-panel-body">
          <ul className="rg-limits">
            <li>
              Distance is a pinhole proxy from apparent size, so it is wrong whenever the class reference
              width is wrong. Flat ground objects are the worst case.
            </li>
            <li>
              Matching uses bounding-box IoU, not mask IoU. Sloppy localisation can still count as a hit, so
              recall here is optimistic.
            </li>
            <li>
              Absence is never asserted. The system cannot say the path is clear, and no amount of tuning
              will change that.
            </li>
            <li>
              Not tested with low-vision users yet. Until it is, every claim about real-world usefulness is a
              hypothesis.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
