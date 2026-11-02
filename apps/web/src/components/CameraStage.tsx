import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { SpatialObject } from "@roomguide/core";
import { UI, conceptLabel, type Locale } from "../lib/i18n";

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
  videoRef: externalRef,
  locale = "en",
}: {
  objects: SpatialObject[];
  videoStream: MediaStream | null;
  soundingConcepts: Set<string>;
  provider: "mock" | "meta";
  /**
   * The element the live provider grabs frames from. Passed in so the hook that runs sweeps
   * holds the ref, rather than reaching into the DOM of a component that only displays it.
   */
  videoRef?: RefObject<HTMLVideoElement | null>;
  locale?: Locale;
}) {
  const localRef = useRef<HTMLVideoElement | null>(null);
  const videoRef = externalRef ?? localRef;
  const t = UI[locale];

  useEffect(() => {
    if (!videoStream) return;
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = videoStream;
    void el.play().catch(() => undefined);
  }, [videoStream, videoRef]);

  /*
    The frame is always 9:16, whatever the sensor delivers. A phone that only offers 16:9
    is not letterboxed into a wide strip: the video is cover-cropped to the window, and
    grabFrame sends that same centred crop, so masks land on the pixels they came from.
  */

  /*
    The preview is mirrored the way a selfie view is. Video and mask overlay flip together
    so a mask still sits on the object it names; labels are mirrored here because flipping
    the layer would render their text backwards. Narration and sonar keep real-world
    left/right, so the mirror is a viewing convention, not a change in what is reported.
  */
  const mirrored = videoStream !== null;

  const corridorApexY = 28;

  return (
    <div className="rg-camera" data-provider={provider} data-mirror={mirrored || undefined}>
      <div className="rg-camera__media">
        {videoStream ? <video ref={videoRef} playsInline muted autoPlay /> : <SyntheticBackdrop />}

        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={t.stageAria}
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

        {/*
          Labels live in HTML rather than inside the SVG: the overlay svg is stretched with
          preserveAspectRatio="none", which would shear any text drawn into it.
        */}
        <div className="rg-label-layer" aria-hidden="true">
          {objects.map((o) => {
            // Mirror the box, not just its left edge: the overlay is flipped with the
            // video, and anchoring to the un-mirrored edge would miss by one mask width.
            const x = clampPct((mirrored ? 1 - (o.bbox.x + o.bbox.w) : o.bbox.x) * 100);
            return (
              <span
                key={`label-${o.id}-${o.concept}`}
                className="rg-mask-tag"
                data-tier={o.tier}
                style={{
                  left: `${x}%`,
                  top: `${clampPct(o.bbox.y * 100 - 5)}%`,
                  // Past the midline, anchor the right edge instead, so a label near
                  // the frame's edge grows inward instead of being cut off.
                  transform: x > 55 ? "translateX(-100%)" : undefined,
                }}
              >
                {conceptLabel(o.concept, locale, o.label)}
              </span>
            );
          })}
        </div>

        <div className="rg-scanline" style={{ ["--rg-scan-h" as string]: "calc(100% - 2px)" }} />
      </div>

      {/* Frame-level status stays in the corner of the window, over the crop. */}
      <div className="rg-feed-tag" data-tone={provider === "mock" ? "mock" : "live"}>
        {provider === "mock" ? (
          t.feedSynthetic
        ) : (
          <>
            <span className="rg-live-dot" aria-hidden="true" />
            {t.feedLive}
          </>
        )}
      </div>
    </div>
  );
}
