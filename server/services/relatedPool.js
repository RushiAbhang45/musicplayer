const categories = require("../config/categories");
const { deriveArtist, isSameSong } = require("../utils/deriveArtist");

// How many *unseen* local tracks we need before it's worth skipping a live
// YouTube search entirely, and how many related tracks a caller gets back.
const POOL_MIN_UNSEEN = 6;
const RELATED_RESULT_COUNT = 12;

// Cap on how many of the returned tracks may share the source track's artist,
// across both tiers A and C below - without this, an artist with deep
// catalog coverage in the cache could crowd out the "different artist"
// variety this pool is meant to provide. Only applied when a categoryId is
// known - see classifyTrack.
const SAME_ARTIST_CAP = 3;

function shuffle(list) {
  const result = list.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function normalizeArtistKey(name) {
  const key = (name || "").trim().toLowerCase();
  return key.length > 0 ? key : null;
}

// Classifies one candidate against the source track's categoryId/channelId/
// derived-artist signal. Three independent facts feed the tier:
//   - sameCategory: same curated genre (categoryId) - the closest "same
//     vibe" signal this YouTube-sourced schema has.
//   - channelMatch: same uploading channelId. Reliable when the channel IS
//     the artist (an "<Artist> - Topic" auto-generated channel, or an
//     artist's own channel), but most Bollywood/Punjabi content is uploaded
//     by LABEL channels (T-Series, Zee Music, Speed Records, ...) that
//     publish hundreds of different singers - so on its own, for a label
//     channel, this is barely more specific than "some Bollywood song".
//   - preciseMatch: same *derived* artist - deriveArtist() (utils/
//     deriveArtist.js) pulls the actual singer/composer credit out of the
//     video title text (e.g. "Kesariya - Brahmastra | Arijit Singh |
//     Pritam"). This is what catches "same artist, different label", which
//     channelMatch alone can't, and is the one signal precise enough to
//     trust even without a category (see relevantCount below).
function classifyTrack(track, categoryId, channelId, sourceArtistKey) {
  const sameCategory = Boolean(categoryId) && track.categoryId === categoryId;
  const channelMatch = Boolean(channelId) && track.channelId === channelId;
  const preciseMatch =
    Boolean(sourceArtistKey) &&
    normalizeArtistKey(deriveArtist(track.title, track.channelTitle).artist) === sourceArtistKey;
  const sameArtist = channelMatch || preciseMatch;

  let tier;
  if (sameCategory && sameArtist) tier = "A";
  else if (sameCategory) tier = "B";
  else if (sameArtist) tier = "C";
  else tier = "D";

  return { tier, sameArtist, preciseMatch };
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
// ranked into tiers by categoryId/artist match against the source track (see
// classifyTrack), since genre + artist are the only real "vibe" signals this
// YouTube-sourced schema has (no genre/mood/BPM/tags/album/year field
// exists). Genre match outranks artist match, and - when a genre IS known -
// artist match is capped (SAME_ARTIST_CAP) so it stays a boost, not a
// takeover of the "different artist" variety this pool exists to provide.
// Without a genre, artist match is the only signal there is, so it isn't
// capped (see sameArtistCap below).
function samplePool({
  categoryCache,
  relatedCache,
  artistTracksCache,
  trendingCache,
  categoryId,
  channelId = null,
  sourceTitle = null,
  sourceChannelTitle = null,
  excludeIds,
  limit = RELATED_RESULT_COUNT,
}) {
  const sourceArtistKey = sourceTitle
    ? normalizeArtistKey(deriveArtist(sourceTitle, sourceChannelTitle).artist)
    : null;
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
    // A different YouTube upload of the exact same song the source track
    // already is (a "Lyrics" video vs the official "Full Video Song", a
    // remix/refix, etc.) has a different videoId so excludeIds alone won't
    // catch it - but recommending it right after the original just played
    // feels like nothing happened, not a "next song". See isSameSong.
    if (sourceTitle && isSameSong(sourceTitle, track.title, sourceArtistKey)) continue;
    byVideoId.set(track.videoId, track);
  }

  const buckets = { A: [], B: [], C: [], D: [] };
  const matchInfo = new Map(); // videoId -> { sameArtist, preciseMatch }
  for (const track of byVideoId.values()) {
    const info = classifyTrack(track, categoryId, channelId, sourceArtistKey);
    buckets[info.tier].push(track);
    matchInfo.set(track.videoId, info);
  }

  // How many candidates are actually relevant, independent of the `limit`
  // slicing below - this is what the caller should judge "is this pool
  // good enough, or should I fall back to a live search" on, not the raw
  // returned array length (which can look deceptively full even when it's
  // mostly filler - see getRelatedTracks).
  //
  // With a categoryId known, genre itself (tier B) is a real "same vibe"
  // signal, so any A/B/C candidate counts. WITHOUT one (search results,
  // trending, recently-played all lack a genre tag), a bare channelId match
  // isn't trustworthy enough on its own to call the pool "good" - for a
  // prolific label channel that's barely more specific than "a Bollywood
  // song", so only a precise derived-artist match counts here. Otherwise a
  // pool stuffed with same-label-different-singer noise would look
  // sufficient and skip the artist-targeted live search that's actually
  // needed (see getRelatedTracks).
  const relevantCount = categoryId
    ? buckets.A.length + buckets.B.length + buckets.C.length
    : [...matchInfo.values()].filter((info) => info.preciseMatch).length;

  const ranked = [...shuffle(buckets.A), ...shuffle(buckets.B), ...shuffle(buckets.C), ...shuffle(buckets.D)];

  const sameArtistCap = categoryId ? SAME_ARTIST_CAP : Infinity;
  const result = [];
  const deferred = [];
  let sameArtistCount = 0;
  for (const track of ranked) {
    const isSameArtist = matchInfo.get(track.videoId)?.sameArtist || false;
    if (isSameArtist && sameArtistCount >= sameArtistCap) {
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

  return { tracks: result, relevantCount };
}

module.exports = { samplePool, POOL_MIN_UNSEEN, RELATED_RESULT_COUNT };
