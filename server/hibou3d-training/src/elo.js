#!/usr/bin/env node
'use strict';
// Estime un classement Elo relatif (base 1200, échelle chess-like — 400 points
// d'écart ≈ 10× plus de chances de gagner) entre :
//   - les 3 niveaux ACTUELS du jeu (jeu:easy/medium/hard — BOT_DIFFICULTY_TUNING
//     de docs/hibou-3d.html, complétés par les 5 gènes étendus à leur valeur
//     par défaut pour reproduire EXACTEMENT le comportement actuel)
//   - les 4 archétypes humains fixes (archetypes.js)
//   - le meilleur génome trouvé par l'entraînement (results/best-genome.json)
//
// Répond à "de combien le bot entraîné est-il plus fort que le niveau actuel
// le plus dur ?" avec un chiffre, pas une impression. Chaque paire joue
// plusieurs matchs (moitié en position A, moitié en position B, pour annuler
// l'avantage éventuel du premier joueur) ; les résultats sont ensuite passés
// plusieurs fois dans la mise à jour Elo (ordre remélangé à chaque passe) pour
// converger sans avoir à re-simuler — les matchs sont le seul coût réel.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { simulateMatch } from './simulation.js';
import { ARCHETYPES } from './archetypes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const deg = Math.PI / 180;

// Valeurs par défaut des 5 gènes étendus qui n'existent pas encore dans le
// jeu — reproduisent le comportement actuel (extend à 30u, montée 25, jink
// 0.45, break perpendiculaire pur, pas de biais d'agressivité).
const CURRENT_DEFAULTS = { extendDist: 30, extendClimb: 25, jinkAmplitude: 0.45, breakPerpWeight: 1, aggressionBias: 0 };

const GAME_PRESETS = {
  'jeu:easy':   { aiTickInterval: 0.5,  aimConeRad: 12 * deg,  reactionDelay: 0.9,  leadFactor: 0,    throttleCap: 0.7, evadeLifeThreshold: 6, breakChance: 0,    jinkPeriod: 0,    fireDist: 150, ...CURRENT_DEFAULTS },
  'jeu:medium': { aiTickInterval: 0.3,  aimConeRad: 6 * deg,   reactionDelay: 0.4,  leadFactor: 0.55, throttleCap: 0.9, evadeLifeThreshold: 4, breakChance: 0.45, jinkPeriod: 0.9,  fireDist: 200, ...CURRENT_DEFAULTS },
  'jeu:hard':   { aiTickInterval: 0.15, aimConeRad: 3.5 * deg, reactionDelay: 0.15, leadFactor: 1,    throttleCap: 1.0, evadeLifeThreshold: 3, breakChance: 0.8,  jinkPeriod: 0.55, fireDist: 240, ...CURRENT_DEFAULTS },
};

function parseArgs(argv) {
  const defaults = {
    matchesPerPair: 6,
    matchDuration: 45,
    convergencePasses: 25,
    kFactor: 24,
    bestGenome: path.join(ROOT, 'results', 'best-genome.json'),
  };
  const map = {
    '--matches-per-pair': ['matchesPerPair', Number],
    '--match-duration': ['matchDuration', Number],
    '--convergence-passes': ['convergencePasses', Number],
    '--k-factor': ['kFactor', Number],
    '--best-genome': ['bestGenome', String],
  };
  const out = { ...defaults };
  for (let i = 0; i < argv.length; i++) {
    const entry = map[argv[i]];
    if (!entry) continue;
    out[entry[0]] = entry[1](argv[i + 1]);
    i++;
  }
  return out;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const contestants = { ...GAME_PRESETS };
  for (const [name, genome] of Object.entries(ARCHETYPES)) contestants[`archétype:${name}`] = genome;

  if (fs.existsSync(opts.bestGenome)) {
    const loaded = JSON.parse(fs.readFileSync(opts.bestGenome, 'utf8'));
    contestants['ENTRAÎNÉ:vainqueur'] = loaded.genome;
  } else {
    console.warn(`[elo] pas de génome entraîné trouvé (${opts.bestGenome}) — comparaison limitée aux niveaux actuels + archétypes. Lance un entraînement d'abord si tu veux le comparer.`);
  }

  const names = Object.keys(contestants);
  if (names.length < 2) { console.error('[elo] pas assez de concurrents.'); process.exit(1); }

  // Toutes les paires, chacune jouée matchesPerPair fois, alternant qui est A/B.
  const fixtures = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      for (let m = 0; m < opts.matchesPerPair; m++) {
        fixtures.push(m % 2 === 0 ? [names[i], names[j]] : [names[j], names[i]]);
      }
    }
  }

  console.log(`[elo] ${names.length} concurrents, ${fixtures.length} matchs à simuler (${opts.matchDuration}s chacun)...`);
  const outcomes = []; // { a, b, sA } — sA = score de A (1 victoire, 0.5 nul, 0 défaite)
  let done = 0;
  for (const [nameA, nameB] of fixtures) {
    const result = simulateMatch(contestants[nameA], contestants[nameB], { duration: opts.matchDuration });
    const scoreA = result.a.kills - result.a.deaths;
    const scoreB = result.b.kills - result.b.deaths;
    const sA = scoreA > scoreB ? 1 : scoreA < scoreB ? 0 : 0.5;
    outcomes.push({ a: nameA, b: nameB, sA });
    done++;
    if (done % 10 === 0 || done === fixtures.length) process.stdout.write(`\r[elo] ${done}/${fixtures.length} matchs simulés...`);
    await new Promise((r) => setImmediate(r));
  }
  console.log();

  // Convergence Elo : plusieurs passes sur les MÊMES résultats (ordre
  // remélangé à chaque passe) — stabilise le classement sans re-simuler.
  const elo = Object.fromEntries(names.map((n) => [n, 1200]));
  for (let pass = 0; pass < opts.convergencePasses; pass++) {
    for (const { a, b, sA } of shuffle(outcomes)) {
      const expectedA = 1 / (1 + Math.pow(10, (elo[b] - elo[a]) / 400));
      elo[a] += opts.kFactor * (sA - expectedA);
      elo[b] += opts.kFactor * ((1 - sA) - (1 - expectedA));
    }
  }

  const record = Object.fromEntries(names.map((n) => [n, { w: 0, d: 0, l: 0 }]));
  for (const { a, b, sA } of outcomes) {
    if (sA === 1) { record[a].w++; record[b].l++; }
    else if (sA === 0) { record[a].l++; record[b].w++; }
    else { record[a].d++; record[b].d++; }
  }

  const ranked = names.slice().sort((x, y) => elo[y] - elo[x]);
  console.log('\n=== Classement Elo (base 1200, 400 pts ≈ 10× plus de chances de gagner) ===');
  console.log('rang  nom                       elo    V/N/D');
  ranked.forEach((n, i) => {
    const r = record[n];
    console.log(`${String(i + 1).padStart(3)}.  ${n.padEnd(24)} ${Math.round(elo[n]).toString().padStart(5)}   ${r.w}/${r.d}/${r.l}`);
  });

  if (contestants['ENTRAÎNÉ:vainqueur'] && contestants['jeu:hard']) {
    const gap = elo['ENTRAÎNÉ:vainqueur'] - elo['jeu:hard'];
    const winProb = 1 / (1 + Math.pow(10, -gap / 400));
    console.log(`\n=== Comparaison directe : ENTRAÎNÉ:vainqueur vs jeu:hard (niveau actuel le plus fort) ===`);
    console.log(`écart Elo : ${gap >= 0 ? '+' : ''}${Math.round(gap)}`);
    console.log(`probabilité que le bot entraîné batte "hard" sur un match donné : ${(winProb * 100).toFixed(1)}%`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
