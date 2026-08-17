const express = require("express");
const bcrypt = require("bcryptjs");
const { query, isDbConfigured } = require("../db");
const { requireAuth, setAuthCookie, clearAuthCookie } = require("../middleware/requireAuth");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALT_ROUNDS = 10;

router.use((req, res, next) => {
  if (!isDbConfigured()) {
    return res.status(503).json({ error: "accounts_disabled" });
  }
  next();
});

router.post("/signup", async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "invalid_email", message: "Enter a valid email address." });
  }
  if (password.length < 8) {
    return res.status(400).json({
      error: "weak_password",
      message: "Password must be at least 8 characters.",
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email, passwordHash]
    );
    const user = rows[0];

    // Eagerly create "Liked Songs" - simpler than the client's lazy-ensure
    // pattern used for guest/localStorage playlists.
    await query(
      "INSERT INTO playlists (user_id, name, is_liked_playlist) VALUES ($1, 'Liked Songs', true)",
      [user.id]
    );

    setAuthCookie(res, user);
    res.status(201).json({ user });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "email_taken", message: "That email is already registered." });
    }
    console.error("POST /api/auth/signup failed:", err.message);
    res.status(500).json({ error: "signup_failed", message: "Couldn't create your account." });
  }
});

router.post("/login", async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";

  try {
    const { rows } = await query("SELECT id, email, password_hash FROM users WHERE email = $1", [
      email,
    ]);
    const row = rows[0];
    // Don't distinguish "no such user" from "wrong password" - avoids
    // leaking which emails are registered.
    const invalid = { error: "invalid_credentials", message: "Incorrect email or password." };
    if (!row) return res.status(401).json(invalid);

    const match = await bcrypt.compare(password, row.password_hash);
    if (!match) return res.status(401).json(invalid);

    const user = { id: row.id, email: row.email };
    setAuthCookie(res, user);
    res.json({ user });
  } catch (err) {
    console.error("POST /api/auth/login failed:", err.message);
    res.status(500).json({ error: "login_failed", message: "Couldn't log you in." });
  }
});

router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
