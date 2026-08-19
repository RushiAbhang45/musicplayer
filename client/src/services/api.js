import axios from "axios";

// In local dev, Vite proxies "/api" to the Express server (see vite.config.js).
// In a split deployment (frontend on Netlify, backend on Render/elsewhere),
// set VITE_API_BASE_URL at build time to the backend's full URL, e.g.
// https://musicplayer-server.onrender.com/api
const baseURL = import.meta.env.VITE_API_BASE_URL || "/api";

// withCredentials is required so the auth cookie (see server/middleware/
// requireAuth.js) is sent/received - harmless for guests, the cookie simply
// won't exist yet.
const api = axios.create({ baseURL, withCredentials: true });

export async function fetchCategories() {
  const { data } = await api.get("/categories");
  return data;
}

export async function fetchCategoryTracks(categoryId) {
  const { data } = await api.get(`/categories/${categoryId}/tracks`);
  return data;
}

export async function searchTracks(query, limit) {
  const { data } = await api.get("/search", { params: { q: query, limit } });
  return data;
}

export async function fetchRelatedTracks(
  videoId,
  { categoryId, channelId, title, channelTitle, excludeIds } = {}
) {
  const { data } = await api.get(`/related/${videoId}`, {
    params: {
      categoryId: categoryId || undefined,
      channelId: channelId || undefined,
      title: title || undefined,
      channelTitle: channelTitle || undefined,
      exclude: excludeIds?.length ? excludeIds.join(",") : undefined,
    },
  });
  return data;
}

export async function fetchTrending() {
  const { data } = await api.get("/trending");
  return data;
}

// --- Accounts (optional - see AuthContext.jsx; a 503 accounts_disabled
// means the deployment has no DATABASE_URL configured) ---

export async function signup(email, password) {
  const { data } = await api.post("/auth/signup", { email, password });
  return data;
}

export async function login(email, password) {
  const { data } = await api.post("/auth/login", { email, password });
  return data;
}

export async function logout() {
  await api.post("/auth/logout");
}

export async function fetchMe() {
  const { data } = await api.get("/auth/me");
  return data;
}

// --- Server-backed playlists (account mode only - see utils/playlists.js) ---

export async function fetchServerPlaylists() {
  const { data } = await api.get("/playlists");
  return data;
}

export async function createServerPlaylist(name) {
  const { data } = await api.post("/playlists", { name });
  return data;
}

export async function renameServerPlaylist(id, name) {
  const { data } = await api.patch(`/playlists/${id}`, { name });
  return data;
}

export async function deleteServerPlaylist(id) {
  await api.delete(`/playlists/${id}`);
}

export async function addTrackToServerPlaylist(id, track) {
  const { data } = await api.post(`/playlists/${id}/tracks`, { track });
  return data;
}

export async function removeTrackFromServerPlaylist(id, videoId) {
  const { data } = await api.delete(`/playlists/${id}/tracks/${videoId}`);
  return data;
}

export async function importServerPlaylists(playlists) {
  const { data } = await api.post("/playlists/import", { playlists });
  return data;
}

// --- Server-backed recently played (account mode only) ---

export async function recordServerPlay(track) {
  await api.post("/recent", { track });
}

export async function fetchServerRecentPlays() {
  const { data } = await api.get("/recent");
  return data;
}

export async function fetchServerPlayerState() {
  const { data } = await api.get("/player-state");
  return data;
}

export async function saveServerPlayerState(state) {
  await api.put("/player-state", state);
}

export async function fetchArtistInfo(channelId) {
  const { data } = await api.get(`/artists/${channelId}`);
  return data;
}

export async function fetchArtistTracks(channelId) {
  const { data } = await api.get(`/artists/${channelId}/tracks`);
  return data;
}

export async function fetchPopularArtists() {
  const { data } = await api.get("/artists/popular");
  return data;
}

export async function fetchTrackInfo(videoId) {
  const { data } = await api.get(`/track/${videoId}`);
  return data;
}

// Turns a failed API call into a message worth showing the user - in
// particular, distinguishes "YouTube's daily quota is exhausted" (expected,
// resets on its own) from a generic failure.
export function describeApiError(err, fallback) {
  return err?.response?.data?.message || fallback;
}
