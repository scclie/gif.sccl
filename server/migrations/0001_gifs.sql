CREATE TABLE IF NOT EXISTS gifs (
  id TEXT PRIMARY KEY,
  discord_id TEXT,
  public INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  size INTEGER NOT NULL,
  delete_token TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  file_path TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gifs_public ON gifs(public, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gifs_discord ON gifs(discord_id);
