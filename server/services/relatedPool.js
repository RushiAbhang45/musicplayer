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
// every currently-cached category combined - still curated/genre-flavored,
// just not narrowed to one. A small slice of whatever's sitting in
// relatedCache/artistTracksCache is mixed in too, for extra variety beyond
// the 10 fixed categories.
function samplePool({
  categoryCache,
  relatedCache,
  artistTracksCache,
  categoryId,
  excludeIds,
  limit = RELATED_RESULT_COUNT,
}) {
  const known = categoryId ? categoryCache.get(categoryId) : null;
  const basePool =
    known && known.length ? known : categories.flatMap((c) => categoryCache.get(c.id) || []);

  const bonus = [
    ...relatedCache.keys().flatMap((key) => relatedCache.get(key) || []),
    ...artistTracksCache.keys().flatMap((key) => artistTracksCache.get(key) || []),
  ].slice(0, 20);

  const byVideoId = new Map();
  for (const track of [...basePool, ...bonus]) {
    if (excludeIds.has(track.videoId) || byVideoId.has(track.videoId)) continue;
    byVideoId.set(track.videoId, track);
  }

  return shuffle(Array.from(byVideoId.values())).slice(0, limit);
}

module.exports = { samplePool, POOL_MIN_UNSEEN, RELATED_RESULT_COUNT };
