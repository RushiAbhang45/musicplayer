const express = require("express");
const { getTrending } = require("../services/cacheService");
const { sendApiError } = require("../utils/apiError");

const router = express.Router();

// GET /api/trending - YouTube's mostPopular music chart for TRENDING_REGION.
router.get("/", async (req, res) => {
  try {
    const tracks = await getTrending();
    res.json(tracks);
  } catch (err) {
    console.error("GET /api/trending failed:", err.message);
    sendApiError(res, err, "Failed to load trending tracks");
  }
});

module.exports = router;
