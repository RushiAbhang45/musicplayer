import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // listen on the LAN too, not just localhost (for phone testing)
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
});
