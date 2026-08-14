require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");

const searchRoute = require("./routes/search");
const categoriesRoute = require("./routes/categories");
const relatedRoute = require("./routes/related");
const artistsRoute = require("./routes/artists");
const trackRoute = require("./routes/track");
const { startScheduledRefresh } = require("./services/cacheService");

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
// Left unset, all origins are allowed - fine for local dev / getting started.
const allowedOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : {}));
app.use(express.json());

app.use("/api/search", searchRoute);
app.use("/api/categories", categoriesRoute);
app.use("/api/related", relatedRoute);
app.use("/api/artists", artistsRoute);
app.use("/api/track", trackRoute);

const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) next();
  });
});

app.listen(PORT, () => {
  console.log(`[startup] YOUTUBE_API_KEY loaded`);
  console.log(`[startup] Server listening on http://localhost:${PORT}`);
  startScheduledRefresh();
});
