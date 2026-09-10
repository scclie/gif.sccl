import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientIp } from '../lib/net.mjs';

test('clientIp prefers CF-Connecting-IP, then X-Forwarded-For, falls back to socket', () => {
  assert.equal(clientIp({ headers: { 'cf-connecting-ip': '203.0.113.9' }, socket: { remoteAddress: '127.0.0.1' } }), '203.0.113.9');
  assert.equal(clientIp({ headers: { 'x-forwarded-for': '198.51.100.4, 10.0.0.1' }, socket: { remoteAddress: '127.0.0.1' } }), '198.51.100.4');
  assert.equal(clientIp({ headers: {}, socket: { remoteAddress: '127.0.0.1' } }), '127.0.0.1');
  assert.equal(clientIp({ headers: {} }), 'unknown');
});
