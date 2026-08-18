const categories = require("../config/categories");

// How many *unseen* local tracks we need before it's worth skipping a live
// YouTube search entirely, and how many related tracks a caller gets back.
const POOL_MIN_UNSEEN = 6;
const RELATED_RESULT_COUNT = 12;

// Cap on how many of the returned tracks may share the source track's artist
// (channelId), across both tiers A and C below - without this, an artist with
// deep catalog coverage in the cache could crowd out the "different artist"
// variety this pool is meant to provide.
const SAME_ARTIST_CAP = 3;

function shuffle(list) {
  const result = list.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Ranks a candidate against the source track's categoryId/channelId. Genre
// (categoryId) outranks artist (channelId) since it's the closer "same vibe"
// signal - artist match is a secondary boost, capped by SAME_ARTIST_CAP below
// so it doesn't turn into "radio for this one artist".
function tierOf(track, categoryId, channelId) {
  const sameCategory = Boolean(categoryId) && track.categoryId === categoryId;
  const sameArtist = Boolean(channelId) && track.channelId === channelId;
  if (sameCategory && sameArtist) return "A";
  if (sameCategory) return "B";
  if (sameArtist) return "C";
  return "D";
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
//
// Selection out of that combined pool isn't a flat random shuffle - it's
// ranked into tiers by categoryId/channelId match against the source track
// (see tierOf), since those are the only two real "vibe" signals this
// YouTube-sourced schema has (no genre/mood/BPM/tags/album/year field
// exists). Genre match outranks artist match, and artist match is capped
// (SAME_ARTIST_CAP) so it stays a boost, not a takeover of the "different
// artist" variety this pool exists to provide.
function samplePool({
  categoryCache,
  relatedCache,
  artistTracksCache,
  trendingCache,
  categoryId,
  channelId = null,
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

  const buckets = { A: [], B: [], C: [], D: [] };
  for (const track of byVideoId.values()) {
    buckets[tierOf(track, categoryId, channelId)].push(track);
  }
  const ranked = [...shuffle(buckets.A), ...shuffle(buckets.B), ...shuffle(buckets.C), ...shuffle(buckets.D)];

  // Enforce SAME_ARTIST_CAP across tiers A+C: once hit, defer further
  // same-artist tracks to the end so they're only used as backfill if the
  // pool is too thin to reach `limit` any other way.
  const result = [];
  const deferred = [];
  let sameArtistCount = 0;
  for (const track of ranked) {
    const isSameArtist = Boolean(channelId) && track.channelId === channelId;
    if (isSameArtist && sameArtistCount >= SAME_ARTIST_CAP) {
      deferred.push(track);
      continue;
    }
    if (isSameArtist) sameArtistCount++;
    result.push(track);
    if (result.length >= limit) break;
  }
  for (const track of deferred) {
    if (result.length >= limit) break;
    result.push(track);
  }

  return result;
}

module.exports = { samplePool, POOL_MIN_UNSEEN, RELATED_RESULT_COUNT };
