const { Pool } = require("pg");

// Accounts are a progressive enhancement, not a hard requirement - the app
// must stay fully usable (guest-only, localStorage-backed) if DATABASE_URL
// is never set, same as it works today. Neon/Supabase (and most managed
// Postgres) require SSL; rejectUnauthorized:false is the pragmatic default
// for their managed certs without vendoring a CA bundle.
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

function isDbConfigured() {
  return pool !== null;
}

async function query(text, params) {
  return pool.query(text, params);
}

async function runMigrations() {
  if (!isDbConfigured()) {
    console.log("[startup] DATABASE_URL not set - accounts disabled, running in guest-only mode");
    return;
  }

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS playlists (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      tracks JSONB NOT NULL DEFAULT '[]',
      is_liked_playlist BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS recent_plays (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      video_id TEXT NOT NULL,
      title TEXT NOT NULL,
      channel_id TEXT,
      channel_title TEXT,
      thumbnail TEXT,
      duration TEXT,
      played_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS recent_plays_user_played_idx
      ON recent_plays(user_id, played_at DESC);
  `);

  console.log("[startup] database migrations up to date - accounts enabled");
}

module.exports = { query, isDbConfigured, runMigrations };
