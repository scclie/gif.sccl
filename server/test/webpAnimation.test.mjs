import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTwoFrameWebp } from '../lib/webpAnimation.mjs';

function chunk(tag, payload) {
  const header = Buffer.alloc(8);
  header.write(tag, 0, 4, 'ascii');
  header.writeUInt32LE(payload.length, 4);
  return Buffer.concat([header, payload, ...(payload.length & 1 ? [Buffer.alloc(1)] : [])]);
}

function riff(...chunks) {
  const payload = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 4, 'ascii');
  header.writeUInt32LE(payload.length + 4, 4);
  header.write('WEBP', 8, 4, 'ascii');
  return Buffer.concat([header, payload]);
}

function chunksOf(buf) {
  const result = [];
  for (let pos = 12; pos + 8 <= buf.length;) {
    const size = buf.readUInt32LE(pos + 4);
    result.push({ tag: buf.toString('ascii', pos, pos + 4), data: buf.subarray(pos + 8, pos + 8 + size) });
    pos += 8 + size + (size & 1);
  }
  return result;
}

test('converts 1 fram webp into 2 frames', () => {
  const vp8x = Buffer.from([0x20, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const anim = Buffer.alloc(6);
  const anmf = Buffer.alloc(16 + 4);
  anmf.writeUIntLE(99, 12, 3);
  const input = riff(chunk('VP8X', vp8x), chunk('ANIM', anim), chunk('ANMF', anmf));

  const output = makeTwoFrameWebp(input);
  const chunks = chunksOf(output);

  assert.equal(chunks.filter((part) => part.tag === 'ANMF').length, 2);
  assert.equal(chunks.find((part) => part.tag === 'VP8X').data[0] & 0x02, 0x02);
  assert.equal(chunks.find((part) => part.tag === 'VP8X').data[0] & 0x20, 0);
});

test('wraps a static webp in two identical animation frames', () => {
  const vp8x = Buffer.from([0x20, 0, 0, 0, 1, 0, 0, 2, 0, 0]);
  const image = Buffer.from([0x9d, 0x01, 0x2a, 0x02]);
  const input = riff(chunk('VP8X', vp8x), chunk('VP8 ', image));

  const output = makeTwoFrameWebp(input);
  const chunks = chunksOf(output);
  const frames = chunks.filter((part) => part.tag === 'ANMF');

  assert.equal(frames.length, 2);
  assert.equal(chunks.find((part) => part.tag === 'VP8X').data[0] & 0x02, 0x02);
  assert.equal(chunks.find((part) => part.tag === 'VP8X').data[0] & 0x20, 0);
  assert.equal(frames[0].data.toString('ascii', 16, 20), 'VP8 ');
});

test('wraps a bare vp8 webp in two animation frames', () => {
  const image = Buffer.from([0, 0, 0, 0x9d, 0x01, 0x2a, 0x02, 0, 0x03, 0]);
  const input = riff(chunk('VP8 ', image));

  const output = makeTwoFrameWebp(input);
  const chunks = chunksOf(output);

  assert.deepEqual(chunks.map((part) => part.tag), ['VP8X', 'ANIM', 'ANMF', 'ANMF']);
  assert.equal(chunks.find((part) => part.tag === 'VP8X').data[0] & 0x02, 0x02);
  assert.equal(chunks.filter((part) => part.tag === 'ANMF')[0].data.toString('ascii', 16, 20), 'VP8 ');
});

test('refuses a malformed animation w/o VP8X', () => {
  const input = riff(chunk('ANMF', Buffer.alloc(20)));

  assert.throws(() => makeTwoFrameWebp(input), /VP8X/);
});

test('leaves a wepb that already has 2x animation frames untouched', () => {
  const vp8x = Buffer.from([0x02, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const anim = Buffer.alloc(6);
  const anmf = Buffer.alloc(16 + 4);
  const input = riff(chunk('VP8X', vp8x), chunk('ANIM', anim), chunk('ANMF', anmf), chunk('ANMF', anmf));

  assert.strictEqual(makeTwoFrameWebp(input), input);
});
