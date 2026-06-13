import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Backend runs on port 3000 — proxy all API + socket calls there
const BACKEND = "http://localhost:3000";

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api":       { target: BACKEND, changeOrigin: true },
      "/health":    { target: BACKEND, changeOrigin: true },
      "/socket.io": { target: BACKEND, changeOrigin: true, ws: true },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
