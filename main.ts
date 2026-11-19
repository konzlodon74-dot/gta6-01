// Palmera Heat — the hand-in program.
//
// The grader runs this file with Node from the repository root. It copies
// the playable game (game/) and the screenshots (screenshots/) into the
// output directory, then writes dossier.json there with the kit's own
// buildDossier, so the dossier bytes are exactly the ones the scorer
// rebuilds from the same tree. Outside the grader, MAKEFUN_OUTPUT_DIR
// names the output directory; without it we write to ./out for local runs.

import { cpSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? join(repoDir, 'out');

// Start from a clean slate inside the output directory so a second run
// produces exactly the same tree as the first.
for (const part of ['game', 'screenshots']) {
  rmSync(join(outDir, part), { recursive: true, force: true });
  cpSync(join(repoDir, part), join(outDir, part), { recursive: true });
}
rmSync(join(outDir, 'dossier.json'), { force: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

const shotCount = readdirSync(join(outDir, 'screenshots')).length;
console.log(`Palmera Heat handed in to ${outDir} (dossier ${dossier.byteLength} bytes, ${shotCount} screenshots).`);
