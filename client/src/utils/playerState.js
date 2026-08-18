const STORAGE_KEY = "musicplayer:playerState";

// Whether it's worth attempting the server sync at all this page session.
// PlayerContext deliberately never imports AuthContext (see its own header
// comment), so it can't just check "is the user logged in" directly - this
// mirrors utils/playlists.js's setPlaylistsAuthState pattern instead: a
// module-level flag AuthContext updates on login, that PlayerContext reads
// without a direct import. Starts true (a real login *is* possible), and
// gets reactively turned off by PlayerContext the first time a player-state
// call actually comes back 401/503 - after that it's pointless to keep
// retrying every few seconds while playing, which was spamming the console
// for guests. Login flips it back on in case syncing had backed off earlier
// in the same page session.
let serverSyncEnabled = true;

export function setPlayerStateAuthState(userId) {
  if (userId) serverSyncEnabled = true;
}

export function disableServerSync() {
  serverSyncEnabled = false;
}

export function isServerSyncEnabled() {
  return serverSyncEnabled;
}

export function getSavedPlayerState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function savePlayerState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable/full - fine to skip persisting this tick
  }
}
