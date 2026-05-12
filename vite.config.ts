import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// Plugin: gera/atualiza public/version.json a partir de src/constants/version.ts no build
function versionJsonPlugin() {
  return {
    name: "write-version-json",
    apply: "build" as const,
    buildStart() {
      try {
        const src = fs.readFileSync(path.resolve(__dirname, "src/constants/version.ts"), "utf-8");
        const m = src.match(/APP_VERSION\s*=\s*"([^"]+)"/);
        const version = m ? m[1] : "0.0.0";
        const payload = { version, buildTime: new Date().toISOString() };
        fs.writeFileSync(path.resolve(__dirname, "public/version.json"), JSON.stringify(payload, null, 2) + "\n");
      } catch (e) {
        console.warn("[versionJsonPlugin] falhou ao escrever version.json:", e);
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger(), versionJsonPlugin()].filter(Boolean),
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      { find: /^react$/, replacement: path.resolve(__dirname, "./node_modules/react/index.js") },
      { find: /^react-dom$/, replacement: path.resolve(__dirname, "./node_modules/react-dom/index.js") },
      { find: /^react-dom\/client$/, replacement: path.resolve(__dirname, "./node_modules/react-dom/client.js") },
      { find: /^react\/jsx-runtime$/, replacement: path.resolve(__dirname, "./node_modules/react/jsx-runtime.js") },
      { find: /^react\/jsx-dev-runtime$/, replacement: path.resolve(__dirname, "./node_modules/react/jsx-dev-runtime.js") },
    ],
    dedupe: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "@tanstack/react-query"],
  },
}));
