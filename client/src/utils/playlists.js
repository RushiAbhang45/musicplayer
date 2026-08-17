import {
  addTrackToServerPlaylist,
  createServerPlaylist,
  deleteServerPlaylist,
  fetchServerPlaylists,
  importServerPlaylists,
  removeTrackFromServerPlaylist,
  renameServerPlaylist,
} from "../services/api.js";

const STORAGE_KEY = "musicplayer:playlists";
const OLD_LIBRARY_KEY = "musicplayer:library";
const IMPORT_PROMPTED_KEY = "musicplayer:importPrompted";
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

// Lets components (TrackCard, PlayerBar, etc.) stay in sync when a track's
// liked/playlist status changes somewhere else on the page - e.g. liking a
// track from the player bar should update that same track's heart icon on
// its TrackCard elsewhere on screen, not just in the backing store. Shared
// by both guest (localStorage) and account (server) modes below.
const listeners = new Set();

export function subscribeToPlaylistChanges(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn());
}

// ---------------------------------------------------------------------
// Guest mode: plain localStorage, unchanged from before accounts existed.
// ---------------------------------------------------------------------

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
  notify();
}

// One-time migration from the old flat "My Library" favorites list into the
// new "Liked Songs" playlist, plus lazily ensuring Liked Songs always exists.
function loadGuestPlaylists() {
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

// ---------------------------------------------------------------------
// Account mode: server-backed, with an optimistic in-memory mirror so every
// existing call site (which expects createPlaylist/addTrackToPlaylist/etc
// to "just work" synchronously) keeps working unmodified.
// ---------------------------------------------------------------------

let mode = "guest"; // "guest" | "account"
let cachedPlaylists = null; // null = "not yet loaded from server", [] = "loaded, empty"
let likedServerId = null; // the current account's real DB id for its Liked Songs row

// Freshly-created playlists get a temporary client-side id immediately (so
// callers that create-then-mutate in the same tick, like AddToPlaylistMenu,
// keep working) while the real POST /api/playlists is in flight.
// pendingCreates resolves to the real id once the server responds;
// tempIdToRealId is consulted afterwards too, so any stale closure still
// holding the old temp id (e.g. a rollback handler) resolves to the same
// row instead of silently matching nothing.
const pendingCreates = new Map();
const tempIdToRealId = new Map();

function toClientShape(row) {
  if (row.isLikedPlaylist) {
    likedServerId = row.id;
    return { id: LIKED_PLAYLIST_ID, name: row.name, tracks: row.tracks || [], createdAt: row.createdAt };
  }
  return { id: String(row.id), name: row.name, tracks: row.tracks || [], createdAt: row.createdAt };
}

// Client-facing id (as stored in cachedPlaylists) after resolving any
// temp id that has since been confirmed by the server.
function resolveClientId(id) {
  return tempIdToRealId.get(id) || id;
}

// The id to actually send to the API for a given client-facing id.
function toNetworkId(id) {
  const resolved = resolveClientId(id);
  return resolved === LIKED_PLAYLIST_ID ? likedServerId : resolved;
}

function mutateCached(id, updater) {
  const target = resolveClientId(id);
  cachedPlaylists = (cachedPlaylists || []).map((p) => (p.id === target ? updater(p) : p));
}

export function setPlaylistsAuthState(userId) {
  mode = userId ? "account" : "guest";
  cachedPlaylists = null;
  likedServerId = null;
  pendingCreates.clear();
  tempIdToRealId.clear();
  if (mode === "account") {
    refreshPlaylists();
  } else {
    notify();
  }
}

export async function refreshPlaylists() {
  if (mode !== "account") return;
  try {
    const rows = await fetchServerPlaylists();
    cachedPlaylists = rows.map(toClientShape);
  } catch (err) {
    console.warn("[playlists] failed to load account playlists:", err.message);
    cachedPlaylists = cachedPlaylists || [];
  }
  notify();
}

export function isPlaylistsLoading() {
  return mode === "account" && cachedPlaylists === null;
}

// ---------------------------------------------------------------------
// Public API - identical exports/shapes in both modes.
// ---------------------------------------------------------------------

export function getPlaylists() {
  if (mode === "account") return cachedPlaylists || [];
  return loadGuestPlaylists();
}

export function getPlaylist(id) {
  return getPlaylists().find((p) => p.id === id) || null;
}

export function createPlaylist(name) {
  const trimmedName = name.trim() || "Untitled Playlist";

  if (mode !== "account") {
    const playlists = loadGuestPlaylists();
    const playlist = { id: makeId(), name: trimmedName, createdAt: new Date().toISOString(), tracks: [] };
    writeRaw([...playlists, playlist]);
    return playlist;
  }

  const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const playlist = { id: tempId, name: trimmedName, createdAt: new Date().toISOString(), tracks: [] };
  cachedPlaylists = [...(cachedPlaylists || []), playlist];
  notify();

  const creation = createServerPlaylist(trimmedName)
    .then((row) => {
      const realId = String(row.id);
      tempIdToRealId.set(tempId, realId);
      cachedPlaylists = (cachedPlaylists || []).map((p) =>
        p.id === tempId ? { ...p, id: realId, createdAt: row.createdAt } : p
      );
      pendingCreates.delete(tempId);
      notify();
      return realId;
    })
    .catch((err) => {
      cachedPlaylists = (cachedPlaylists || []).filter((p) => p.id !== tempId);
      pendingCreates.delete(tempId);
      notify();
      throw err;
    });
  pendingCreates.set(tempId, creation);

  return playlist;
}

export function renamePlaylist(id, name) {
  if (id === LIKED_PLAYLIST_ID) return;
  const trimmedName = name.trim();
  if (!trimmedName) return;

  if (mode !== "account") {
    const playlists = loadGuestPlaylists().map((p) => (p.id === id ? { ...p, name: trimmedName } : p));
    writeRaw(playlists);
    return;
  }

  mutateCached(id, (p) => ({ ...p, name: trimmedName }));
  notify();

  const run = (networkId) =>
    renameServerPlaylist(networkId, trimmedName).catch(() => {
      /* fire-and-forget, matches existing no-error-surfaced contract */
    });
  const pending = pendingCreates.get(id);
  if (pending) pending.then(run).catch(() => {});
  else run(toNetworkId(id));
}

export function deletePlaylist(id) {
  if (id === LIKED_PLAYLIST_ID) return;

  if (mode !== "account") {
    writeRaw(loadGuestPlaylists().filter((p) => p.id !== id));
    return;
  }

  const target = resolveClientId(id);
  cachedPlaylists = (cachedPlaylists || []).filter((p) => p.id !== target);
  notify();

  const run = (networkId) => deleteServerPlaylist(networkId).catch(() => {});
  const pending = pendingCreates.get(id);
  if (pending) pending.then(run).catch(() => {});
  else run(toNetworkId(id));
}

export function isTrackInPlaylist(id, videoId) {
  const playlist = getPlaylist(id);
  return !!playlist && playlist.tracks.some((t) => t.videoId === videoId);
}

export function addTrackToPlaylist(id, track) {
  if (isTrackInPlaylist(id, track.videoId)) return;

  if (mode !== "account") {
    const playlists = loadGuestPlaylists().map((p) => {
      if (p.id !== id) return p;
      if (p.tracks.some((t) => t.videoId === track.videoId)) return p;
      return { ...p, tracks: [...p.tracks, normalizeTrack(track)] };
    });
    writeRaw(playlists);
    return;
  }

  mutateCached(id, (p) => ({ ...p, tracks: [...p.tracks, normalizeTrack(track)] }));
  notify();

  const rollback = () => {
    mutateCached(id, (p) => ({ ...p, tracks: p.tracks.filter((t) => t.videoId !== track.videoId) }));
    notify();
  };
  const run = (networkId) => addTrackToServerPlaylist(networkId, track).catch(rollback);
  const pending = pendingCreates.get(id);
  if (pending) pending.then(run).catch(rollback);
  else run(toNetworkId(id));
}

export function removeTrackFromPlaylist(id, videoId) {
  if (mode !== "account") {
    const playlists = loadGuestPlaylists().map((p) =>
      p.id === id ? { ...p, tracks: p.tracks.filter((t) => t.videoId !== videoId) } : p
    );
    writeRaw(playlists);
    return;
  }

  const removed = getPlaylist(id)?.tracks.find((t) => t.videoId === videoId);
  mutateCached(id, (p) => ({ ...p, tracks: p.tracks.filter((t) => t.videoId !== videoId) }));
  notify();

  const rollback = () => {
    if (!removed) return;
    mutateCached(id, (p) =>
      p.tracks.some((t) => t.videoId === videoId) ? p : { ...p, tracks: [...p.tracks, removed] }
    );
    notify();
  };
  const run = (networkId) => removeTrackFromServerPlaylist(networkId, videoId).catch(rollback);
  const pending = pendingCreates.get(id);
  if (pending) pending.then(run).catch(rollback);
  else run(toNetworkId(id));
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

// ---------------------------------------------------------------------
// Local -> account migration prompt support (see ImportPlaylistsPrompt).
// ---------------------------------------------------------------------

export function hasImportableLocalData() {
  const raw = readRaw();
  if (!raw) return false;
  return raw.some((p) => (p.id === LIKED_PLAYLIST_ID ? p.tracks.length > 0 : true));
}

export function hasBeenPromptedForImport() {
  return localStorage.getItem(IMPORT_PROMPTED_KEY) === "1";
}

export function markImportPrompted() {
  localStorage.setItem(IMPORT_PROMPTED_KEY, "1");
}

export async function importLocalPlaylistsToAccount() {
  const local = readRaw() || [];
  await importServerPlaylists(local);
  await refreshPlaylists();
}
