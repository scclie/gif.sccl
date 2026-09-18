import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { pool } from '../db.mjs';
import { parseCookies } from '../lib/session.mjs';
import { json, respond, redirect, htmlPage } from '../server.mjs';
import { inc } from '../metrics.mjs';

function envFor(env) {
  return {
    clientId: env.DISCORD_CLIENT_ID,
    clientSecret: env.DISCORD_CLIENT_SECRET,
    redirectUri: env.DISCORD_REDIRECT_URI || 'https://gif.sccl.cc/api/auth/callback',
  };
}

function kanidmFor(env) {
  return {
    issuer: env.KANIDM_ISSUER,
    clientId: env.KANIDM_CLIENT_ID,
    clientSecret: env.KANIDM_CLIENT_SECRET,
    redirectUri: env.KANIDM_REDIRECT_URI || 'https://gif.sccl.cc/api/auth/kanidm/callback',
    adminGroup: env.KANIDM_ADMIN_GROUP || 'gif_admins',
  };
}

const _oidcCache = { issuer: null, doc: null, at: 0 };
async function oidcDoc(issuer) {
  if (_oidcCache.issuer === issuer && Date.now() - _oidcCache.at < 3600000) return _oidcCache.doc;
  const resp = await fetch(issuer.replace(/\/$/, '') + '/.well-known/openid-configuration');
  if (!resp.ok) throw new Error('OIDC discovery failed: ' + resp.status);
  const doc = await resp.json();
  _oidcCache.issuer = issuer;
  _oidcCache.doc = doc;
  _oidcCache.at = Date.now();
  return doc;
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function newSession(user, admin) {
  return {
    provider: user.provider,
    subject: user.subject,
    discord_id: user.discord_id,
    username: user.username,
    email: user.email || null,
    avatar: user.avatar || null,
    admin: !!admin,
    created_at: new Date().toISOString(),
  };
}

async function storeSession(res, session, clearCookies = []) {
  const sessId = randomUUID();
  await pool.query('INSERT INTO sessions (id, payload, expires_at) VALUES ($1, $2, $3)', [
    sessId,
    JSON.stringify(session),
    Date.now() + 604800000,
  ]);
  respond(res, 302, '', {
    Location: '/',
    'Set-Cookie': [
      'gif_session=' + sessId + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800',
      ...clearCookies,
    ],
  });
}

export const apiAuth = {
  async discord(ctx) {
    const { clientId } = envFor(ctx.env);
    if (!clientId) return respond(ctx.res, 500, 'Discord OAuth not configured', { 'Content-Type': 'text/plain' });
    const url =
      'https://discord.com/api/oauth2/authorize' +
      '?client_id=' + clientId +
      '&redirect_uri=' + encodeURIComponent(envFor(ctx.env).redirectUri) +
      '&response_type=code&scope=identify';
    redirect(ctx.res, url);
  },

  async kanidm(ctx) {
    const { res, env } = ctx;
    const k = kanidmFor(env);
    if (!k.issuer || !k.clientId || !k.clientSecret) {
      return respond(ctx.res, 500, 'Kanidm OAuth not configured', { 'Content-Type': 'text/plain' });
    }
    try {
      const doc = await oidcDoc(k.issuer);
      const state = b64url(randomBytes(16));
      const verifier = b64url(randomBytes(32));
      const challenge = b64url(createHash('sha256').update(verifier).digest());
      const cookie = b64url(JSON.stringify({ state, verifier }));
      const url =
        doc.authorization_endpoint +
        '?response_type=code' +
        '&client_id=' + encodeURIComponent(k.clientId) +
        '&redirect_uri=' + encodeURIComponent(k.redirectUri) +
        '&scope=' + encodeURIComponent('openid profile email groups') +
        '&state=' + encodeURIComponent(state) +
        '&code_challenge=' + encodeURIComponent(challenge) +
        '&code_challenge_method=S256';
      respond(res, 302, '', {
        Location: url,
        'Set-Cookie': 'gif_oauth=' + cookie + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600',
      });
    } catch (err) {
      inc('gif_errors_total', { type: 'auth' });
      return htmlPage(res, 'Auth error: ' + err.message, '/login');
    }
  },

  async kanidmCallback(ctx) {
    const { req, res, env, url } = ctx;
    const k = kanidmFor(env);
    if (!k.issuer || !k.clientId || !k.clientSecret) return htmlPage(res, 'Kanidm OAuth not configured', '/login');

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const cookies = parseCookies(req);
    let saved = null;
    try { saved = JSON.parse(Buffer.from(cookies.gif_oauth || '', 'base64url').toString('utf8')); } catch {}
    const clearCookie = 'gif_oauth=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
    if (!code || !saved || !state || saved.state !== state) {
      return respond(res, 302, '', { Location: '/login?error=state', 'Set-Cookie': clearCookie });
    }

    try {
      const doc = await oidcDoc(k.issuer);
      const tokenResp = await fetch(doc.token_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: k.redirectUri,
          client_id: k.clientId,
          client_secret: k.clientSecret,
          code_verifier: saved.verifier,
        }),
      });
      if (!tokenResp.ok) return htmlPage(res, 'Kanidm token exchange failed', '/login');
      const tokenData = await tokenResp.json();

      const userResp = await fetch(doc.userinfo_endpoint, {
        headers: { Authorization: 'Bearer ' + tokenData.access_token },
      });
      if (!userResp.ok) return htmlPage(res, 'Kanidm userinfo failed', '/login');
      const info = await userResp.json();

      const subject = info.sub;
      const groups = Array.isArray(info.groups) ? info.groups : [];
      const { rows: firstAdmin } = await pool.query('SELECT 1 FROM admins LIMIT 1');
      const { rows: firstOidcAdmin } = await pool.query('SELECT 1 FROM oidc_admins LIMIT 1');
      const isFirstLogin = firstAdmin.length === 0 && firstOidcAdmin.length === 0;
      // kanidm may report groups as bare names or as spn ("name@domain")
      const isGroupAdmin = groups.some(
        (g) => g === k.adminGroup || g.startsWith(k.adminGroup + '@'),
      );
      if (isGroupAdmin) {
        await pool.query('INSERT INTO oidc_admins (subject, created_at) VALUES ($1, $2) ON CONFLICT DO NOTHING', [subject, new Date().toISOString()]);
      }
      const { rows: memberRows } = await pool.query('SELECT 1 FROM oidc_admins WHERE subject = $1', [subject]);
      const admin = isFirstLogin || isGroupAdmin || memberRows.length > 0;

      await storeSession(res, newSession({
        provider: 'kanidm',
        subject,
        username: info.preferred_username || info.name || subject,
        email: info.email,
      }, admin), [clearCookie]);
    } catch (err) {
      inc('gif_errors_total', { type: 'auth' });
      return htmlPage(res, 'Auth error: ' + err.message, '/login');
    }
  },

  async callback(ctx) {
    const { req, res, env } = ctx;
    const code = ctx.url.searchParams.get('code');
    if (!code) return redirect(res, '/');
    const { clientId, clientSecret, redirectUri } = envFor(env);
    if (!clientId || !clientSecret) return htmlPage(res, 'Discord secrets not configured');

    try {
      const tokenResp = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
      });
      if (!tokenResp.ok) return htmlPage(res, 'Discord token exchange failed');
      const tokenData = await tokenResp.json();

      const userResp = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: 'Bearer ' + tokenData.access_token },
      });
      if (!userResp.ok) return htmlPage(res, 'Discord user fetch failed');
      const userData = await userResp.json();

      const { rows: firstAdmin } = await pool.query('SELECT 1 FROM admins LIMIT 1');
      const isFirstLogin = firstAdmin.length === 0;
      if (isFirstLogin) {
        await pool.query('INSERT INTO admins (discord_id, created_at) VALUES ($1, $2)', [userData.id, new Date().toISOString()]);
      }
      const { rows: memberRows } = await pool.query('SELECT 1 FROM admins WHERE discord_id = $1', [userData.id]);
      const sessId = randomUUID();
      const session = {
        provider: 'discord',
        subject: userData.id,
        discord_id: userData.id,
        username: userData.global_name || userData.username,
        avatar: userData.avatar,
        admin: isFirstLogin || memberRows.length > 0,
        created_at: new Date().toISOString(),
      };

      await pool.query('INSERT INTO sessions (id, payload, expires_at) VALUES ($1, $2, $3)', [
        sessId,
        JSON.stringify(session),
        Date.now() + 604800000,
      ]);

      respond(res, 302, '', {
        Location: '/',
        'Set-Cookie': 'gif_session=' + sessId + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800',
      });
    } catch (err) {
      inc('gif_errors_total', { type: 'auth' });
      return htmlPage(res, 'Auth error: ' + err.message);
    }
  },

  async logout(ctx) {
    const { req, res } = ctx;
    const cookies = parseCookies(req);
    if (cookies.gif_session) {
      await pool.query('DELETE FROM sessions WHERE id = $1', [cookies.gif_session]).catch(() => {});
    }
    respond(res, 200, JSON.stringify({ ok: true }), {
      'Content-Type': 'application/json',
      'Set-Cookie': 'gif_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
    });
  },

  async me(ctx) {
    const { res, user, admin } = ctx;
    if (user) return json(res, { user, admin: !!admin });
    return json(res, { user: null, admin: false });
  },
};
