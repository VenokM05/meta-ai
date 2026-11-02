import { IconGauge, IconCamera, IconRadar, IconFrame } from "../lib/icons";
import { UI, type Locale } from "../lib/i18n";

export type RouteName = "guide" | "frame" | "quality";

export function TopBar({
  route,
  onNavigate,
  provider,
  fps,
  latencyMs,
  locale,
}: {
  route: RouteName;
  onNavigate: (r: RouteName) => void;
  provider: "mock" | "meta";
  fps: number;
  latencyMs: number;
  locale: Locale;
}) {
  const t = UI[locale];
  const nav: Array<{ route: RouteName; label: string; Icon: typeof IconRadar }> = [
    { route: "guide", label: t.navGuide, Icon: IconRadar },
    { route: "frame", label: t.navFrame, Icon: IconFrame },
    { route: "quality", label: t.navQuality, Icon: IconGauge },
  ];

  return (
    <header className="rg-topbar">
      <div className="rg-brand">
        <span className="rg-brand-mark" aria-hidden="true">
          <IconRadar />
        </span>
        <div className="rg-brand-text">
          <span className="rg-brand-name">Room Guide</span>
          <span className="rg-brand-sub">Spatial narration · SAM 3.1</span>
        </div>
      </div>

      <nav className="rg-nav" aria-label={t.navPrimary}>
        {nav.map(({ route: r, label, Icon }, i) => (
          <button
            key={r}
            type="button"
            className="rg-nav-link"
            aria-current={route === r ? "page" : undefined}
            onClick={() => onNavigate(r)}
          >
            <span className="rg-nav-index" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            <Icon className="rg-nav-icon" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="rg-status" aria-label="Pipeline status">
        <span
          className="rg-chip"
          data-tone={provider === "mock" ? "mock" : "live"}
          title={
            provider === "mock"
              ? "Synthetic scene fixtures, not camera input"
              : "Live camera feeding SAM 3.1 through the local proxy"
          }
        >
          {provider === "mock" ? (
            <>
              <IconCamera width="14" height="14" />
              <b>Synthetic</b>
            </>
          ) : (
            <>
              <span className="rg-pulse" />
              <b>Live camera</b>
            </>
          )}
        </span>
        {provider === "meta" && (
          <span
            className="rg-chip"
            title="Wall-clock time for the last completed live sweep, not a single model call."
          >
            <span className="rg-chip-label">Sweep</span>
            <b data-numeric>{latencyMs > 0 ? `${(latencyMs / 1000).toFixed(1)} s` : "—"}</b>
          </span>
        )}
        <span className="rg-chip">
          <span className="rg-chip-label">Loop</span>
          <b data-numeric>{fps > 0 ? `${fps.toFixed(1)} fps` : "idle"}</b>
        </span>
      </div>
    </header>
  );
}
