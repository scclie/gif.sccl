export function parseTags(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((t) => t.trim().slice(0, 30))
    .filter(Boolean)
    .slice(0, 10);
}

export function formatSize(bytes) {
  if (bytes < 1024) return bytes + 'b';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + 'kb';
  return (bytes / 1048576).toFixed(1) + 'mb';
}

import { randomBytes } from 'node:crypto';

const ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function randomId(alphabet, len) {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function newId(len = 12) {
  return randomId(ID_ALPHABET, len);
}

export function newToken(len = 16) {
  return randomId(ID_ALPHABET, len);
}