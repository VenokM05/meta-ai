import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      // Keeps the browser on one origin in dev. The API key lives in the proxy process and
      // is never a VITE_* variable, so it cannot be inlined into the shipped bundle.
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
  build: { target: "es2022", sourcemap: true },
});
