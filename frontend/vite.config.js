import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

// cache-busting version of the demo bundle: changes whenever backend.zip changes
const zip = new URL("./public-demo/backend.zip", import.meta.url);
const bundleVersion = existsSync(zip) ? createHash("sha256").update(readFileSync(zip)).digest("hex").slice(0, 12) : "dev";

// online demo only: relative paths need the trailing slash (/demos/hrms/), and Pyodide comes from jsDelivr
const demoHtml = {
  name: "demo-html",
  transformIndexHtml: (html) => html.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">
  <script>if (!/\\/$|\\.html$/.test(location.pathname)) location.replace(location.pathname + "/" + location.search + location.hash);</script>
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>`),
};

// npm run build       -> dist/       served by Django (talks to the real API)
// npm run build:demo  -> dist-demo/  static site that runs the Django backend in the browser (Pyodide)
export default defineConfig(({ mode }) => ({
  plugins: mode === "demo" ? [react(), demoHtml] : [react()],
  base: mode === "demo" ? "./" : "/",
  publicDir: mode === "demo" ? "public-demo" : "public",
  define: { __DEMO__: JSON.stringify(mode === "demo"), __BUNDLE_VERSION__: JSON.stringify(bundleVersion) },
  build: { outDir: mode === "demo" ? "dist-demo" : "dist", chunkSizeWarningLimit: 900 },
  server: { proxy: { "/api": "http://127.0.0.1:8000", "/admin": "http://127.0.0.1:8000", "/static": "http://127.0.0.1:8000" } },
}));
