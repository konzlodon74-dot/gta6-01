// Palmera Heat — the hand-in program for the gta6-01 bounty (Node 22,
// standard library only). The game itself is the static site in game/:
// index.html and its ES modules, no build step, no network. This program
// copies game/ and screenshots/ into the output directory and writes
// dossier.json with the kit's vendored library, exactly as the scorer
// rebuilds it, so what is judged is what was handed in.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly rather than hand in an empty shell if the layout is broken.
if (!existsSync(join(repoDir, 'game', 'index.html'))) {
  throw new Error('game/index.html is missing: run this from the entry repository root.');
}

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The gate's own caps, passed whole: only text_max_bytes shapes the bytes;
// the rest make this program refuse exactly what the scorer would refuse
// (over 4 screenshots or one over 256 KiB; game/ over 993 entries or 48 MiB;
// a path under game/ over 1000 bytes).
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log(`Palmera Heat handed in: game/ and screenshots/ copied to ${outputDir}, dossier.json written (${dossier.length} bytes).`);
