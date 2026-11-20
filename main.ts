// Solmar City — the entrypoint (Node 22, standard library only).
// It hands the game in: copy game/ and screenshots/ from this directory
// into /output and write /output/dossier.json, the summary the judge
// reads, with the vendored make.fun library.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for
// /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root is the directory this file lives in.
const root = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(name: string): void {
  const from = join(root, name);
  if (!existsSync(from)) return;
  cpSync(from, join(outputDir, name), { recursive: true });
}

mkdirSync(outputDir, { recursive: true });
copyTree('game');
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
copyTree('screenshots');

// The caps the gate enforces (reference/gate.json): the dossier text is
// capped, and anything over a cap is refused outright, so the entry is
// checked against the same numbers here before it is handed in.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outputDir, 'dossier.json'), dossier);
