#!/usr/bin/env node
'use strict';
// Point d'entrée CLI — démarre le dashboard web puis lance la boucle
// évolutionnaire (evolution.js), en checkpointant régulièrement sur disque.
// Tous les paramètres sont configurables en ligne de commande (voir --help).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInitialPopulation, runGeneration, computeGenomeDiversity } from './evolution.js';
import { createHallOfFame } from './hall-of-fame.js';
import { startDashboard } from './dashboard-server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CHECKPOINT_DIR = path.join(ROOT, 'checkpoints');
const RESULTS_DIR = path.join(ROOT, 'results');

function parseArgs(argv) {
  const defaults = {
    generations: 150,
    population: 24,
    matchDuration: 45,
    popSample: 4,
    hofSample: 3,
    hofInterval: 8,
    hofMax: 24,
    elite: 2,
    mutationRate: 0.2,
    dashboardPort: 3000,
    checkpointInterval: 5,
    resume: null,
  };
  const map = {
    '--generations': ['generations', Number],
    '--population': ['population', Number],
    '--match-duration': ['matchDuration', Number],
    '--pop-sample': ['popSample', Number],
    '--hof-sample': ['hofSample', Number],
    '--hof-interval': ['hofInterval', Number],
    '--hof-max': ['hofMax', Number],
    '--elite': ['elite', Number],
    '--mutation-rate': ['mutationRate', Number],
    '--dashboard-port': ['dashboardPort', Number],
    '--checkpoint-interval': ['checkpointInterval', Number],
    '--resume': ['resume', String],
  };
  const out = { ...defaults };
  for (let i = 0; i < argv.length; i++) {
    const entry = map[argv[i]];
    if (!entry) continue;
    const [key, cast] = entry;
    out[key] = cast(argv[i + 1]);
    i++;
  }
  return out;
}

function saveCheckpoint(generation, population, hof, bestEver) {
  fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
  const file = path.join(CHECKPOINT_DIR, `gen-${generation}.json`);
  fs.writeFileSync(file, JSON.stringify({ generation, population, hof, bestEver }, null, 2));
  const latest = path.join(CHECKPOINT_DIR, 'latest.json');
  fs.writeFileSync(latest, JSON.stringify({ generation, population, hof, bestEver }, null, 2));
  return file;
}

function saveBestResult(bestEver) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(RESULTS_DIR, 'best-genome.json'), JSON.stringify(bestEver, null, 2));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  let population, hof, startGen = 1, bestEver = null;
  if (opts.resume) {
    const loaded = JSON.parse(fs.readFileSync(opts.resume, 'utf8'));
    population = loaded.population;
    hof = loaded.hof;
    bestEver = loaded.bestEver || null;
    startGen = loaded.generation + 1;
    console.log(`[train] reprise depuis ${opts.resume} — génération ${startGen}`);
  } else {
    population = createInitialPopulation(opts.population);
    hof = createHallOfFame(opts.hofMax);
  }

  const trainingState = {
    generation: startGen - 1,
    totalGenerations: opts.generations,
    matchInGen: 0,
    matchesPerGenEstimate: (Math.min(opts.popSample, opts.population - 1) + opts.hofSample + 4) * opts.population,
    lastMatch: null,
    bestFitnessEver: bestEver ? bestEver.fitness : null,
    avgFitnessGen: null,
    genomeDiversity: null,
    matchesPerSecond: null,
    etaSeconds: null,
    elapsedSeconds: 0,
    hofSize: hof.members.length,
    hofLastAddedGen: hof.members.length ? hof.members[hof.members.length - 1].generation : null,
    archetypeScores: bestEver ? bestEver.archetypeScores : {},
  };

  startDashboard(opts.dashboardPort, () => trainingState);

  const trainStart = Date.now();
  let matchCount = 0;

  for (let gen = startGen; gen <= opts.generations; gen++) {
    const genStart = Date.now();
    trainingState.matchInGen = 0;

    const result = await runGeneration(population, hof, gen, opts, {
      onMatch: (info) => {
        matchCount++;
        trainingState.matchInGen++;
        trainingState.lastMatch = info;
        trainingState.elapsedSeconds = (Date.now() - trainStart) / 1000;
        trainingState.matchesPerSecond = matchCount / trainingState.elapsedSeconds;
        const remainingMatches = trainingState.matchesPerGenEstimate * (opts.generations - gen + 1) - trainingState.matchInGen;
        trainingState.etaSeconds = trainingState.matchesPerSecond > 0 ? remainingMatches / trainingState.matchesPerSecond : null;
      },
    });

    population = result.next;
    trainingState.generation = gen;
    trainingState.avgFitnessGen = result.avgFitness;
    trainingState.genomeDiversity = computeGenomeDiversity(result.sorted);
    trainingState.hofSize = hof.members.length;
    trainingState.hofLastAddedGen = hof.members.length ? hof.members[hof.members.length - 1].generation : null;
    trainingState.archetypeScores = result.best.archetypeScores;

    if (!bestEver || result.best.fitness > bestEver.fitness) {
      bestEver = { ...result.best, generation: gen };
      trainingState.bestFitnessEver = bestEver.fitness;
      saveBestResult(bestEver);
    }

    const genDuration = ((Date.now() - genStart) / 1000).toFixed(1);
    console.log(`[gen ${gen}/${opts.generations}] fitness meilleur=${result.best.fitness.toFixed(3)} moyen=${result.avgFitness.toFixed(3)} diversité=${trainingState.genomeDiversity.toFixed(3)} hof=${hof.members.length} (${genDuration}s)`);

    if (gen % opts.checkpointInterval === 0 || gen === opts.generations) {
      const file = saveCheckpoint(gen, population, hof, bestEver);
      console.log(`[train] checkpoint sauvegardé : ${file}`);
    }
  }

  console.log('[train] entraînement terminé.');
  console.log(`[train] meilleur génome (fitness=${bestEver.fitness.toFixed(3)}) écrit dans results/best-genome.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
