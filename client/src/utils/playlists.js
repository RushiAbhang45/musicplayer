const STORAGE_KEY = "musicplayer:playlists";
const OLD_LIBRARY_KEY = "musicplayer:library";
export const LIKED_PLAYLIST_ID = "liked";

function makeId() {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTrack(track) {
  return {
    videoId: track.videoId,
    title: track.title,
    channelId: track.channelId || null,
    channelTitle: track.channelTitle,
    thumbnail: track.thumbnail,
    duration: track.duration || "",
    addedAt: new Date().toISOString(),
  };
}

function readRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeRaw(playlists) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
}

// One-time migration from the old flat "My Library" favorites list into the
// new "Liked Songs" playlist, plus lazily ensuring Liked Songs always exists.
function loadPlaylists() {
  let playlists = readRaw();

  if (!playlists) {
    let likedTracks = [];
    try {
      const oldRaw = localStorage.getItem(OLD_LIBRARY_KEY);
      if (oldRaw) likedTracks = JSON.parse(oldRaw);
    } catch {
      likedTracks = [];
    }

    playlists = [
      {
        id: LIKED_PLAYLIST_ID,
        name: "Liked Songs",
        createdAt: new Date().toISOString(),
        tracks: likedTracks,
      },
    ];
    writeRaw(playlists);
    localStorage.removeItem(OLD_LIBRARY_KEY);
  } else if (!playlists.some((p) => p.id === LIKED_PLAYLIST_ID)) {
    playlists = [
      { id: LIKED_PLAYLIST_ID, name: "Liked Songs", createdAt: new Date().toISOString(), tracks: [] },
      ...playlists,
    ];
    writeRaw(playlists);
  }

  return playlists;
}

export function getPlaylists() {
  return loadPlaylists();
}

export function getPlaylist(id) {
  return loadPlaylists().find((p) => p.id === id) || null;
}

export function createPlaylist(name) {
  const playlists = loadPlaylists();
  const playlist = {
    id: makeId(),
    name: name.trim() || "Untitled Playlist",
    createdAt: new Date().toISOString(),
    tracks: [],
  };
  writeRaw([...playlists, playlist]);
  return playlist;
}

export function renamePlaylist(id, name) {
  if (id === LIKED_PLAYLIST_ID) return;
  const playlists = loadPlaylists().map((p) =>
    p.id === id ? { ...p, name: name.trim() || p.name } : p
  );
  writeRaw(playlists);
}

export function deletePlaylist(id) {
  if (id === LIKED_PLAYLIST_ID) return;
  writeRaw(loadPlaylists().filter((p) => p.id !== id));
}

export function isTrackInPlaylist(id, videoId) {
  const playlist = getPlaylist(id);
  return !!playlist && playlist.tracks.some((t) => t.videoId === videoId);
}

export function addTrackToPlaylist(id, track) {
  const playlists = loadPlaylists();
  const playlists2 = playlists.map((p) => {
    if (p.id !== id) return p;
    if (p.tracks.some((t) => t.videoId === track.videoId)) return p;
    return { ...p, tracks: [...p.tracks, normalizeTrack(track)] };
  });
  writeRaw(playlists2);
}

export function removeTrackFromPlaylist(id, videoId) {
  const playlists = loadPlaylists().map((p) =>
    p.id === id ? { ...p, tracks: p.tracks.filter((t) => t.videoId !== videoId) } : p
  );
  writeRaw(playlists);
}

export function isLiked(videoId) {
  return isTrackInPlaylist(LIKED_PLAYLIST_ID, videoId);
}

export function toggleLiked(track) {
  if (isLiked(track.videoId)) {
    removeTrackFromPlaylist(LIKED_PLAYLIST_ID, track.videoId);
    return false;
  }
  addTrackToPlaylist(LIKED_PLAYLIST_ID, track);
  return true;
}
