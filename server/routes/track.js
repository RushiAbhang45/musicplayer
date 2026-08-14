const express = require("express");
const { getTrackInfo } = require("../services/cacheService");
const { sendApiError } = require("../utils/apiError");

const router = express.Router();

// GET /api/track/:videoId - full track info for a single video, used to
// resolve shareable /track/:videoId links (no search context available).
router.get("/:videoId", async (req, res) => {
  try {
    const track = await getTrackInfo(req.params.videoId);
    if (!track) return res.status(404).json({ error: "Track not found" });
    res.json(track);
  } catch (err) {
    console.error("GET /api/track/:videoId failed:", err.message);
    sendApiError(res, err, "Failed to load track");
  }
});

module.exports = router;
