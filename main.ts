// Solmar City — the hand-in program (Node 22, standard library only).
//
// It takes the game in this repository and lays it out for the grader:
// game/ and screenshots/ copied into the output directory, plus a
// dossier.json written by the vendored make.fun library, which is the
// summary the judge reads. The program runs twice and must write the
// same bytes both times, so it copies and writes deterministically and
// never stamps a time or a random value anywhere.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Inside the grader's container MAKEFUN_OUTPUT_DIR is unset and the
// output directory is /output.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's caps for this bounty (reference/gate.json). Only
// text_max_bytes shapes the dossier's bytes; the rest refuse an entry
// the scorer would refuse, so passing them here fails in the same
// places instead of silently handing in something invalid.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function entryRoot() {
  return fileURLToPath(new URL('.', import.meta.url));
}

function outputDir() {
  return process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
}

function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

function handIn() {
  const here = entryRoot();
  const out = outputDir();
  mkdirSync(out, { recursive: true });
  copyTree(join(here, 'game'), join(out, 'game'));
  if (existsSync(join(here, 'screenshots'))) {
    copyTree(join(here, 'screenshots'), join(out, 'screenshots'));
  }
  const dossier = buildDossier(out, DOSSIER_CAPS);
  writeFileSync(join(out, 'dossier.json'), dossier);
  console.log('Solmar City build complete:', out, '| dossier bytes:', dossier.length);
}

handIn();
