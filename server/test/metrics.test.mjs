import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inc, resetForTest, renderMetrics, metricsHandler } from '../metrics.mjs';

test('inc accumulates counters with labels', async () => {
  resetForTest();
  inc('gif_uploads_total', { format: 'webp', anon: '1' });
  inc('gif_uploads_total', { format: 'webp', anon: '1' });
  inc('gif_uploads_total', { format: 'gif', anon: '0' }, 3);
  const out = await renderMetrics();
  assert.match(out, /gif_uploads_total\{anon="1",format="webp"\} 2/);
  assert.match(out, /gif_uploads_total\{anon="0",format="gif"\} 3/);
});

test('gif file fetches counted as API route with status', async () => {
  resetForTest();
  inc('gif_http_requests_total', { route: '/api/gif/:file', method: 'GET', status: '200' }, 2);
  inc('gif_http_requests_total', { route: '/api/gif/:file', method: 'GET', status: '404' });
  const out = await renderMetrics();
  assert.match(out, /gif_http_requests_total\{method="GET",route="\/api\/gif\/:file",status="200"\} 2/);
  assert.match(out, /gif_http_requests_total\{method="GET",route="\/api\/gif\/:file",status="404"\} 1/);
});

test('label values escaped', async () => {
  resetForTest();
  inc('gif_errors_total', { type: 'a"b\\c' });
  const out = await renderMetrics();
  assert.match(out, /type="a\\"b\\\\c"/);
});

test('metrics handler writes text/plain 200', async () => {
  const res = { writeHead: (s, h) => { res.status = s; res.headers = h; }, end: (b) => { res.body = b; } };
  metricsHandler({ res });
  assert.equal(res.status, 200);
  assert.equal(res.headers['Content-Type'], 'text/plain; version=0.0.4');
  for (let i = 0; i < 100 && res.body === undefined; i++) {
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.match(res.body, /# EOF/);
});