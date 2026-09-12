ALTER TABLE gifs ADD COLUMN IF NOT EXISTS slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_gifs_slug ON gifs(slug);
UPDATE gifs SET slug = '043cedc7-сталкрафт-stalcraft' WHERE id = '043cedc7-886e-4ab2-b596-badc6e858bfb' AND slug IS NULL;