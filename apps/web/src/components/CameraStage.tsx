import { useEffect, useRef } from "react";
import type { SpatialObject } from "@roomguide/core";

const VW = 100;
const VH = 56.25;

function polygonPoints(o: SpatialObject): string {
  return o.maskPolygon.map((p) => `${(p.x * VW).toFixed(2)},${(p.y * VH).toFixed(2)}`).join(" ");
}

/** Keep labels inside the frame even when a mask touches the edge. */
const clampPct = (n: number) => Math.min(94, Math.max(1, n));

/** Synthetic stand-in feed so the pipeline is demoable before a real model is wired in. */
function SyntheticBackdrop() {
  return (
    <div className="rg-backdrop" aria-hidden="true">
      <div className="rg-backdrop-sky" />
      <div className="rg-backdrop-floor" />
      <svg className="rg-backdrop-grid" viewBox="0 0 100 56.25" preserveAspectRatio="none">
        {Array.from({ length: 9 }, (_, i) => {
          const t = i / 8;
          const y = 28 + t * t * 28.25;
          const spread = 12 + t * 88;
          return (
            <g key={i}>
              <line x1={50 - spread} y1={y} x2={50 + spread} y2={y} />
            </g>
          );
        })}
        {Array.from({ length: 7 }, (_, i) => {
          const x = (i + 0.5) * (100 / 7);
          const dx = (x - 50) * 0.34;
          return <line key={i} x1={50 + dx} y1={28} x2={x} y2={56.25} />;
        })}
      </svg>
    </div>
  );
}

export function CameraStage({
  objects,
  videoStream,
  soundingConcepts,
  provider,
}: {
  objects: SpatialObject[];
  videoStream: MediaStream | null;
  soundingConcepts: Set<string>;
  provider: "mock" | "meta";
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (videoStream) {
      el.srcObject = videoStream;
      void el.play().catch(() => undefined);
    } else {
      el.srcObject = null;
    }
  }, [videoStream]);

  const corridorApexY = 28;

  return (
    <div className="rg-camera">
      {videoStream ? <video ref={videoRef} playsInline muted autoPlay /> : <SyntheticBackdrop />}

      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Segmented view of the scene"
      >
        {/* Forward walking corridor: everything inside is treated as "in my path". */}
        <polygon className="rg-corridor" points={`${VW / 2},${corridorApexY} ${VW - 8},${VH} 8,${VH}`} />

        {objects.map((o) => (
          <polygon
            key={`${o.id}-${o.concept}`}
            className="rg-mask"
            data-tier={o.tier}
            data-sounding={soundingConcepts.has(o.concept) ? "true" : "false"}
            points={polygonPoints(o)}
          />
        ))}
      </svg>

      {provider === "mock" && <div className="rg-feed-tag">Synthetic feed</div>}

      {/*
        Labels live in HTML rather than inside the SVG: the overlay svg is stretched with
        preserveAspectRatio="none", which would shear any text drawn into it.
      */}
      <div className="rg-label-layer" aria-hidden="true">
        {objects.map((o) => (
          <span
            key={`label-${o.id}-${o.concept}`}
            className="rg-mask-tag"
            data-tier={o.tier}
            style={{
              left: `${clampPct(o.bbox.x * 100)}%`,
              top: `${clampPct(o.bbox.y * 100 - 5)}%`,
            }}
          >
            {o.label}
          </span>
        ))}
      </div>

      <div className="rg-scanline" style={{ ["--rg-scan-h" as string]: "calc(100% - 2px)" }} />
    </div>
  );
}
