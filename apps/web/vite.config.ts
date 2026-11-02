import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

// Keeps the phone on one origin in local dev. The API key lives in the proxy process and is
// never a VITE_* variable, so it cannot be inlined into the shipped bundle.
const apiProxy: Record<string, ProxyOptions> = {
  "/api": {
    target: "http://127.0.0.1:8787",
    changeOrigin: true,
    configure: (proxy) => {
      // The proxy pins its allowlist to the loopback dev origin. A tunnel changes the
      // browser's Origin, so normalise it here instead of widening the server's check.
      proxy.on("proxyReq", (req) => req.setHeader("origin", "http://localhost:5173"));
    },
  },
};

// Phone recording runs through a Cloudflare quick tunnel so the camera and motion sensors
// get a secure context. Vite rejects unknown Host headers; this allowlist covers only that
// tunnel suffix and has no effect on the production build.
const tunnelHosts = [".trycloudflare.com"];

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    allowedHosts: tunnelHosts,
    proxy: apiProxy,
  },
  // The built app is what registers the service worker, so record with preview when the
  // install/offline moment is on camera. Preview needs its own proxy and host allowlist.
  preview: {
    port: 4173,
    strictPort: true,
    allowedHosts: tunnelHosts,
    proxy: apiProxy,
  },
  build: { target: "es2022", sourcemap: true },
});
