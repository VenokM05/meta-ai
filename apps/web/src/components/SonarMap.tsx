import type { SpatialObject } from "@roomguide/core";

const MAX_RANGE_M = 5;
const R_OUTER = 42;

const HONESTY_NOTE =
  "Blob size tracks mask area; ring position tracks the distance estimate. Both are proxies, not measurements.";

/**
 * Sonar map: the visual twin of the audio output. Bearing drives angle, the distance
 * proxy drives radius, mask area drives blob size. If you can read the audio you can
 * read this, and vice versa — which is the point of showing both.
 */
export function SonarMap({
  objects,
  soundingConcepts,
  variant = "panel",
}: {
  objects: SpatialObject[];
  soundingConcepts: Set<string>;
  /** "hud" is the compact dial that floats over the live stage. */
  variant?: "panel" | "hud";
}) {
  const hud = variant === "hud";

  const toXY = (bearingDeg: number, distanceM: number | null) => {
    const clampedBearing = Math.max(-62, Math.min(62, bearingDeg));
    const r = distanceM === null ? R_OUTER : Math.min(1, Math.max(0.05, distanceM / MAX_RANGE_M)) * R_OUTER;
    const a = (clampedBearing * Math.PI) / 180;
    return { x: 50 + Math.sin(a) * r, y: 50 - Math.cos(a) * r };
  };

  const dial = (
    <>
      <svg
        className="rg-sonar-view"
        viewBox="0 0 100 100"
        role="img"
        aria-label="Radial map of objects by bearing and estimated distance"
      >
        {/* Range rings, labelled in metres so the rings are readable without colour. */}
        <circle className="rg-ring" cx="50" cy="50" r={R_OUTER} />
        <circle className="rg-ring" cx="50" cy="50" r={(3.5 / MAX_RANGE_M) * R_OUTER} />
        <circle className="rg-ring" data-label="near" cx="50" cy="50" r={(1.5 / MAX_RANGE_M) * R_OUTER} />

        <line className="rg-spoke" x1="50" y1="8" x2="50" y2="92" />
        <line className="rg-spoke" x1="13" y1="76" x2="87" y2="76" />
        <line className="rg-spoke" x1="19" y1="69" x2="81" y2="31" />
        <line className="rg-spoke" x1="81" y1="69" x2="19" y2="31" />

        <path
          className="rg-arc"
          d={`M ${50 + Math.sin((-62 * Math.PI) / 180) * R_OUTER} ${50 - Math.cos((-62 * Math.PI) / 180) * R_OUTER} A ${R_OUTER} ${R_OUTER} 0 0 1 ${50 + Math.sin((62 * Math.PI) / 180) * R_OUTER} ${50 - Math.cos((62 * Math.PI) / 180) * R_OUTER}`}
        />

        <line className="rg-sweep" x1="50" y1="50" x2="50" y2="10" />

        {objects.map((o) => {
          const { x, y } = toXY(o.bearingDeg, o.distanceM);
          const radius = 2.2 + Math.sqrt(o.areaRatio) * 9;
          return (
            <circle
              key={`${o.id}-${o.concept}`}
              className="rg-blip"
              data-tier={o.tier}
              data-sounding={soundingConcepts.has(o.concept) ? "true" : "false"}
              cx={x.toFixed(1)}
              cy={y.toFixed(1)}
              r={Math.min(11, radius).toFixed(1)}
            />
          );
        })}

        {/* The observer is always at the origin of the map. */}
        <polygon className="rg-observer" points="50,45.6 53,51.4 47,51.4" />

        {/* Range labels ride the vertical spoke: on the outer edge they clipped in the HUD. */}
        <text className="rg-ring-label" x="52.5" y="18" textAnchor="start">
          5 m
        </text>
        <text className="rg-ring-label" x="52.5" y="35" textAnchor="start">
          1.5 m
        </text>
        <text className="rg-ring-label" x="50" y="97" textAnchor="middle">
          ahead
        </text>
      </svg>
      {hud ? <p className="rg-visually-hidden">{HONESTY_NOTE}</p> : <p className="rg-hint">{HONESTY_NOTE}</p>}
    </>
  );

  if (hud) {
    return (
      <section className="rg-sonar-hud" aria-label="Sonar map of detected objects">
        <div className="rg-sonar-hud-head">
          <h2 className="rg-panel-title">Sonar</h2>
          <span className="rg-hud-count" data-numeric>
            {objects.length}
            <span> tracked</span>
          </span>
        </div>
        <div className="rg-sonar-hud-body">{dial}</div>
      </section>
    );
  }

  return (
    <section className="rg-panel" aria-label="Sonar map of detected objects">
      <div className="rg-panel-head">
        <h2 className="rg-panel-title">Sonar</h2>
        <span className="rg-chip">
          <b data-numeric>{objects.length}</b> tracked
        </span>
      </div>
      <div className="rg-panel-body">{dial}</div>
    </section>
  );
}
