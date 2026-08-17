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

// Never trust client JSON straight into JSONB - re-normalize to the same
// shape the guest/localStorage store uses.
function normalizeTrack(track) {
  return {
    videoId: track.videoId,
    title: track.title,
    channelId: track.channelId || null,
    channelTitle: track.channelTitle,
    thumbnail: track.thumbnail,
    duration: track.duration || "",
    addedAt: new Date().toISOString(),
  };
}

router.get("/", async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, name, tracks, is_liked_playlist AS "isLikedPlaylist", created_at AS "createdAt"
       FROM playlists WHERE user_id = $1
       ORDER BY is_liked_playlist DESC, created_at ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /api/playlists failed:", err.message);
    res.status(500).json({ error: "request_failed", message: "Couldn't load your playlists." });
  }
});

router.post("/", async (req, res) => {
  const name = (req.body.name || "").trim() || "Untitled Playlist";
  try {
    const { rows } = await query(
      `INSERT INTO playlists (user_id, name)
       VALUES ($1, $2)
       RETURNING id, name, tracks, is_liked_playlist AS "isLikedPlaylist", created_at AS "createdAt"`,
      [req.user.id, name]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST /api/playlists failed:", err.message);
    res.status(500).json({ error: "request_failed", message: "Couldn't create the playlist." });
  }
});

router.patch("/:id", async (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "invalid_name" });
  try {
    const { rows } = await query(
      `UPDATE playlists SET name = $3, updated_at = now()
       WHERE id = $1 AND user_id = $2 AND is_liked_playlist = false
       RETURNING id, name, tracks, is_liked_playlist AS "isLikedPlaylist", created_at AS "createdAt"`,
      [req.params.id, req.user.id, name]
    );
    if (!rows[0]) return res.status(404).json({ error: "not_found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("PATCH /api/playlists/:id failed:", err.message);
    res.status(500).json({ error: "request_failed", message: "Couldn't rename the playlist." });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await query("DELETE FROM playlists WHERE id = $1 AND user_id = $2 AND is_liked_playlist = false", [
      req.params.id,
      req.user.id,
    ]);
    res.status(204).end();
  } catch (err) {
    console.error("DELETE /api/playlists/:id failed:", err.message);
    res.status(500).json({ error: "request_failed", message: "Couldn't delete the playlist." });
  }
});

// Atomic append with dedup, no read-modify-write race.
router.post("/:id/tracks", async (req, res) => {
  const track = normalizeTrack(req.body.track || {});
  if (!track.videoId) return res.status(400).json({ error: "invalid_track" });

  try {
    const { rows } = await query(
      `UPDATE playlists
       SET tracks = tracks || $3::jsonb, updated_at = now()
       WHERE id = $1 AND user_id = $2
         AND NOT EXISTS (
           SELECT 1 FROM jsonb_array_elements(tracks) t WHERE t->>'videoId' = $4
         )
       RETURNING id, name, tracks, is_liked_playlist AS "isLikedPlaylist", created_at AS "createdAt"`,
      [req.params.id, req.user.id, JSON.stringify([track]), track.videoId]
    );
    // No row back means either the playlist doesn't exist/belong to this
    // user, or the track was already in it - re-fetch to tell the two apart
    // and still return current state either way.
    const current =
      rows[0] ||
      (
        await query(
          `SELECT id, name, tracks, is_liked_playlist AS "isLikedPlaylist", created_at AS "createdAt"
           FROM playlists WHERE id = $1 AND user_id = $2`,
          [req.params.id, req.user.id]
        )
      ).rows[0];
    if (!current) return res.status(404).json({ error: "not_found" });
    res.json(current);
  } catch (err) {
    console.error("POST /api/playlists/:id/tracks failed:", err.message);
    res.status(500).json({ error: "request_failed", message: "Couldn't add that track." });
  }
});

router.delete("/:id/tracks/:videoId", async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE playlists
       SET tracks = (
         SELECT COALESCE(jsonb_agg(t), '[]'::jsonb)
         FROM jsonb_array_elements(tracks) t
         WHERE t->>'videoId' != $3
       ), updated_at = now()
       WHERE id = $1 AND user_id = $2
       RETURNING id, name, tracks, is_liked_playlist AS "isLikedPlaylist", created_at AS "createdAt"`,
      [req.params.id, req.user.id, req.params.videoId]
    );
    if (!rows[0]) return res.status(404).json({ error: "not_found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("DELETE /api/playlists/:id/tracks/:videoId failed:", err.message);
    res.status(500).json({ error: "request_failed", message: "Couldn't remove that track." });
  }
});

// One-time bulk import of a guest's localStorage playlists after they sign
// up/log in for the first time. The incoming "liked" playlist's tracks
// merge into the user's existing Liked Songs row; everything else becomes a
// new playlist.
router.post("/import", async (req, res) => {
  const incoming = Array.isArray(req.body.playlists) ? req.body.playlists : [];

  try {
    const { rows: likedRows } = await query(
      "SELECT id FROM playlists WHERE user_id = $1 AND is_liked_playlist = true",
      [req.user.id]
    );
    const likedId = likedRows[0]?.id;

    for (const playlist of incoming) {
      const tracks = Array.isArray(playlist.tracks) ? playlist.tracks.map(normalizeTrack) : [];
      if (tracks.length === 0) continue;

      if (playlist.id === "liked" && likedId) {
        for (const track of tracks) {
          await query(
            `UPDATE playlists
             SET tracks = tracks || $3::jsonb, updated_at = now()
             WHERE id = $1 AND user_id = $2
               AND NOT EXISTS (
                 SELECT 1 FROM jsonb_array_elements(tracks) t WHERE t->>'videoId' = $4
               )`,
            [likedId, req.user.id, JSON.stringify([track]), track.videoId]
          );
        }
      } else if (playlist.id !== "liked") {
        const name = (playlist.name || "").trim() || "Untitled Playlist";
        await query("INSERT INTO playlists (user_id, name, tracks) VALUES ($1, $2, $3::jsonb)", [
          req.user.id,
          name,
          JSON.stringify(tracks),
        ]);
      }
    }

    const { rows } = await query(
      `SELECT id, name, tracks, is_liked_playlist AS "isLikedPlaylist", created_at AS "createdAt"
       FROM playlists WHERE user_id = $1
       ORDER BY is_liked_playlist DESC, created_at ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error("POST /api/playlists/import failed:", err.message);
    res.status(500).json({ error: "request_failed", message: "Couldn't import your playlists." });
  }
});

module.exports = router;
