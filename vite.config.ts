import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@react-three/drei")) return "drei";
          if (id.includes("@react-three/fiber")) return "react-three-fiber";
          if (id.includes("/three/")) return "three";
          if (id.includes("react-dom") || id.includes("/react/")) return "react";
          if (id.includes("lucide-react")) return "icons";
          return undefined;
        }
      }
    }
  }
});
