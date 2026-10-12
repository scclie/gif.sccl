function parseWebp(input) {
  const data = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (data.length < 12 || data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('not a RIFF WebP file');
  }

  const chunks = [];
  for (let offset = 12; offset + 8 <= data.length;) {
    const size = data.readUInt32LE(offset + 4);
    const end = offset + 8 + size;
    if (end > data.length) throw new Error('truncated WebP chunk');
    chunks.push({ tag: data.toString('ascii', offset, offset + 4), data: data.subarray(offset + 8, end) });
    offset = end + (size & 1);
  }
  return { data, chunks };
}

function chunk(tag, data) {
  const header = Buffer.alloc(8);
  header.write(tag, 0, 4, 'ascii');
  header.writeUInt32LE(data.length, 4);
  return Buffer.concat([header, data, ...(data.length & 1 ? [Buffer.alloc(1)] : [])]);
}

function assemble(chunks) {
  const payload = Buffer.concat(chunks.map(({ tag, data }) => chunk(tag, data)));
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 4, 'ascii');
  header.writeUInt32LE(payload.length + 4, 4);
  header.write('WEBP', 8, 4, 'ascii');
  return Buffer.concat([header, payload]);
}

/**
 * Duplicates a lone animation frame. Discord treats an animation with one
 * ANMF frame as a static image; two identical frames retain the same pixels
 * while making the file unambiguously animated.
 */
export function makeTwoFrameWebp(input) {
  const { data, chunks } = parseWebp(input);
  const frames = chunks.filter((part) => part.tag === 'ANMF');
  if (frames.length !== 1) return data;
  if (!chunks.some((part) => part.tag === 'VP8X')) {
    throw new Error('one-frame animation is missing VP8X');
  }

  const output = [];
  let foundAnimationHeader = false;
  for (const part of chunks) {
    if (part.tag === 'VP8X') {
      if (part.data.length < 1) throw new Error('invalid VP8X chunk');
      const vp8x = Buffer.from(part.data);
      // 0x02 is the WebP animation feature bit. 0x20 is ICC profile.
      vp8x[0] |= 0x02;
      if (!chunks.some((candidate) => candidate.tag === 'ICCP')) vp8x[0] &= ~0x20;
      output.push({ tag: part.tag, data: vp8x });
      continue;
    }
    if (part.tag === 'ANIM') foundAnimationHeader = true;
    output.push(part);
    if (part.tag === 'ANMF') output.push({ tag: 'ANMF', data: Buffer.from(part.data) });
  }

  if (!foundAnimationHeader) {
    const firstFrame = output.findIndex((part) => part.tag === 'ANMF');
    output.splice(firstFrame, 0, { tag: 'ANIM', data: Buffer.alloc(6) });
  }
  return assemble(output);
}
