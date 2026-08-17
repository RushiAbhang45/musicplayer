const STORAGE_KEY = "musicplayer:recentlyPlayed";
const MAX_ENTRIES = 30;

export function getRecentlyPlayed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordPlay(track) {
  if (!track?.videoId) return;

  const entry = {
    videoId: track.videoId,
    title: track.title,
    channelId: track.channelId || null,
    channelTitle: track.channelTitle,
    thumbnail: track.thumbnail,
    duration: track.duration || "",
    categoryId: track.categoryId || null,
    playedAt: new Date().toISOString(),
  };

  const existing = getRecentlyPlayed().filter((t) => t.videoId !== track.videoId);
  const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable/full - fine to skip recording this play
  }
}
