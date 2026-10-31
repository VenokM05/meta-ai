import { useEffect, useState } from "react";
import { useGuide } from "./hooks/useGuide";
import { TopBar, type RouteName } from "./components/TopBar";
import { GuideScreen } from "./screens/GuideScreen";
import { FrameScreen } from "./screens/FrameScreen";
import { EvalScreen } from "./screens/EvalScreen";

/** Hand-rolled hash routing: three screens, deep-linkable, no router dependency. */
function routeFromHash(): RouteName {
  const h = window.location.hash.replace(/^#\/?/, "");
  return h === "frame" || h === "quality" ? h : "guide";
}

export function App() {
  const [route, setRoute] = useState<RouteName>(routeFromHash);
  const guide = useGuide();

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function navigate(next: RouteName) {
    window.location.hash = `/${next}`;
    setRoute(next);
    // Route changes move focus to the main region so keyboard and screen-reader users
    // are not left on the nav button they just pressed.
    document.getElementById("rg-main")?.focus();
  }

  return (
    <div className="rg-app">
      <a className="rg-skip-link" href="#rg-main">
        Skip to main content
      </a>

      <TopBar
        route={route}
        onNavigate={navigate}
        provider={guide.provider}
        fps={guide.stats.fps}
        latencyMs={guide.stats.latencyMs}
      />

      <main id="rg-main" tabIndex={-1} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        {route === "guide" && <GuideScreen guide={guide} />}
        {route === "frame" && <FrameScreen />}
        {route === "quality" && <EvalScreen />}
      </main>

      <footer className="rg-foot">
        <span>Room Guide · built on Meta SAM 3.1</span>
        <span>Geometry turned into speech. Absence is never asserted.</span>
      </footer>
    </div>
  );
}
