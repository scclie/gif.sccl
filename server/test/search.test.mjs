import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeIlike, suggestTags } from '../lib/search.mjs';

test('escapeIlike escapes backslash, percent, underscore', () => {
  assert.equal(escapeIlike('100%_real\\x'), '100\\%\\_real\\\\x');
  assert.equal(escapeIlike('kitty'), 'kitty');
  assert.equal(escapeIlike(''), '');
});

test('suggestTags prefix-matches case-insensitively, dedupes, sorts, limits', () => {
  const tags = ['Kitty', 'kitcat', 'kitten', 'Dog', 'kit', 'kitcat', 'китя'];
  assert.deepEqual(suggestTags(tags, 'ki'), ['kit', 'kitcat', 'kitten', 'Kitty']);
  assert.deepEqual(suggestTags(tags, 'KIT'), ['kit', 'kitcat', 'kitten', 'Kitty']);
  assert.deepEqual(suggestTags(tags, 'ки'), ['китя']);
  assert.deepEqual(suggestTags(tags, 'zz'), []);
  assert.deepEqual(suggestTags(tags, ''), []);
  assert.equal(suggestTags(tags, 'k', 2).length, 2);
});
