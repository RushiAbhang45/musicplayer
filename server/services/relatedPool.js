const categories = require("../config/categories");

// How many *unseen* local tracks we need before it's worth skipping a live
// YouTube search entirely, and how many related tracks a caller gets back.
const POOL_MIN_UNSEEN = 6;
const RELATED_RESULT_COUNT = 12;

function shuffle(list) {
  const result = list.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Builds a "same vibe, different artist" pool out of tracks the server has
// already paid quota for, instead of always issuing a fresh 100-unit search.
// When the source track's categoryId is known, the pool is just that
// category's cached tracks (real genre match). Otherwise it falls back to
// every currently-cached category combined, PLUS the trending chart -
// crucially, trending is fetched the moment anyone loads the homepage (1
// quota unit, already always warm), whereas category caches only fill up
// once someone actually clicks into a category tile. Without trending as a
// fallback source, a fresh deploy - or a listener who only ever uses search,
// never a curated category - would find every cache empty on their first
// few plays and silently fall through to the old same-artist search every
// time. A small slice of whatever's sitting in relatedCache/artistTracksCache
// is mixed in too, for extra variety beyond the 10 fixed categories.
function samplePool({
  categoryCache,
  relatedCache,
  artistTracksCache,
  trendingCache,
  categoryId,
  excludeIds,
  limit = RELATED_RESULT_COUNT,
}) {
  const trendingTracks = trendingCache?.get("trending") || [];
  const known = categoryId ? categoryCache.get(categoryId) : null;
  const basePool =
    known && known.length
      ? known
      : [...categories.flatMap((c) => categoryCache.get(c.id) || []), ...trendingTracks];

  const bonus = [
    ...relatedCache.keys().flatMap((key) => relatedCache.get(key) || []),
    ...artistTracksCache.keys().flatMap((key) => artistTracksCache.get(key) || []),
    ...(known && known.length ? trendingTracks : []),
  ].slice(0, 20);

  const byVideoId = new Map();
  for (const track of [...basePool, ...bonus]) {
    if (excludeIds.has(track.videoId) || byVideoId.has(track.videoId)) continue;
    byVideoId.set(track.videoId, track);
  }

  return shuffle(Array.from(byVideoId.values())).slice(0, limit);
}

module.exports = { samplePool, POOL_MIN_UNSEEN, RELATED_RESULT_COUNT };
