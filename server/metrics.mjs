import { pool } from './db.mjs';

const counters = {};
const defs = {
  gif_http_requests_total: { type: 'counter', help: 'HTTP requests to API endpoints by route/method/status' },
  gif_uploads_total: { type: 'counter', help: 'Successful uploads by format and anon flag' },
  gif_uploads_bytes_total: { type: 'counter', help: 'Cumulative bytes uploaded by format' },
  gif_delete_total: { type: 'counter', help: 'Successful deletes' },
  gif_errors_total: { type: 'counter', help: 'Errors by type' },
  gif_gifs_total: { type: 'gauge', help: 'Gifs in DB by format and visibility' },
  gif_users_active: { type: 'gauge', help: 'Active users (distinct discord_id in live sessions)' },
};

function escLabel(v) {
  return String(v).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

function keyOf(labels) {
  return Object.keys(labels).sort().map((k) => k + '=' + escLabel(labels[k])).join(',');
}

function inc(name, labels, amount = 1) {
  const key = keyOf(labels || {});
  if (!counters[name]) counters[name] = {};
  if (!counters[name][key]) counters[name][key] = { labels: { ...(labels || {}) }, value: 0 };
  counters[name][key].value += amount;
}

function resetForTest() {
  for (const k of Object.keys(counters)) delete counters[k];
}

function sampleLabels(labels) {
  return Object.keys(labels).sort().map((k) => k + '="' + escLabel(labels[k]) + '"').join(',');
}

function formatSamples() {
  const lines = [];
  for (const name of Object.keys(defs)) {
    if (!counters[name]) continue;
    lines.push('# HELP ' + name + ' ' + defs[name].help);
    lines.push('# TYPE ' + name + ' ' + defs[name].type);
    for (const key of Object.keys(counters[name])) {
      const s = counters[name][key];
      const lbl = sampleLabels(s.labels);
      lines.push(name + (lbl ? '{' + lbl + '}' : '') + ' ' + s.value);
    }
  }
  return lines;
}

async function collectGauges() {
  const gauges = [];
  const { rows } = await pool.query(
    `SELECT
       split_part(file_path, '.', 2) AS format,
       CASE WHEN public = 1 THEN 'public' ELSE 'private' END AS vis,
       COUNT(*)::int AS count
     FROM gifs
     GROUP BY split_part(file_path, '.', 2),
       CASE WHEN public = 1 THEN 'public' ELSE 'private' END`,
  );
  for (const r of rows) gauges.push({ name: 'gif_gifs_total', labels: { format: r.format, vis: r.vis }, value: r.count });
  const { rows: srows } = await pool.query(`SELECT payload FROM sessions WHERE expires_at > $1`, [Date.now()]);
  const distinct = new Set();
  for (const r of srows) { try { const p = JSON.parse(r.payload); if (p && p.discord_id) distinct.add(p.discord_id); } catch {} }
  gauges.push({ name: 'gif_users_active', labels: {}, value: distinct.size });
  return gauges;
}

async function renderMetrics() {
  const lines = formatSamples();
  try {
    const gauges = await collectGauges();
    for (const g of gauges) {
      if (!lines.includes('# HELP ' + g.name)) lines.push('# HELP ' + g.name + ' ' + defs[g.name].help);
      if (!lines.includes('# TYPE ' + g.name)) lines.push('# TYPE ' + g.name + ' ' + defs[g.name].type);
      const lbl = sampleLabels(g.labels);
      lines.push(g.name + (lbl ? '{' + lbl + '}' : '') + ' ' + g.value);
    }
  } catch (e) {
    lines.push('# error collecting gauges: ' + escLabel(e.message));
  }
  lines.push('# EOF');
  return lines.join('\n') + '\n';
}

function metricsHandler(ctx) {
  const { res } = ctx;
  res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
  renderMetrics().then((body) => res.end(body)).catch(() => res.end('# EOF\n'));
}

export { inc, resetForTest, renderMetrics, metricsHandler };