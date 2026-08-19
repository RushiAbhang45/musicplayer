const NOISE_PATTERN =
  /\(.*?\)|\[.*?\]|\bofficial\s*(music)?\s*video\b|\bofficial\s*audio\b|\blyric(s)?\s*video\b|\blyrics\b|\bfull\s*(song|video|audio)\b|\bvideo\s*song\b|\bhd\b|\b4k\b|\b8k\b|\bm\/?v\b/gi;

// "ARTIST 'Song Title' Official ..." - common for K-pop/pop MV titles that
// don't use a dash/pipe separator at all.
const QUOTE_LEAD_PATTERN = /^([A-Za-z0-9&.\s]{2,25})['"‘“]/;

// A candidate like "A.R. Rahman, Javed Ali, Mohit Chauhan" names a specific
// multi-artist collaboration - searching that exact combo just re-finds the
// same collaboration. Narrowing to the first name surfaces that artist's
// broader catalog instead, which is what "more like this" actually wants.
function firstName(candidate) {
  return candidate.split(",")[0].trim();
}

// A segment like "Neha Sharma, Aditya Seal & Aashim Gulati" names a movie's
// CAST, not a singer/composer - if the Bollywood-credits branch below picks
// this instead of the actual singer credit next to it, "more like this"
// ends up searching for an actor. 2+ commas, or a comma alongside "&"/"and",
// is a reasonable signal for "this is a list of several people", which a
// single artist/composer credit essentially never is.
function looksLikeCastList(segment) {
  const commaCount = (segment.match(/,/g) || []).length;
  return commaCount >= 2 || (commaCount >= 1 && /&|\band\b/i.test(segment));
}

// Best-effort guess at the "artist" behind a YouTube music video, used to
// find more songs in the same vein. Not perfect - titles aren't structured
// data - but good enough to power a "more like this" queue.
function deriveArtist(title, channelTitle) {
  // Auto-generated YouTube Music artist channels are named "<Artist> - Topic"
  // - this is the single most reliable signal when present.
  const topicMatch = /^(.+?)\s*-\s*Topic$/i.exec(channelTitle || "");
  if (topicMatch) {
    return { artist: topicMatch[1].trim(), confident: true };
  }

  const cleaned = (title || "").replace(NOISE_PATTERN, "").trim();
  const parts = cleaned
    // Two delimiter shapes, both needed:
    //  - `\s[-–—|]{1,3}\s` - hyphen/pipe/em-dash, require a space on BOTH
    //    sides (avoids splitting mid-word) - {1,3} because real titles often
    //    double/triple the separator itself ("Song || Movie || Singer |
    //    Cast"), which a plain single-char delimiter used to silently fail
    //    to split at all, collapsing what should be 4 credit segments into 2.
    //  - `:\s+` - colon, space required only AFTER it, since "Artist: Song"
    //    headline style almost never has a space before the colon. Kept
    //    separate from the symmetric group above specifically so a bare
    //    timestamp-like "10:30" (no space on either side) still doesn't split.
    .split(/\s[-–—|]{1,3}\s|:\s+/)
    .map((p) => p.replace(/[|:]+$/, "").trim())
    .filter(Boolean);

  // Western convention "Artist - Title": the first segment is the artist.
  if (parts.length === 2 && parts[0].length > 0 && parts[0].length <= 40) {
    return { artist: firstName(parts[0]), confident: true };
  }

  // Bollywood/credits-heavy convention "Song - Movie | Cast | Composer |
  // Singer" (credit order varies by uploader): the first segment is the
  // SONG, not the artist. Scan the remaining segments from the end
  // backwards - usually the last is the singer/composer credit, but skip
  // any that look like a cast list (see looksLikeCastList) so a segment
  // like "Song || Movie || Singer | Cast" doesn't end up naming an actor.
  if (parts.length >= 3) {
    for (let i = parts.length - 1; i >= 2; i--) {
      const candidate = parts[i];
      if (candidate.length > 0 && candidate.length <= 60 && !looksLikeCastList(candidate)) {
        return { artist: firstName(candidate), confident: true };
      }
    }
  }

  const quoteMatch = QUOTE_LEAD_PATTERN.exec(cleaned);
  if (quoteMatch) {
    const candidate = quoteMatch[1].trim();
    if (candidate.length > 0) {
      return { artist: firstName(candidate), confident: true };
    }
  }

  return { artist: (channelTitle || "").trim(), confident: false };
}

const STOPWORDS = new Set(["the", "and", "feat", "ft", "from", "with", "for", "of", "in", "to", "a", "an"]);

function significantWords(title, excludeWords = new Set()) {
  return (title || "")
    .replace(NOISE_PATTERN, " ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !excludeWords.has(w));
}

// Is `titleB` most likely a DIFFERENT YouTube upload of the SAME song as
// `titleA`? Same-artist matching alone can't answer this - a "Lyrics" video
// and the official "Full Video Song" of the identical track have different
// videoIds/channels and often differ in exactly how they're punctuated
// (movie name before or after the song name, "-" vs "|" vs ":" as the
// separator, double vs single delimiters...) but genuinely are the same
// song, so trying to positionally extract "the song name" and compare it is
// fragile across conventions. Comparing the full set of significant words
// instead sidesteps all of that: two uploads of the same song share nearly
// all their distinctive words (song name + movie) regardless of order.
//
// `sharedArtistKey` (the source track's own derived artist, e.g. "arijit
// singh") is stripped from BOTH word sets first - without this, two
// genuinely DIFFERENT short-titled songs by the same artist (e.g. "Tum Hi
// Ho" and "Ishq Mubarak", both Arijit Singh) can share just enough words
// (the artist's own name) to false-positive as "the same song" once the
// rest of the title is short. That comparison is redundant anyway - the
// caller already matches on artist separately.
function isSameSong(titleA, titleB, sharedArtistKey = null) {
  const excludeWords = new Set(sharedArtistKey ? sharedArtistKey.split(/\s+/).filter(Boolean) : []);
  const wordsA = new Set(significantWords(titleA, excludeWords));
  const wordsB = new Set(significantWords(titleB, excludeWords));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap / Math.min(wordsA.size, wordsB.size) >= 0.6;
}

module.exports = { deriveArtist, isSameSong };
