const fs = require("fs");
const path = require("path");
const NodeCache = require("node-cache");
const categories = require("../config/categories");
const { searchVideos, getVideoDetails, getTrackById, getChannelInfo } = require("./youtubeService");
const { deriveArtist } = require("../utils/deriveArtist");

// Category results are persisted to disk so a server restart (dev reloads,
// Render waking from sleep, redeploys) reuses the last fetch instead of
// re-spending ~1,000 quota units re-fetching all 10 categories every time.
const CACHE_FILE = path.join(__dirname, "..", ".cache", "categories.json");

const CATEGORY_TTL_SECONDS =
  (Number(process.env.CATEGORY_CACHE_TTL_HOURS) || 12) * 3600;
const SEARCH_TTL_SECONDS =
  (Number(process.env.SEARCH_CACHE_TTL_MINUTES) || 60) * 60;

// Curated category playlists: long TTL, warmed on startup so no visitor
// ever waits on a live YouTube call for the homepage.
const categoryCache = new NodeCache({ stdTTL: CATEGORY_TTL_SECONDS });

// Free-text user searches: short TTL, bounded key count so repeated
// identical queries across visitors don't re-spend YouTube API quota.
const searchCache = new NodeCache({ stdTTL: SEARCH_TTL_SECONDS, maxKeys: 200 });

// "Related songs" (autoplay/radio) results, keyed by the video they were
// derived from; and artist/channel browsing results.
const relatedCache = new NodeCache({ stdTTL: SEARCH_TTL_SECONDS, maxKeys: 300 });
const artistTracksCache = new NodeCache({ stdTTL: SEARCH_TTL_SECONDS, maxKeys: 200 });
const artistInfoCache = new NodeCache({ stdTTL: SEARCH_TTL_SECONDS, maxKeys: 200 });

// Single-track lookups for shareable /track/:videoId links. Long TTL since a
// video's title/channel/thumbnail essentially never change.
const trackInfoCache = new NodeCache({ stdTTL: CATEGORY_TTL_SECONDS, maxKeys: 500 });

async function fetchCategoryTracks(category) {
  const resultsByVideoId = new Map();
  for (const query of category.queries) {
    const tracks = await searchVideos(query, { maxResults: 12, musicOnly: true });
    for (const track of tracks) {
      if (!resultsByVideoId.has(track.videoId)) {
        resultsByVideoId.set(track.videoId, track);
      }
    }
  }
  return Array.from(resultsByVideoId.values());
}

async function refreshCategory(category) {
  try {
    const tracks = await fetchCategoryTracks(category);
    categoryCache.set(category.id, tracks);
    console.log(`[cache] refreshed category "${category.id}" (${tracks.length} tracks)`);
  } catch (err) {
    console.error(`[cache] failed to refresh category "${category.id}":`, err.message);
  }
}

async function refreshAllCategories() {
  for (const category of categories) {
    await refreshCategory(category);
  }
  persistCategoriesToDisk();
}

function persistCategoriesToDisk() {
  const data = {};
  for (const category of categories) {
    const tracks = categoryCache.get(category.id);
    if (tracks) data[category.id] = tracks;
  }
  // Don't persist an all-empty result (e.g. quota exhausted mid-refresh) -
  // that would make a future restart wrongly skip a refresh it could
  // actually complete, hiding empty categories for a full TTL window.
  if (Object.keys(data).length === 0) return;
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ savedAt: Date.now(), data }));
  } catch (err) {
    console.warn("[cache] failed to persist category cache to disk:", err.message);
  }
}

// Loads a previously-persisted cache from disk if it's still within the TTL
// window. Returns true if it loaded something (so the caller can skip the
// live-fetch startup refresh entirely).
function loadCategoriesFromDisk() {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
  } catch {
    return false;
  }

  const age = Date.now() - (parsed.savedAt || 0);
  if (age >= CATEGORY_TTL_SECONDS * 1000) return false;

  for (const [categoryId, tracks] of Object.entries(parsed.data || {})) {
    categoryCache.set(categoryId, tracks);
  }
  console.log(
    `[cache] loaded ${Object.keys(parsed.data || {}).length} categories from disk (${Math.round(
      age / 60000
    )}m old) - skipping startup refresh`
  );
  return true;
}

async function getCategoryTracks(categoryId) {
  const cached = categoryCache.get(categoryId);
  if (cached) {
    console.log(`[cache] hit for category "${categoryId}"`);
    return cached;
  }

  const category = categories.find((c) => c.id === categoryId);
  if (!category) return null;

  console.log(`[cache] miss for category "${categoryId}" - fetching from YouTube`);
  const tracks = await fetchCategoryTracks(category);
  categoryCache.set(categoryId, tracks);
  persistCategoriesToDisk();
  return tracks;
}

async function getSearchResults(query) {
  const key = query.trim().toLowerCase();
  const cached = searchCache.get(key);
  if (cached) {
    console.log(`[cache] hit for search "${key}"`);
    return cached;
  }

  console.log(`[cache] miss for search "${key}" - fetching from YouTube`);
  const tracks = await searchVideos(query, { maxResults: 20, musicOnly: false });
  try {
    searchCache.set(key, tracks);
  } catch (err) {
    // maxKeys limit reached - fine to skip caching this one query
    console.warn(`[cache] could not cache search "${key}":`, err.message);
  }
  return tracks;
}

// Derives an artist guess from the current track (see utils/deriveArtist)
// and searches for more songs from them - this is what powers "autoplay
// similar songs" once a queue runs out. Falls back to other uploads from
// the same channel when the title doesn't parse into a confident artist.
async function getRelatedTracks(videoId) {
  const cached = relatedCache.get(videoId);
  if (cached) {
    console.log(`[cache] hit for related "${videoId}"`);
    return cached;
  }

  console.log(`[cache] miss for related "${videoId}" - deriving from YouTube`);
  const video = await getVideoDetails(videoId);
  if (!video) return [];

  const { artist, confident } = deriveArtist(video.title, video.channelTitle);

  const tracks =
    confident && artist
      ? await searchVideos(`${artist} songs`, { maxResults: 16, musicOnly: true })
      : await searchVideos(null, { maxResults: 16, musicOnly: true, channelId: video.channelId });

  const related = tracks.filter((t) => t.videoId !== videoId).slice(0, 12);
  relatedCache.set(videoId, related);
  return related;
}

async function getArtistTracks(channelId) {
  const cached = artistTracksCache.get(channelId);
  if (cached) {
    console.log(`[cache] hit for artist tracks "${channelId}"`);
    return cached;
  }

  const tracks = await searchVideos(null, {
    maxResults: 24,
    musicOnly: true,
    channelId,
    order: "date",
  });
  artistTracksCache.set(channelId, tracks);
  return tracks;
}

// Powers shareable /track/:videoId links - given just a videoId (no search
// context), fetches everything needed to render a TrackCard and start
// playback.
async function getTrackInfo(videoId) {
  const cached = trackInfoCache.get(videoId);
  if (cached) return cached;

  const track = await getTrackById(videoId);
  if (track) trackInfoCache.set(videoId, track);
  return track;
}

async function getArtistInfo(channelId) {
  const cached = artistInfoCache.get(channelId);
  if (cached) return cached;

  const info = await getChannelInfo(channelId);
  if (info) artistInfoCache.set(channelId, info);
  return info;
}

// Warms from disk if a fresh-enough cache exists (cheap, no API calls), but
// deliberately does NOT eagerly fetch all 10 categories on startup when it
// doesn't - that "always fetch everything on boot" pattern is what burns
// ~1,000 quota units every time a free-tier host (Render, etc.) spins back
// up from a cold start, even with zero real visitors. Categories the disk
// cache doesn't cover just populate lazily via getCategoryTracks's normal
// cache-miss path the first time someone actually visits them - one
// category (100 units), not ten, and only for categories people look at.
function startScheduledRefresh() {
  loadCategoriesFromDisk();
  setInterval(refreshAllCategories, CATEGORY_TTL_SECONDS * 1000);
}

module.exports = {
  getCategoryTracks,
  getSearchResults,
  getRelatedTracks,
  getArtistTracks,
  getArtistInfo,
  getTrackInfo,
  startScheduledRefresh,
};
