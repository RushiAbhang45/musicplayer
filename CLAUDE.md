# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A curated music discovery site: browse curated "hits" playlists or search any song, played through an embedded **YouTube IFrame Player API**. It does not extract/download/rip audio anywhere (client or server) — that's intentionally out of scope (copyright/ToS reasons, see README). "Save to library" only stores a YouTube video ID + metadata in `localStorage`; playback always streams live from YouTube.

Two workspaces, both plain JS (no TypeScript):
- `server/` — Express API (CommonJS): search proxy + cached curated category playlists, backed by the YouTube Data API v3.
- `client/` — React 18 + Vite (ESM) frontend: UI, player, library, PWA.

## Commands

From the project root (npm workspaces — `client` and `server`):

```powershell
npm install          # installs both workspaces
npm run dev           # runs server (nodemon, :5000) + client (Vite, :5173) concurrently
npm run build          # builds client only -> client/dist
npm start             # node server/index.js (production-style: one process serves API + built client/dist)
```

Per-workspace, when you only need one side:

```powershell
npm run dev --workspace=server   # or: cd server; npm run dev  (nodemon)
npm run dev --workspace=client   # or: cd client; npm run dev  (vite)
```

There is no lint or test setup in this repo (no `lint`/`test` scripts, no test files) — don't assume one exists.

Required env var to run the server at all: `server/.env` must have `YOUTUBE_API_KEY` (copy from `server/.env.example`); `server/index.js` exits at startup if it's missing. Other server env vars (`PORT`, `CATEGORY_CACHE_TTL_HOURS`, `SEARCH_CACHE_TTL_MINUTES`, `CLIENT_ORIGIN`) are documented in the README. Client-side, `VITE_API_BASE_URL` points the built frontend at a separately-hosted API (see Deployment below) — in dev, Vite proxies `/api` to `localhost:5000` instead (`client/vite.config.js`).

## Architecture

### Server: routes → cacheService → youtubeService

`server/index.js` mounts `/api/{search,categories,related,artists,track}` routes and, in production, also serves the built `client/dist` as static files with an SPA catch-all fallback — one process serves everything (`npm start`). In split deployments (see Deployment) the server only serves the API.

Every route (`server/routes/*.js`) delegates to `server/services/cacheService.js`, which is the only thing that talks to `server/services/youtubeService.js` (the raw YouTube Data API v3 client). Never call `youtubeService` directly from a route — the caching layer is what keeps quota usage sane (YouTube's free tier is 10,000 units/day; one search call costs 100).

`cacheService.js` runs several independent `node-cache` instances with different TTLs/purposes:
- `categoryCache` — curated homepage playlists (long TTL, from `CATEGORY_CACHE_TTL_HOURS`). Persisted to disk at `server/.cache/categories.json` so a restart (dev reload, Render cold-start) reuses the last fetch instead of re-spending quota. **Deliberately not** eagerly refreshed for every category on boot — only categories a visitor actually opens get fetched (lazy, on cache-miss); see the `startScheduledRefresh` comment for why (avoids burning ~1,000 units on every free-tier cold start).
- `searchCache`, `relatedCache`, `artistTracksCache`, `artistInfoCache`, `trackInfoCache` — shorter-lived, bounded by `maxKeys`, keyed by query/videoId/channelId as appropriate.

`server/utils/deriveArtist.js` is a heuristic that guesses an "artist" from a YouTube video's title/channel (handles auto-generated `<Artist> - Topic` channels, `Artist - Title` western convention, and Bollywood-style `Song - Movie | Cast | Composer | Singer` credit lists). This powers the "related tracks" / autoplay-radio feature in `cacheService.getRelatedTracks`: a confident guess searches `"<artist> songs"`, otherwise it falls back to other uploads from the same channel.

`server/utils/apiError.js` centralizes YouTube quota-exceeded detection (429/403 with a quota-ish reason) so routes can return a distinct `quota_exceeded` message instead of a generic 500.

### Client: single persistent player via context

`client/src/context/PlayerContext.jsx` is the center of the app. It's mounted once, **above** the router in `App.jsx`, so the single `YT.Player` instance is never torn down on navigation — that's the mechanism that lets playback survive page changes. It wraps `client/src/hooks/useYouTubePlayer.js`, which lazily injects the YouTube IFrame API script exactly once and exposes the player instance via a ref (not React state, since `YT.Player` mutates itself internally). `PlayerContext` also owns: the play queue/autoplay-radio logic (calls `/api/related` when the queue runs out), Media Session API metadata/handlers (lock-screen controls), and a Screen Wake Lock (keeps the screen from idle-timing-out during playback — see README for the platform limits on this, it can't survive an intentional screen lock on iOS/Android because YouTube's iframe gets suspended).

`client/src/services/api.js` is a thin axios wrapper around the `/api/*` routes; `baseURL` comes from `VITE_API_BASE_URL` when set (split deployment) or defaults to the Vite dev proxy.

`client/src/utils/playlists.js` manages all playlists (including the built-in "Liked Songs", id `"liked"`, which can't be renamed/deleted) directly in `localStorage` — there's no backend persistence for library data. Because state lives outside React, it uses a manual pub-sub (`subscribeToPlaylistChanges`) so components in different parts of the tree (e.g. a `TrackCard` and the `PlayerBar`) stay in sync when a track is liked/unliked from either place.

Routing (`App.jsx`, react-router-dom): `/`, `/category/:id`, `/search`, `/library`, `/playlist/:id`, `/artist/:channelId`, `/track/:videoId` — the last three back the app's shareable links (artist pages, single-track pages).

PWA support is configured in `client/vite.config.js` via `vite-plugin-pwa` (manifest, service worker, `devOptions.enabled: true` so the SW also generates under `npm run dev`, not just prod builds).

## Deployment

Split deployment: **frontend → Netlify** (`netlify.toml`), **backend → Render** (`render.yaml`), because Netlify can't run the long-lived Express process the in-memory/disk cache depends on. When deployed this way, set `VITE_API_BASE_URL` (Netlify build env) to the Render URL + `/api`, and optionally lock down `CLIENT_ORIGIN` (Render env) to the Netlify URL. Full step-by-step is in README.md. Locally, `npm run build && npm start` runs the single-process production mode instead (no split needed).
