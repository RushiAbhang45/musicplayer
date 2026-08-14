const express = require("express");
const categories = require("../config/categories");
const { getCategoryTracks } = require("../services/cacheService");
const { sendApiError } = require("../utils/apiError");

const router = express.Router();

// GET /api/categories - static list, no YouTube call.
router.get("/", (req, res) => {
  const list = categories.map(({ id, name, icon, gradient }) => ({
    id,
    name,
    icon,
    gradient,
  }));
  res.json(list);
});

// GET /api/categories/:id/tracks - cached curated playlist for one category.
router.get("/:id/tracks", async (req, res) => {
  try {
    const tracks = await getCategoryTracks(req.params.id);
    if (!tracks) {
      return res.status(404).json({ error: "Unknown category" });
    }
    res.json(tracks);
  } catch (err) {
    console.error("GET /api/categories/:id/tracks failed:", err.message);
    sendApiError(res, err, "Failed to load category tracks");
  }
});

module.exports = router;
