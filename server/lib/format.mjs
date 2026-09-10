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