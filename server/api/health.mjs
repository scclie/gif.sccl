import { pool } from '../db.mjs';
import { json } from '../server.mjs';

export async function apiHealth(ctx) {
  try {
    await pool.query('SELECT 1');
    return json(ctx.res, { ok: true });
  } catch {
    return json(ctx.res, { error: 'database unavailable' }, 503);
  }
}