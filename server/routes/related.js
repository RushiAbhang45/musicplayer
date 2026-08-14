const express = require("express");
const { getRelatedTracks } = require("../services/cacheService");
const { sendApiError } = require("../utils/apiError");

const router = express.Router();

// GET /api/related/:videoId - "more songs like this", used to auto-continue
// playback (autoplay/radio) once a queue runs out.
router.get("/:videoId", async (req, res) => {
  try {
    const tracks = await getRelatedTracks(req.params.videoId);
    res.json(tracks);
  } catch (err) {
    console.error("GET /api/related/:videoId failed:", err.message);
    sendApiError(res, err, "Failed to load related tracks");
  }
});

module.exports = router;
