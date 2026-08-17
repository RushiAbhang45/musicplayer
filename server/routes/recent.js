const express = require("express");
const { query, isDbConfigured } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

const MAX_ENTRIES = 30;

router.use((req, res, next) => {
  if (!isDbConfigured()) {
    return res.status(503).json({ error: "accounts_disabled" });
  }
  next();
});
router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT video_id AS "videoId", title, channel_id AS "channelId",
              channel_title AS "channelTitle", thumbnail, duration,
              played_at AS "playedAt"
       FROM recent_plays WHERE user_id = $1
       ORDER BY played_at DESC LIMIT $2`,
      [req.user.id, MAX_ENTRIES]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /api/recent failed:", err.message);
    res.status(500).json({ error: "request_failed", message: "Couldn't load recently played." });
  }
});

router.post("/", async (req, res) => {
  const track = req.body.track || {};
  if (!track.videoId) return res.status(400).json({ error: "invalid_track" });

  try {
    // Delete-then-insert so played_at always reflects the most recent play
    // of a track, not the first.
    await query("DELETE FROM recent_plays WHERE user_id = $1 AND video_id = $2", [
      req.user.id,
      track.videoId,
    ]);
    await query(
      `INSERT INTO recent_plays (user_id, video_id, title, channel_id, channel_title, thumbnail, duration)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        req.user.id,
        track.videoId,
        track.title || "",
        track.channelId || null,
        track.channelTitle || null,
        track.thumbnail || null,
        track.duration || null,
      ]
    );
    await query(
      `DELETE FROM recent_plays
       WHERE user_id = $1 AND id NOT IN (
         SELECT id FROM recent_plays WHERE user_id = $1 ORDER BY played_at DESC LIMIT $2
       )`,
      [req.user.id, MAX_ENTRIES]
    );
    res.status(204).end();
  } catch (err) {
    console.error("POST /api/recent failed:", err.message);
    res.status(500).json({ error: "request_failed", message: "Couldn't record that play." });
  }
});

module.exports = router;
