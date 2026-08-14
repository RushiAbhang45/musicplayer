import axios from "axios";

// In local dev, Vite proxies "/api" to the Express server (see vite.config.js).
// In a split deployment (frontend on Netlify, backend on Render/elsewhere),
// set VITE_API_BASE_URL at build time to the backend's full URL, e.g.
// https://musicplayer-server.onrender.com/api
const baseURL = import.meta.env.VITE_API_BASE_URL || "/api";

const api = axios.create({ baseURL });

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

export async function fetchRelatedTracks(videoId) {
  const { data } = await api.get(`/related/${videoId}`);
  return data;
}

export async function fetchArtistInfo(channelId) {
  const { data } = await api.get(`/artists/${channelId}`);
  return data;
}

export async function fetchArtistTracks(channelId) {
  const { data } = await api.get(`/artists/${channelId}/tracks`);
  return data;
}

// Turns a failed API call into a message worth showing the user - in
// particular, distinguishes "YouTube's daily quota is exhausted" (expected,
// resets on its own) from a generic failure.
export function describeApiError(err, fallback) {
  return err?.response?.data?.message || fallback;
}
