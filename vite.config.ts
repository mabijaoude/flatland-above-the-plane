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
    rolldownOptions: {
      output: {
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            { name: "drei", test: /@react-three[\\/]drei/ },
            { name: "react-three-fiber", test: /@react-three[\\/]fiber/ },
            {
              name: "three",
              test: (id) =>
                /[\\/]three[\\/]/.test(id) && !id.includes("@react-three")
            },
            {
              name: "react",
              test: (id) =>
                id.includes("react-dom") || /[\\/]react[\\/]/.test(id)
            },
            { name: "icons", test: /lucide-react/ }
          ]
        }
      }
    }
  }
});
