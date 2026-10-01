import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));

// Build for a VPS without injecting Manus's visual editor or Manus analytics.
// This does NOT replace the project's Manus OAuth or Forge-backed APIs.
const omitManusAnalytics: Plugin = {
  name: "omit-manus-analytics-for-vps",
  apply: "build",
  transformIndexHtml(html) {
    return html.replace(
      /<script\b[^>]*\bsrc=["'][^"']*\/umami["'][^>]*><\/script>/g,
      ""
    );
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), omitManusAnalytics],
  root: path.join(projectRoot, "client"),
  envDir: projectRoot,
  publicDir: path.join(projectRoot, "client", "public"),
  resolve: {
    alias: {
      "@": path.join(projectRoot, "client", "src"),
      "@shared": path.join(projectRoot, "shared"),
      "@assets": path.join(projectRoot, "attached_assets"),
    },
  },
  build: {
    outDir: path.join(projectRoot, "dist", "public"),
    emptyOutDir: true,
  },
});
