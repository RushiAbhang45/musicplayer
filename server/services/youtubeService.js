const axios = require("axios");
const { parseDuration } = require("../utils/parseDuration");
const { decodeEntities } = require("../utils/decodeEntities");

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const MUSIC_CATEGORY_ID = "10";

function getApiKey() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new Error(
      "Missing YOUTUBE_API_KEY - copy server/.env.example to server/.env and add your key"
    );
  }
  return key;
}

// Enriches a list of video IDs with real durations via videos.list
// (part=contentDetails). Costs only 1 quota unit for up to 50 IDs.
async function fetchDurations(videoIds) {
  if (videoIds.length === 0) return {};

  const { data } = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
    params: {
      key: getApiKey(),
      part: "contentDetails",
      id: videoIds.join(","),
    },
  });

  const durations = {};
  for (const item of data.items || []) {
    durations[item.id] = parseDuration(item.contentDetails?.duration);
  }
  return durations;
}

function normalizeSearchItem(item) {
  return {
    videoId: item.id.videoId,
    title: decodeEntities(item.snippet.title),
    channelId: item.snippet.channelId,
    channelTitle: decodeEntities(item.snippet.channelTitle),
    thumbnail:
      item.snippet.thumbnails?.high?.url ||
      item.snippet.thumbnails?.medium?.url ||
      item.snippet.thumbnails?.default?.url ||
      "",
    duration: "",
  };
}

// Searches YouTube for videos matching `query` and/or scoped to a channel.
// `musicOnly` restricts results to the Music category (used for curated
// category playlists and artist/related lookups); free-text user search
// omits it so any genre or language can be found.
async function searchVideos(
  query,
  { maxResults = 12, musicOnly = false, channelId = null, order = null } = {}
) {
  const params = {
    key: getApiKey(),
    part: "snippet",
    type: "video",
    maxResults,
    safeSearch: "moderate",
    videoEmbeddable: "true",
  };
  if (query) params.q = query;
  if (musicOnly) params.videoCategoryId = MUSIC_CATEGORY_ID;
  if (channelId) params.channelId = channelId;
  if (order) params.order = order;

  const { data } = await axios.get(`${YOUTUBE_API_BASE}/search`, { params });
  const tracks = (data.items || [])
    .filter((item) => item.id && item.id.videoId)
    .map(normalizeSearchItem);

  const durations = await fetchDurations(tracks.map((t) => t.videoId));
  return tracks.map((t) => ({ ...t, duration: durations[t.videoId] || t.duration }));
}

// Looks up a single video's metadata (title/channel/tags) - used to derive
// an "artist" for the related-songs heuristic. Costs 1 quota unit.
async function getVideoDetails(videoId) {
  const { data } = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
    params: {
      key: getApiKey(),
      part: "snippet",
      id: videoId,
    },
  });

  const item = data.items?.[0];
  if (!item) return null;

  return {
    videoId,
    title: decodeEntities(item.snippet.title),
    channelId: item.snippet.channelId,
    channelTitle: decodeEntities(item.snippet.channelTitle),
    tags: item.snippet.tags || [],
    categoryId: item.snippet.categoryId,
  };
}

// Looks up a single video as a full normalized track (title/channel/
// thumbnail/duration) - used for shareable /track/:videoId links, where we
// only have a videoId and need everything needed to render a TrackCard and
// start playback. Costs 1 quota unit (snippet + contentDetails in one call).
async function getTrackById(videoId) {
  const { data } = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
    params: {
      key: getApiKey(),
      part: "snippet,contentDetails",
      id: videoId,
    },
  });

  const item = data.items?.[0];
  if (!item) return null;

  return {
    videoId,
    title: decodeEntities(item.snippet.title),
    channelId: item.snippet.channelId,
    channelTitle: decodeEntities(item.snippet.channelTitle),
    thumbnail:
      item.snippet.thumbnails?.high?.url ||
      item.snippet.thumbnails?.medium?.url ||
      item.snippet.thumbnails?.default?.url ||
      "",
    duration: parseDuration(item.contentDetails?.duration),
  };
}

// Looks up a channel's display info (used for the artist page header).
// Costs 1 quota unit.
async function getChannelInfo(channelId) {
  const { data } = await axios.get(`${YOUTUBE_API_BASE}/channels`, {
    params: {
      key: getApiKey(),
      part: "snippet",
      id: channelId,
    },
  });

  const item = data.items?.[0];
  if (!item) return null;

  return {
    channelId,
    title: decodeEntities(item.snippet.title),
    thumbnail:
      item.snippet.thumbnails?.high?.url ||
      item.snippet.thumbnails?.medium?.url ||
      item.snippet.thumbnails?.default?.url ||
      "",
    description: item.snippet.description || "",
  };
}

module.exports = { searchVideos, getVideoDetails, getTrackById, getChannelInfo };
