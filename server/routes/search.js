const express = require("express");
const { getSearchResults } = require("../services/cacheService");
const { sendApiError } = require("../utils/apiError");

const router = express.Router();

// GET /api/search?q=... - free-text search across all of YouTube
// (not restricted to any genre/language/category).
router.get("/", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) {
    return res.status(400).json({ error: "Missing query parameter 'q'" });
  }

  try {
    const tracks = await getSearchResults(q);
    const limit = Number(req.query.limit);
    res.json(limit > 0 ? tracks.slice(0, limit) : tracks);
  } catch (err) {
    console.error("GET /api/search failed:", err.message);
    sendApiError(res, err, "Search failed");
  }
});

module.exports = router;
