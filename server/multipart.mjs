import busboy from 'busboy';

const MAX_FILE = 15 * 1024 * 1024;

export function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers, limits: { files: 1, fileSize: MAX_FILE } });
    const fields = {};
    let file = null;
    let tooBig = false;

    bb.on('field', (name, val) => {
      fields[name] = val;
    });

    bb.on('file', (name, stream) => {
      const chunks = [];
      stream.on('data', (c) => chunks.push(c));
      stream.on('limit', () => {
        tooBig = true;
        stream.resume();
      });
      stream.on('end', () => {
        if (!tooBig) file = Buffer.concat(chunks);
      });
    });

    bb.on('close', () => {
      if (tooBig) {
        reject(Object.assign(new Error('file too large (max 15MB)'), { code: 'TOO_BIG' }));
      } else {
        resolve({ fields, file });
      }
    });
    bb.on('error', reject);
    req.pipe(bb);
  });
}
