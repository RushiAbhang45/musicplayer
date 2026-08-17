const fs = require("fs");
const path = require("path");
const NodeCache = require("node-cache");
const categories = require("../config/categories");
const { searchVideos, getVideoDetails, getTrackById, getChannelInfo, getTrendingVideos } = require("./youtubeService");
const { deriveArtist } = require("../utils/deriveArtist");
const { samplePool, POOL_MIN_UNSEEN, RELATED_RESULT_COUNT } = require("./relatedPool");

const CACHE_DIR = path.join(__dirname, "..", ".cache");

// Bumped whenever the persisted shape changes in a way older files can't be
// read as-is (e.g. category tracks gaining a `categoryId` field) - a
// mismatched/missing version is discarded rather than reshaped, which costs
// one clean re-fetch instead of silently serving stale-shaped data forever.
const DISK_FORMAT_VERSION = 2;

const CATEGORY_TTL_SECONDS =
  (Number(process.env.CATEGORY_CACHE_TTL_HOURS) || 12) * 3600;
const SEARCH_TTL_SECONDS =
  (Number(process.env.SEARCH_CACHE_TTL_MINUTES) || 60) * 60;
const TRENDING_TTL_SECONDS =
  (Number(process.env.TRENDING_CACHE_TTL_HOURS) || 6) * 3600;

// Curated category playlists: long TTL, warmed on startup so no visitor
// ever waits on a live YouTube call for the homepage.
const categoryCache = new NodeCache({ stdTTL: CATEGORY_TTL_SECONDS });

// Free-text user searches: short TTL, bounded key count so repeated
// identical queries across visitors don't re-spend YouTube API quota.
const searchCache = new NodeCache({ stdTTL: SEARCH_TTL_SECONDS, maxKeys: 200 });

// "Related songs" (autoplay/radio) fallback results - keyed by category or
// artist (see relatedPool.js / getRelatedTracks), not by source videoId, so
// the same fallback is reusable across every track that maps to it; and
// artist/channel browsing results.
const relatedCache = new NodeCache({ stdTTL: SEARCH_TTL_SECONDS, maxKeys: 300 });
const artistTracksCache = new NodeCache({ stdTTL: SEARCH_TTL_SECONDS, maxKeys: 200 });
const artistInfoCache = new NodeCache({ stdTTL: SEARCH_TTL_SECONDS, maxKeys: 200 });

// Single-track lookups for shareable /track/:videoId links. Long TTL since a
// video's title/channel/thumbnail essentially never change. Not disk-backed
// (see makeDiskBackedCache callers below) - cheap to rebuild, low value.
const trackInfoCache = new NodeCache({ stdTTL: CATEGORY_TTL_SECONDS, maxKeys: 500 });

// Trending chart: same long-ish TTL story as categories, disk-backed.
const trendingCache = new NodeCache({ stdTTL: TRENDING_TTL_SECONDS });

// Generic disk snapshot for a node-cache instance, keyed by whatever keys
// happen to be in the cache (category id, search query, channelId, etc).
// Used so a server restart (dev reload, Render cold start/redeploy) reuses
// what was already fetched instead of re-spending quota for data that's
// still within its TTL.
function makeDiskBackedCache({ file, cache, ttlSeconds }) {
  function persist() {
    const keys = cache.keys();
    if (keys.length === 0) return;
    const data = cache.mget(keys);
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(
        file,
        JSON.stringify({ formatVersion: DISK_FORMAT_VERSION, savedAt: Date.now(), data })
      );
    } catch (err) {
      console.warn(`[cache] failed to persist ${path.basename(file)}:`, err.message);
    }
  }

  // Returns true if it loaded something (so the caller can skip a startup
  // refresh entirely for the cache that owns this file).
  function load() {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch {
      return false;
    }

    if (parsed.formatVersion !== DISK_FORMAT_VERSION) return false;

    const age = Date.now() - (parsed.savedAt || 0);
    if (age >= ttlSeconds * 1000) return false;

    const entries = Object.entries(parsed.data || {});
    for (const [key, value] of entries) {
      cache.set(key, value);
    }
    console.log(
      `[cache] loaded ${entries.length} entries from disk for ${path.basename(file)} (${Math.round(
        age / 60000
      )}m old)`
    );
    return true;
  }

  return { persist, load };
}

const categoryDisk = makeDiskBackedCache({
  file: path.join(CACHE_DIR, "categories.json"),
  cache: categoryCache,
  ttlSeconds: CATEGORY_TTL_SECONDS,
});
const relatedDisk = makeDiskBackedCache({
  file: path.join(CACHE_DIR, "related.json"),
  cache: relatedCache,
  ttlSeconds: SEARCH_TTL_SECONDS,
});
const artistTracksDisk = makeDiskBackedCache({
  file: path.join(CACHE_DIR, "artist-tracks.json"),
  cache: artistTracksCache,
  ttlSeconds: SEARCH_TTL_SECONDS,
});
const artistInfoDisk = makeDiskBackedCache({
  file: path.join(CACHE_DIR, "artist-info.json"),
  cache: artistInfoCache,
  ttlSeconds: SEARCH_TTL_SECONDS,
});
const trendingDisk = makeDiskBackedCache({
  file: path.join(CACHE_DIR, "trending.json"),
  cache: trendingCache,
  ttlSeconds: TRENDING_TTL_SECONDS,
});

async function fetchCategoryTracks(category) {
  const resultsByVideoId = new Map();
  for (const query of category.queries) {
    const tracks = await searchVideos(query, { maxResults: 12, musicOnly: true });
    for (const track of tracks) {
      if (!resultsByVideoId.has(track.videoId)) {
        // categoryId is what lets the related-tracks pool sampler (see
        // relatedPool.js) group cached tracks by genre/vibe.
        resultsByVideoId.set(track.videoId, { ...track, categoryId: category.id });
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
  categoryDisk.persist();
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
  categoryDisk.persist();
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

// Builds the "up next" queue once a listener's queue runs dry. Prefers
// sampling tracks the server already paid quota for (same category when
// known, otherwise a pool spanning every cached category) - this is what
// gives cross-artist variety within the same genre AND costs ~0 quota in
// the common case, instead of the old "always search '<artist> songs'"
// approach that both (a) spent 100 units on every single queue refill and
// (b) only ever surfaced the one artist. A live search only happens when
// the local pool is too thin to be worth serving.
async function getRelatedTracks(videoId, { categoryId = null, excludeIds = [] } = {}) {
  const excludeSet = new Set([videoId, ...excludeIds]);

  const pool = samplePool({
    categoryCache,
    relatedCache,
    artistTracksCache,
    categoryId,
    excludeIds: excludeSet,
    limit: RELATED_RESULT_COUNT,
  });

  if (pool.length >= POOL_MIN_UNSEEN) {
    console.log(`[related] served ${pool.length} tracks from local pool for "${videoId}" (0 quota)`);
    return pool;
  }

  console.log(
    `[related] local pool too thin (${pool.length}/${POOL_MIN_UNSEEN}) for "${videoId}" - falling back to a live search`
  );

  const category = categoryId ? categories.find((c) => c.id === categoryId) : null;

  let fallbackKey;
  let query = null;
  let channelId = null;

  if (category) {
    // Broadened genre/mood query instead of a specific artist - reusable
    // across every track from this category, unlike the old per-videoId key.
    fallbackKey = `category:${category.id}`;
    query = category.queries[0];
  } else {
    const video = await getVideoDetails(videoId);
    if (!video) return pool;

    const { artist, confident } = deriveArtist(video.title, video.channelTitle);
    if (confident && artist) {
      fallbackKey = `artist:${artist.toLowerCase()}`;
      query = `${artist} songs`;
    } else {
      fallbackKey = `channel:${video.channelId}`;
      channelId = video.channelId;
    }
  }

  let fallbackTracks = relatedCache.get(fallbackKey);
  if (!fallbackTracks) {
    fallbackTracks = await searchVideos(query, { maxResults: 16, musicOnly: true, channelId });
    relatedCache.set(fallbackKey, fallbackTracks);
    relatedDisk.persist();
  } else {
    console.log(`[related] fallback cache hit for "${fallbackKey}"`);
  }

  const merged = pool.slice();
  const seen = new Set(merged.map((t) => t.videoId));
  for (const track of fallbackTracks) {
    if (excludeSet.has(track.videoId) || seen.has(track.videoId)) continue;
    merged.push(track);
    seen.add(track.videoId);
    if (merged.length >= RELATED_RESULT_COUNT) break;
  }

  return merged;
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
  artistTracksDisk.persist();
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
  if (info) {
    artistInfoCache.set(channelId, info);
    artistInfoDisk.persist();
  }
  return info;
}

// YouTube's mostPopular chart - 1 quota unit regardless of result count,
// vs. 100 for a search.list call. Long-ish TTL, disk-backed like categories.
async function getTrending() {
  const cached = trendingCache.get("trending");
  if (cached) {
    console.log("[cache] hit for trending");
    return cached;
  }

  console.log("[cache] miss for trending - fetching from YouTube");
  const regionCode = process.env.TRENDING_REGION || "IN";
  const tracks = await getTrendingVideos({ regionCode });
  trendingCache.set("trending", tracks);
  trendingDisk.persist();
  return tracks;
}

// Warms from disk if fresh-enough snapshots exist (cheap, no API calls), but
// deliberately does NOT eagerly fetch all 10 categories on startup when it
// doesn't - that "always fetch everything on boot" pattern is what burns
// ~1,000 quota units every time a free-tier host (Render, etc.) spins back
// up from a cold start, even with zero real visitors. Categories the disk
// cache doesn't cover just populate lazily via getCategoryTracks's normal
// cache-miss path the first time someone actually visits them - one
// category (100 units), not ten, and only for categories people look at.
function startScheduledRefresh() {
  categoryDisk.load();
  relatedDisk.load();
  artistTracksDisk.load();
  artistInfoDisk.load();
  trendingDisk.load();
  setInterval(refreshAllCategories, CATEGORY_TTL_SECONDS * 1000);
}

module.exports = {
  getCategoryTracks,
  getSearchResults,
  getRelatedTracks,
  getArtistTracks,
  getArtistInfo,
  getTrackInfo,
  getTrending,
  startScheduledRefresh,
};
