import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTags, formatSize } from '../lib/format.mjs';

test('parseTags trims, slices to 30 chars, filters empties, caps at 10', () => {
  assert.deepEqual(parseTags(' a ,  b  ,c'), ['a', 'b', 'c']);
  assert.deepEqual(parseTags('  ,, '), []);
  assert.deepEqual(parseTags(''), []);
  assert.equal(parseTags('a'.repeat(40))[0].length, 30);
  assert.equal(parseTags(Array.from({ length: 15 }, (_, i) => 't' + i).join(',')).length, 10);
});

test('formatSize renders b/kb/mb', () => {
  assert.equal(formatSize(512), '512b');
  assert.equal(formatSize(36864), '36.0kb');
  assert.equal(formatSize(2 * 1048576), '2.0mb');
});
