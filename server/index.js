require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const searchRoute = require("./routes/search");
const categoriesRoute = require("./routes/categories");
const relatedRoute = require("./routes/related");
const artistsRoute = require("./routes/artists");
const trackRoute = require("./routes/track");
const trendingRoute = require("./routes/trending");
const authRoute = require("./routes/auth");
const playlistsRoute = require("./routes/playlists");
const recentRoute = require("./routes/recent");
const playerStateRoute = require("./routes/playerState");
const { startScheduledRefresh } = require("./services/cacheService");
const { runMigrations } = require("./db");

if (!process.env.YOUTUBE_API_KEY) {
  console.error(
    "\n[startup] Missing YOUTUBE_API_KEY - copy server/.env.example to server/.env and add your key.\n" +
      "See README.md for how to get a YouTube Data API v3 key.\n"
  );
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// CLIENT_ORIGIN restricts CORS to specific frontend origin(s) once known
// (comma-separated for multiple, e.g. a Netlify production + preview URL).
// Left unset, all origins are allowed - fine for local dev / getting
// started. Once accounts are involved, credentialed (cookie-carrying)
// requests can't use a wildcard origin, so the "allow everything" fallback
// reflects the caller's own origin (credential-safe) instead of using '*'.
const allowedOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/api/search", searchRoute);
app.use("/api/categories", categoriesRoute);
app.use("/api/related", relatedRoute);
app.use("/api/artists", artistsRoute);
app.use("/api/track", trackRoute);
app.use("/api/trending", trendingRoute);
app.use("/api/auth", authRoute);
app.use("/api/playlists", playlistsRoute);
app.use("/api/recent", recentRoute);
app.use("/api/player-state", playerStateRoute);

const clientDist = path.join(__dirname, "..", "client", "dist");
// dotfiles default to "ignore" in express.static, which would silently skip
// /.well-known/assetlinks.json (needed for the Android TWA app-link
// verification) and fall through to the SPA catch-all's index.html instead.
app.use(express.static(clientDist, { dotfiles: "allow" }));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) next();
  });
});

async function start() {
  await runMigrations();
  app.listen(PORT, () => {
    console.log(`[startup] YOUTUBE_API_KEY loaded`);
    console.log(`[startup] Server listening on http://localhost:${PORT}`);
    startScheduledRefresh();
  });
}

start();
