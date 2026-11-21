// GLOAMING ARCHIVE — the hand-in program for make.fun.
//
// The game itself is the static site in game/ (open game/index.html in a
// desktop browser; it plays offline). This program's one job is to hand that
// game in: copy game/ and screenshots/ into the output directory and write
// the dossier the judge reads, using the vendored library in
// vendor/makefun-game.ts. The caps passed to buildDossier mirror the
// scorer's own limits, so a breach fails here first, loudly, instead of
// failing silently at the gate.
//
// Run locally the same way the grader does, with MAKEFUN_OUTPUT_DIR
// standing in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const GAME_FILE_LIMIT = 993;
const SCREENSHOT_LIMIT = 4;
const SCREENSHOT_BYTE_LIMIT = 262_144;

/** Count a directory tree the way the gate does: files and folders alike. */
function countEntries(dir: string): number {
  let total = 0;
  for (const name of readdirSync(dir)) {
    total += 1;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) total += countEntries(path);
  }
  return total;
}

function stageTree(from: string, to: string, label: string): void {
  if (!existsSync(from)) throw new Error(`missing ${label}: expected a directory at ${from}`);
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

stageTree(join(root, 'game'), join(outputDir, 'game'), 'game/');
stageTree(join(root, 'screenshots'), join(outputDir, 'screenshots'), 'screenshots/');

// Refuse early on the two caps a maker can actually trip by accident: too
// many game files for the shared output budget, or a screenshot the gate
// would call oversized. buildDossier enforces the rest.
const gameEntries = countEntries(join(outputDir, 'game'));
if (gameEntries > GAME_FILE_LIMIT) {
  throw new Error(`game/ holds ${gameEntries} entries; the cap is ${GAME_FILE_LIMIT}`);
}
const shots = readdirSync(join(outputDir, 'screenshots')).filter((n) => /\.(png|jpe?g)$/i.test(n));
if (shots.length > SCREENSHOT_LIMIT) {
  throw new Error(`screenshots/ holds ${shots.length} images; the cap is ${SCREENSHOT_LIMIT}`);
}
for (const shot of shots) {
  const bytes = statSync(join(outputDir, 'screenshots', shot)).size;
  if (bytes > SCREENSHOT_BYTE_LIMIT) {
    throw new Error(`screenshots/${shot} is ${bytes} bytes; the cap is ${SCREENSHOT_BYTE_LIMIT}`);
  }
}

const dossierCaps = {
  text_max_bytes: 163_840,
  screenshots: { max: SCREENSHOT_LIMIT, max_bytes: SCREENSHOT_BYTE_LIMIT },
  game_max_files: GAME_FILE_LIMIT,
  game_max_bytes: 50_331_648,
  game_path_max_bytes: 1_000,
};
const dossier = buildDossier(outputDir, dossierCaps);
// The gate rebuilds this dossier from the same files and compares bytes, so
// prove here that the build is deterministic: a second pass must agree, byte
// for byte (buildDossier returns bytes, so compare them as buffers).
if (!Buffer.from(buildDossier(outputDir, dossierCaps)).equals(Buffer.from(dossier))) {
  throw new Error('dossier build is not deterministic; refusing to hand in');
}
writeFileSync(join(outputDir, 'dossier.json'), dossier);

console.log(
  `gloaming archive handed in: ${gameEntries} game entries, ${shots.length} screenshots, dossier ${dossier.length} bytes -> ${outputDir}`,
);
