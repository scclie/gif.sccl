-- Migration 0001: create GIF metadata table
CREATE TABLE IF NOT EXISTS gifs (
  id TEXT PRIMARY KEY,
  discord_id TEXT,
  ip_hash TEXT NOT NULL,
  public INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  size INTEGER NOT NULL,
  delete_token TEXT NOT NULL,
  discord_url TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gifs_public ON gifs(public, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gifs_discord ON gifs(discord_id);
