import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: true }, // generate the SW in `npm run dev` too, not just prod builds
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"],
      manifest: {
        name: "MusicPlayer — Hits, Curated",
        short_name: "MusicPlayer",
        description:
          "Curated YouTube-powered music player with playlists, artist pages, and autoplay radio.",
        start_url: "/",
        display: "standalone",
        background_color: "#0a0118",
        theme_color: "#0a0118",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true, // listen on the LAN too, not just localhost (for phone testing)
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
});
