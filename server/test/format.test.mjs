import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTags, formatSize, newId, newToken } from '../lib/format.mjs';

test('parseTags trims, slices to 16 chars, filters empties, caps at 10', () => {
  assert.deepEqual(parseTags(' a ,  b  ,c'), ['a', 'b', 'c']);
  assert.deepEqual(parseTags('  ,, '), []);
  assert.deepEqual(parseTags(''), []);
  assert.equal(parseTags('a'.repeat(40))[0].length, 16);
  assert.equal(parseTags(Array.from({ length: 15 }, (_, i) => 't' + i).join(',')).length, 10);
});

test('formatSize renders b/kb/mb', () => {
  assert.equal(formatSize(512), '512b');
  assert.equal(formatSize(36864), '36.0kb');
  assert.equal(formatSize(2 * 1048576), '2.0mb');
});

test('newId/newToken produce short base62 ids of fixed length', () => {
  const id = newId();
  assert.equal(typeof id, 'string');
  assert.equal(id.length, 12);
  assert.match(id, /^[0-9A-Za-z]{12}$/);
  assert.notEqual(newId(), newId());
  const token = newToken();
  assert.equal(token.length, 16);
  assert.match(token, /^[0-9A-Za-z]{16}$/);
});
