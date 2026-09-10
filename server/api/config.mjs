import { json } from '../server.mjs';

export function apiConfig(ctx) {
  const { res, env } = ctx;
  json(res, { turnstileSiteKey: env.TURNSTILE_SITE_KEY || null });
}
