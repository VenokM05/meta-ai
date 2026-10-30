import { IconGauge, IconCamera, IconRadar, IconFrame } from "../lib/icons";

export type RouteName = "guide" | "frame" | "quality";

const NAV: Array<{ route: RouteName; label: string; Icon: typeof IconRadar }> = [
  { route: "guide", label: "Live guide", Icon: IconRadar },
  { route: "frame", label: "Single frame", Icon: IconFrame },
  { route: "quality", label: "Quality", Icon: IconGauge },
];

export function TopBar({
  route,
  onNavigate,
  provider,
  fps,
  latencyMs,
}: {
  route: RouteName;
  onNavigate: (r: RouteName) => void;
  provider: "mock" | "meta";
  fps: number;
  latencyMs: number;
}) {
  return (
    <header className="rg-topbar">
      <div className="rg-brand">
        <IconRadar className="rg-brand-mark" />
        <div>
          <div className="rg-brand-name">Room Guide</div>
          <div className="rg-brand-sub">Spatial narration</div>
        </div>
      </div>

      <nav className="rg-nav" aria-label="Primary">
        {NAV.map(({ route: r, label, Icon }) => (
          <button
            key={r}
            type="button"
            className="rg-nav-link"
            aria-current={route === r ? "page" : undefined}
            onClick={() => onNavigate(r)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="rg-status" aria-label="Pipeline status">
        <span className="rg-chip" data-tone={provider === "mock" ? "mock" : "live"}>
          {provider === "mock" ? (
            <>
              <IconCamera width="13" height="13" />
              <b>Mock provider</b>
            </>
          ) : (
            <span className="rg-pulse" />
          )}
          <span>{provider === "mock" ? "synthetic scenes" : "Muse API"}</span>
        </span>
        <span className="rg-chip">
          <span>Latency</span>
          <b data-numeric>
            {latencyMs > 0 ? `${latencyMs} ms` : "—"}
          </b>
        </span>
        <span className="rg-chip">
          <span>Loop</span>
          <b data-numeric>{fps > 0 ? `${fps.toFixed(1)} fps` : "idle"}</b>
        </span>
      </div>
    </header>
  );
}
