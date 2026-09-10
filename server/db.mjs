import pg from 'pg';
const { Pool } = pg;
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

function splitStatements(sql) {
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length && !s.startsWith('--'));
}

export async function migrate() {
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    for (const stmt of splitStatements(sql)) {
      await pool.query(stmt);
    }
  }
}
