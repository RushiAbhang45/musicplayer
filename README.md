# MusicPlayer

A curated music discovery website: browse "hits" playlists (Sufi & Romance, Love, Dance, Party, DJ/Remix, 90s, Classics, 70s, 80s, Pop & Rap) or search for any song, and play it through an embedded YouTube player with a custom dark, neon-glassmorphism UI. Save favorites to a local "My Library" (stored in your browser).

## How playback works (read this first)

This app **streams audio via YouTube's official IFrame Player API** — the same embedded player YouTube provides for any site. It does **not** extract, download, rip, or convert audio to MP3 anywhere, on the client or the server. That approach (common on "YouTube to MP3" sites) is copyright infringement and a violation of YouTube's Terms of Service, and is intentionally not part of this project. "Save to My Library" only stores the song's YouTube video ID and metadata (title, thumbnail, channel) in your browser — playback always streams live from YouTube.

**Lock-screen / background playback:** the app sets up Media Session metadata (lock-screen title/artist/artwork/controls) and uses the Screen Wake Lock API to stop the screen from auto-locking from idle timeout while a song plays. It cannot guarantee playback survives an *intentional* screen lock (pressing the power button) on every device — iOS Safari and, less consistently, Android Chrome suspend background video in third-party iframes like YouTube's embed once the screen actually locks, regardless of PWA install status. This is a platform-level restriction on embedded video, not something fixable in app code, and it affects every site that embeds YouTube this way. The only way around it is extracting YouTube's audio (which this project deliberately does not do) or switching to a licensed streaming API (Spotify/Apple Music), which was intentionally not pursued to keep this free and avoid requiring a paid subscription.

## Project structure

```
server/   Express API — search proxy + cached curated category playlists
client/   React (Vite) frontend — UI, player, library
```

## 1. Get a YouTube Data API v3 key

The search and curated playlists are powered by the YouTube Data API. You need a free API key:

1. Go to https://console.cloud.google.com and sign in.
2. Create a new project (e.g. "MusicPlayer-App").
3. Go to **APIs & Services → Library**, search for **YouTube Data API v3**, and click **Enable**.
4. Go to **APIs & Services → Credentials → Create Credentials → API key**.
5. Click the new key to restrict it:
   - **API restrictions** → Restrict key → select only **YouTube Data API v3**.
   - **Application restrictions** → None (fine for local development).
6. Copy the key.

The free tier gives you 10,000 quota units/day. A search costs 100 units. This app caches curated category results (refreshed every 12h by default) and caches live searches for an hour, so normal usage stays well within the free quota. You can monitor usage under **APIs & Services → YouTube Data API v3 → Quotas**.

## 2. Configure the server

```powershell
cd server
copy .env.example .env
```

Open `server/.env` and paste your key:

```
YOUTUBE_API_KEY=your_key_here
```

`.env` is gitignored — never commit your real key.

## 3. Install and run

From the project root (`D:\MusicPlayer`):

```powershell
npm install
npm run dev
```

This starts:
- the Express API on **http://localhost:5000**
- the Vite dev server on **http://localhost:5173** (open this in your browser)

The client dev server proxies `/api/*` requests to the Express server, so no CORS setup is needed in development.

## Running in Visual Studio

1. **File → Open → Folder...** and select `D:\MusicPlayer`. No solution file is required — it's a plain Node/npm project.
2. Use the built-in terminal (**View → Terminal**) to run `npm install` and `npm run dev`, or open **Task Runner Explorer** and run the scripts from `package.json` directly.

## Production-style run

```powershell
npm run build
npm start
```

This builds the React app into `client/dist` and starts a single Express server (port 5000 by default) that serves both the API and the built frontend.

## Environment variables (`server/.env`)

| Variable | Default | Description |
|---|---|---|
| `YOUTUBE_API_KEY` | — | **Required.** Your YouTube Data API v3 key. |
| `PORT` | `5000` | Port the Express server listens on. |
| `CATEGORY_CACHE_TTL_HOURS` | `12` | How often curated category playlists refresh from YouTube. |
| `SEARCH_CACHE_TTL_MINUTES` | `60` | How long identical search queries are cached. |
| `CLIENT_ORIGIN` | *(all origins)* | Restrict CORS to your deployed frontend's URL once known. Comma-separate for more than one. |

## Deploying (frontend on Netlify, backend on Render)

Netlify only hosts static sites and short-lived serverless functions — it can't run this app's persistent Express server, which keeps an in-memory cache alive and refreshes it on a timer. So the two halves deploy separately: **frontend → Netlify**, **backend → Render** (Render's free tier runs a real long-lived Node process, so the caching works exactly as it does locally).

Both platforms deploy from a Git repository, so push this project to GitHub (or GitLab/Bitbucket) first if you haven't already:

```powershell
git init
git add .
git commit -m "Initial commit"
```
then create a repo on GitHub and push to it.

### 1. Backend → Render

1. Go to https://render.com, sign in, **New → Web Service**, connect this repo.
2. Render should auto-detect `render.yaml` (Blueprint) with the right settings. If configuring manually instead: **Build Command** `npm install`, **Start Command** `npm start`.
3. Add environment variables (Render dashboard → Environment): `YOUTUBE_API_KEY` (required — same key from step 1 above). `PORT` is provided automatically by Render, don't set it.
4. Deploy, then copy the service's URL, e.g. `https://musicplayer-server.onrender.com`.

**Free tier note:** Render's free web services spin down after ~15 minutes idle. The first request after that wakes it back up but can take 30–50 seconds — later requests are fast again. Fine for a personal project; upgrade the plan if you want it always warm.

### 2. Frontend → Netlify

1. Go to https://app.netlify.com, **Add new site → Import an existing project**, connect this repo. It should pick up `netlify.toml` automatically (build command, publish directory, and the SPA redirect it needs for client-side routing).
2. Before deploying, add an environment variable: **Site settings → Environment variables** → `VITE_API_BASE_URL` = your Render URL + `/api`, e.g. `https://musicplayer-server.onrender.com/api`. (This gets baked in at build time, so it must be set before the first deploy — or trigger a re-deploy after adding it.)
3. Deploy. Netlify gives you a URL like `https://your-site.netlify.app`.

### 3. Lock down CORS (optional but recommended)

Back in Render's dashboard, set `CLIENT_ORIGIN` to your Netlify URL (e.g. `https://your-site.netlify.app`) so only your deployed frontend can call the API, then redeploy the backend.
