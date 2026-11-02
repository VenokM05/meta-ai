import { useEffect, useState } from "react";
import { useGuide } from "./hooks/useGuide";
import { TopBar, type RouteName } from "./components/TopBar";
import { GuideScreen } from "./screens/GuideScreen";
import { FrameScreen } from "./screens/FrameScreen";
import { EvalScreen } from "./screens/EvalScreen";
import { UI } from "./lib/i18n";

/**
 * Hand-rolled hash routing: three screens, deep-linkable, no router dependency.
 * Unknown hashes return null rather than defaulting to the guide, because the skip
 * link also changes the hash — it must move focus, not navigate away from the screen.
 */
function routeFromHash(): RouteName | null {
  const h = window.location.hash.replace(/^#\/?/, "");
  return h === "guide" || h === "frame" || h === "quality" ? h : null;
}

export function App() {
  const [route, setRoute] = useState<RouteName>(() => routeFromHash() ?? "guide");
  const guide = useGuide();
  const t = UI[guide.locale];

  useEffect(() => {
    const onHash = () => {
      const next = routeFromHash();
      if (!next) return;
      setRoute(next);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function navigate(next: RouteName) {
    window.location.hash = `/${next}`;
    setRoute(next);
    // A new screen starts at its top. Focusing main without this scrolls it under the
    // sticky header, which lands a reader mid-page with the title hidden.
    window.scrollTo(0, 0);
    // Route changes move focus to the main region so keyboard and screen-reader users
    // are not left on the nav button they just pressed.
    document.getElementById("rg-main")?.focus({ preventScroll: true });
  }

  return (
    <div className="rg-app">
      <a className="rg-skip-link" href="#rg-main">
        {t.skipLink}
      </a>

      <TopBar
        route={route}
        onNavigate={navigate}
        provider={guide.provider}
        fps={guide.stats.fps}
        latencyMs={guide.stats.latencyMs}
        locale={guide.locale}
      />

      <main id="rg-main" tabIndex={-1} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        {route === "guide" && <GuideScreen guide={guide} />}
        {route === "frame" && <FrameScreen />}
        {route === "quality" && <EvalScreen />}
      </main>

      <footer className="rg-foot">
        <span>Room Guide · built on Meta SAM 3.1</span>
        <span>{t.footerTagline}</span>
      </footer>
    </div>
  );
}
