const express = require("express");
const { query, isDbConfigured } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

router.use((req, res, next) => {
  if (!isDbConfigured()) {
    return res.status(503).json({ error: "accounts_disabled" });
  }
  next();
});
router.use(requireAuth);

// GET /api/player-state - the signed-in user's saved queue/track/position,
// used to restore playback across a refresh or a new device. Returns null
// if nothing's been saved yet (new account, or never played anything).
router.get("/", async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT queue, current_index AS "currentIndex", position_seconds AS "currentTime",
              volume, autoplay
       FROM player_state WHERE user_id = $1`,
      [req.user.id]
    );
    res.json(rows[0] || null);
  } catch (err) {
    console.error("GET /api/player-state failed:", err.message);
    res.status(500).json({ error: "request_failed", message: "Couldn't load saved playback state." });
  }
});

// PUT /api/player-state - upserts the whole state as one row per user
// (single atomic statement, no read-modify-write) since this gets called
// repeatedly during a listening session.
router.put("/", async (req, res) => {
  const { queue, currentIndex, currentTime, volume, autoplay } = req.body || {};
  if (!Array.isArray(queue) || typeof currentIndex !== "number") {
    return res.status(400).json({ error: "invalid_state" });
  }

  try {
    await query(
      `INSERT INTO player_state (user_id, queue, current_index, position_seconds, volume, autoplay, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (user_id) DO UPDATE SET
         queue = EXCLUDED.queue,
         current_index = EXCLUDED.current_index,
         position_seconds = EXCLUDED.position_seconds,
         volume = EXCLUDED.volume,
         autoplay = EXCLUDED.autoplay,
         updated_at = now()`,
      [req.user.id, JSON.stringify(queue), currentIndex, currentTime || 0, volume ?? 80, autoplay !== false]
    );
    res.status(204).end();
  } catch (err) {
    console.error("PUT /api/player-state failed:", err.message);
    res.status(500).json({ error: "request_failed", message: "Couldn't save playback state." });
  }
});

module.exports = router;
