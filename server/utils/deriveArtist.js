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
    .split(/\s[-–—|:]\s/)
    .map((p) => p.replace(/[|:]+$/, "").trim())
    .filter(Boolean);

  // Western convention "Artist - Title": the first segment is the artist.
  if (parts.length === 2 && parts[0].length > 0 && parts[0].length <= 40) {
    return { artist: firstName(parts[0]), confident: true };
  }

  // Bollywood/credits-heavy convention "Song - Movie | Cast | Composer |
  // Singer": the first segment is the SONG, not the artist - the last
  // segment is usually the singer/composer credit instead.
  if (parts.length >= 3) {
    const candidate = parts[parts.length - 1];
    if (candidate.length > 0 && candidate.length <= 60) {
      return { artist: firstName(candidate), confident: true };
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

module.exports = { deriveArtist };
