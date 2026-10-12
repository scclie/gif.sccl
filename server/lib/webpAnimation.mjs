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

function staticCanvasVp8x(chunks) {
  const image = chunks.find((part) => part.tag === 'VP8 ' || part.tag === 'VP8L');
  if (!image) return null;

  let width;
  let height;
  let alpha = chunks.some((part) => part.tag === 'ALPH');
  if (image.tag === 'VP8 ') {
    if (image.data.length < 10 || !image.data.subarray(3, 6).equals(Buffer.from([0x9d, 0x01, 0x2a]))) return null;
    width = image.data.readUInt16LE(6) & 0x3fff;
    height = image.data.readUInt16LE(8) & 0x3fff;
  } else {
    if (image.data.length < 5 || image.data[0] !== 0x2f) return null;
    const bits = image.data.readUInt32LE(1);
    width = (bits & 0x3fff) + 1;
    height = ((bits >>> 14) & 0x3fff) + 1;
    alpha ||= !!((bits >>> 28) & 1);
  }
  if (!width || !height) return null;

  const vp8x = Buffer.alloc(10);
  if (alpha) vp8x[0] |= 0x10;
  vp8x.writeUIntLE(width - 1, 4, 3);
  vp8x.writeUIntLE(height - 1, 7, 3);
  return vp8x;
}

function animatedVp8x(chunks) {
  const source = chunks.find((part) => part.tag === 'VP8X');
  const vp8x = source && source.data.length >= 10 ? Buffer.from(source.data) : staticCanvasVp8x(chunks);
  if (!vp8x) return null;

  // 0x02 - WebP animation feature bit
  vp8x[0] |= 0x02;
  // 0x20 - ICC profile.
  if (!chunks.some((part) => part.tag === 'ICCP')) vp8x[0] &= ~0x20;
  return vp8x;
}

function makeFrame(vp8x, imageChunks) {
  const header = Buffer.alloc(16);
  vp8x.copy(header, 6, 4, 7);
  vp8x.copy(header, 9, 7, 10);
  header.writeUIntLE(100, 12, 3);
  header[15] = 0x02;
  return Buffer.concat([header, ...imageChunks.map((part) => chunk(part.tag, part.data))]);
}

function wrapStaticWebp(chunks, vp8x) {
  const imageChunks = chunks.filter((part) => ['ALPH', 'VP8 ', 'VP8L'].includes(part.tag));
  if (!imageChunks.some((part) => part.tag === 'VP8 ' || part.tag === 'VP8L')) return null;

  const metadata = chunks.filter((part) => ['ICCP', 'EXIF', 'XMP '].includes(part.tag));
  const frame = makeFrame(vp8x, imageChunks);
  return assemble([
    { tag: 'VP8X', data: vp8x },
    ...metadata.filter((part) => part.tag === 'ICCP'),
    { tag: 'ANIM', data: Buffer.alloc(6) },
    { tag: 'ANMF', data: frame },
    { tag: 'ANMF', data: Buffer.from(frame) },
    ...metadata.filter((part) => part.tag !== 'ICCP'),
  ]);
}

/**
 * discord treats a one-frame webp as static. This returns a two-frame webp
 */
export function makeTwoFrameWebp(input) {
  const { data, chunks } = parseWebp(input);
  const frames = chunks.filter((part) => part.tag === 'ANMF');
  if (frames.length >= 2) return data;

  const vp8x = animatedVp8x(chunks);
  if (!vp8x) {
    if (frames.length === 1) throw new Error('one-frame animation is missing VP8X');
    return data;
  }

  if (frames.length === 0) return wrapStaticWebp(chunks, vp8x) || data;

  const output = [];
  let foundAnimationHeader = false;
  for (const part of chunks) {
    if (part.tag === 'VP8X') {
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
