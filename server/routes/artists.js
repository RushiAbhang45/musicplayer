const express = require("express");
const { getArtistTracks, getArtistInfo } = require("../services/cacheService");
const { sendApiError } = require("../utils/apiError");

const router = express.Router();

// GET /api/artists/:channelId - channel display info (name/thumbnail).
router.get("/:channelId", async (req, res) => {
  try {
    const info = await getArtistInfo(req.params.channelId);
    if (!info) return res.status(404).json({ error: "Artist not found" });
    res.json(info);
  } catch (err) {
    console.error("GET /api/artists/:channelId failed:", err.message);
    sendApiError(res, err, "Failed to load artist info");
  }
});

// GET /api/artists/:channelId/tracks - songs uploaded by this channel.
router.get("/:channelId/tracks", async (req, res) => {
  try {
    const tracks = await getArtistTracks(req.params.channelId);
    res.json(tracks);
  } catch (err) {
    console.error("GET /api/artists/:channelId/tracks failed:", err.message);
    sendApiError(res, err, "Failed to load artist tracks");
  }
});

module.exports = router;
