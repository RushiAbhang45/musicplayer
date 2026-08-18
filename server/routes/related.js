const express = require("express");
const { getRelatedTracks } = require("../services/cacheService");
const { sendApiError } = require("../utils/apiError");

const router = express.Router();

// GET /api/related/:videoId - "more songs like this", used to auto-continue
// playback (autoplay/radio) once a queue runs out. Optional ?categoryId=
// scopes the pool to that genre; ?exclude=id1,id2 skips tracks already in
// the caller's current queue so a session doesn't loop back over itself;
// ?channelId= is the source track's artist, used to rank same-artist
// candidates higher (capped, see relatedPool.SAME_ARTIST_CAP) without
// letting them crowd out cross-artist variety.
router.get("/:videoId", async (req, res) => {
  try {
    const categoryId = req.query.categoryId || null;
    const channelId = req.query.channelId || null;
    const excludeIds = (req.query.exclude || "").split(",").filter(Boolean);
    const tracks = await getRelatedTracks(req.params.videoId, { categoryId, excludeIds, channelId });
    res.json(tracks);
  } catch (err) {
    console.error("GET /api/related/:videoId failed:", err.message);
    sendApiError(res, err, "Failed to load related tracks");
  }
});

module.exports = router;
