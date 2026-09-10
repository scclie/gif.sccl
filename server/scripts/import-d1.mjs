import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pool } from '../db.mjs';

const dataDir = process.env.DATA_DIR || '/var/gifs';
const dumpPath = process.argv[2] || path.join(dataDir, 'import', 'gifs-d1.json');

function candidateExists(p) {
  return existsSync(path.join(dataDir, p));
}

async function main() {
  const raw = JSON.parse(await readFile(dumpPath, 'utf8'));
  const rows = raw.result?.[0]?.results || raw.results || [];
  console.log('rows in dump:', rows.length);

  let inserted = 0;
  let skipped = 0;
  for (const r of rows) {
    let filePath = r.id + '.gif';
    if (!candidateExists(filePath)) {
      const slug = path.basename(r.discord_url || '');
      if (slug && candidateExists(slug)) filePath = slug;
      else {
        console.log('skip (no file):', r.id, r.discord_url);
        skipped++;
        continue;
      }
    }
    const res = await pool.query(
      `INSERT INTO gifs (id, discord_id, public, created_at, size, delete_token, tags, file_path)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO NOTHING`,
      [r.id, r.discord_id, r.public ?? 1, r.created_at, r.size, r.delete_token, r.tags || '[]', filePath],
    );
    if (res.rowCount) inserted++;
  }
  console.log('inserted:', inserted, 'skipped:', skipped);
  const { rows: count } = await pool.query('SELECT COUNT(*) AS count FROM gifs');
  console.log('total gifs:', count[0].count);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
