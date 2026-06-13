import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const BACKEND = "hhttps://amard-twin.onrender.com";

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
    allowedHosts: [
      "amard-twin-1.onrender.com"
    ],
    proxy: {
      "/api": { target: BACKEND, changeOrigin: true },
      "/health": { target: BACKEND, changeOrigin: true },
      "/socket.io": { target: BACKEND, changeOrigin: true, ws: true },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
