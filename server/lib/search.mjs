export function escapeIlike(q) {
  return String(q).replace(/[\\%_]/g, (m) => '\\' + m);
}

export function suggestTags(allTags, prefix, limit = 10) {
  if (!prefix) return [];
  const p = prefix.toLowerCase();
  const seen = new Set();
  const out = [];
  for (const t of allTags) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (key.startsWith(p)) out.push(t);
  }
  return out.sort((a, b) => a.localeCompare(b)).slice(0, limit);
}