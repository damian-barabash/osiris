import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Три входа: лендинг (/), веб-версия (/app/), админка (/admin/). Лендинг потом пререндерится (scripts/prerender.mjs).
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  build: {
    target: "es2022",
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        app: resolve(__dirname, "app/index.html"),
        admin: resolve(__dirname, "admin/index.html"),
      },
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/") || id.includes("node_modules/scheduler")) return "react";
          if (id.includes("node_modules/@supabase")) return "supabase";
          if (id.includes("node_modules/pdf-lib") || id.includes("node_modules/@pdf-lib")) return "pdf";
        },
      },
    },
  },
  server: { port: 5183 },
});
