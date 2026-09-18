ALTER TABLE gifs ADD COLUMN IF NOT EXISTS owner_provider TEXT;
ALTER TABLE gifs ADD COLUMN IF NOT EXISTS owner_subject TEXT;
UPDATE gifs SET owner_provider = 'discord', owner_subject = discord_id WHERE discord_id IS NOT NULL AND owner_subject IS NULL;
CREATE INDEX IF NOT EXISTS idx_gifs_owner ON gifs(owner_provider, owner_subject, created_at DESC);
