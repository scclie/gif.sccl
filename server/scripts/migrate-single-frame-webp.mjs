#!/usr/bin/env node
import { readdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { makeTwoFrameWebp } from '../lib/webpAnimation.mjs';

const apply = process.argv.includes('--apply');
const dataDir = process.env.DATA_DIR || '/var/gifs';
let changed = 0;
let skipped = 0;

for (const name of await readdir(dataDir)) {
  if (!name.endsWith('.webp')) continue;
  const file = path.join(dataDir, name);
  const original = await readFile(file);
  let converted;
  try {
    converted = makeTwoFrameWebp(original);
  } catch (error) {
    console.error(`skip ${name}: ${error.message}`);
    skipped++;
    continue;
  }
  if (converted.equals(original)) continue;

  changed++;
  if (!apply) {
    console.log(`would migrate ${name}`);
    continue;
  }
  const temporary = file + '.tmp';
  await writeFile(temporary, converted);
  await rename(temporary, file);
  console.log(`migrated ${name}`);
}

console.log(`${apply ? 'migrated' : 'would migrate'} ${changed} file(s); skipped ${skipped}`);
if (!apply) console.log('rerun with --apply to write changes');
