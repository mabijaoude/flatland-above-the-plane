import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        codeSplitting: {
          // React, its reconciler, and shared CommonJS helpers must initialize
          // together. Splitting them by package can introduce startup cycles.
          includeDependenciesRecursively: true,
          groups: [
            { name: "vendor", test: /[\\/]node_modules[\\/]/ }
          ]
        }
      }
    }
  }
});
