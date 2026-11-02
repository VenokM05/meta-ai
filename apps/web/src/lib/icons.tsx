import type { SVGProps } from "react";

/**
 * One stroke family, 1.6 width, 24 viewbox — no emoji, no mixed metaphors.
 * Sizes come from CSS (currentColor + em-box), never per-call hardcoding.
 */
type P = SVGProps<SVGSVGElement>;

const Svg = ({ children, ...p }: P) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...p}
  >
    {children}
  </svg>
);

export const IconRadar = (p: P) => (
  <Svg {...p}>
    <path d="M19.07 4.93A10 10 0 1 0 21 12" />
    <path d="M15.5 8.5A5 5 0 1 0 17 12" />
    <path d="M12 12 19 5" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconCamera = (p: P) => (
  <Svg {...p}>
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
    <circle cx="12" cy="13" r="3.2" />
  </Svg>
);

export const IconPlay = (p: P) => (
  <Svg {...p}>
    <path d="M7 4.5 19 12 7 19.5V4.5Z" fill="currentColor" />
  </Svg>
);

export const IconPause = (p: P) => (
  <Svg {...p}>
    <path d="M8 4.5v15M16 4.5v15" strokeWidth={2.4} />
  </Svg>
);

export const IconVolume = (p: P) => (
  <Svg {...p}>
    <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" fill="currentColor" />
    <path d="M15.5 8.8a4 4 0 0 1 0 6.4M18.5 6a7.5 7.5 0 0 1 0 12" />
  </Svg>
);

export const IconVolumeOff = (p: P) => (
  <Svg {...p}>
    <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" fill="currentColor" />
    <path d="m16 9.5 5 5M21 9.5l-5 5" />
  </Svg>
);

export const IconHazard = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.2 22 20H2L12 3.2Z" />
    <path d="M12 9.5v4.2" strokeWidth={2} />
    <circle cx="12" cy="16.8" r="1" fill="currentColor" stroke="none" />
  </Svg>
);

/** Caution: square diamond — a distinct silhouette, not just a different colour. */
export const IconCaution = (p: P) => (
  <Svg {...p}>
    <path d="M12 3 21 12 12 21 3 12 12 3Z" />
    <path d="M8.5 12h7" strokeWidth={2} />
  </Svg>
);

/** Informative: circle — third distinct shape. */
export const IconInfo = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.2" strokeWidth={2} />
    <circle cx="12" cy="7.8" r="1" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconGauge = (p: P) => (
  <Svg {...p}>
    <path d="M4 18a8 8 0 1 1 16 0" />
    <path d="m12 14 4-4" />
    <circle cx="12" cy="14.5" r="1.3" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconFrame = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 4v5" />
  </Svg>
);

export const IconSettings = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19 12a7 7 0 0 0-.14-1.4l2-1.55-2-3.46-2.35.95A7 7 0 0 0 14.06 5.1L13.9 2.6h-3.8l-.17 2.5a7 7 0 0 0-2.44 1.4l-2.36-.95-2 3.46 2 1.55A7 7 0 0 0 5 12c0 .48.05.95.14 1.4l-2 1.55 2 3.46 2.36-.95a7 7 0 0 0 2.44 1.4l.17 2.5h3.8l.16-2.5a7 7 0 0 0 2.46-1.4l2.35.95 2-3.46-2-1.55c.09-.45.14-.92.14-1.4Z" />
  </Svg>
);

export const IconAlert = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5" strokeWidth={2} />
    <circle cx="12" cy="16.5" r="1" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="m4.5 12.5 5 5 10-11" strokeWidth={2.2} />
  </Svg>
);

export const IconSpark = (p: P) => (
  <Svg {...p}>
    <path d="M12 3v3.2M12 17.8V21M3 12h3.2M17.8 12H21M5.6 5.6l2.3 2.3M16.1 16.1l2.3 2.3M18.4 5.6l-2.3 2.3M7.9 16.1l-2.3 2.3" />
    <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconKeyboard = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M8 14h8" />
  </Svg>
);

export const IconRepeat = (p: P) => (
  <Svg {...p}>
    <path d="m17 3.5 3 3-3 3" />
    <path d="M20 6.5H8.5A4.5 4.5 0 0 0 4 11v1" />
    <path d="m7 20.5-3-3 3-3" />
    <path d="M4 17.5h11.5A4.5 4.5 0 0 0 20 13v-1" />
  </Svg>
);

export const IconTarget = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="7.5" />
    <circle cx="12" cy="12" r="2.2" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
  </Svg>
);

/** Flip horizontally: opposing arrows either side of a centre line. */
export const IconMirror = (p: P) => (
  <Svg {...p}>
    <path d="M12 3v18" strokeDasharray="2 2.4" />
    <path d="M8.5 7.5 4 12l4.5 4.5" />
    <path d="M15.5 7.5 20 12l-4.5 4.5" />
  </Svg>
);

export const IconHelp = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.4 9.2a2.7 2.7 0 1 1 3.6 2.5c-.6.25-1 .8-1 1.45v.5" />
    <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
  </Svg>
);
