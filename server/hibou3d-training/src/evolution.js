'use strict';
// Boucle évolutionnaire principale — algorithme génétique standard (tournoi +
// BLX-α + mutation gaussienne + élitisme, voir genome.js) avec DEUX garde-fous
// explicites demandés :
//
//   1. Anti-oubli catastrophique : chaque individu est aussi évalué contre un
//      échantillon du Hall of Fame (hall-of-fame.js) — les champions des
//      générations passées. Un individu qui a "oublié" comment les battre
//      perd des points de fitness, donc la sélection l'élimine.
//   2. Anti-overfitting au self-play : chaque individu est aussi évalué
//      contre les 4 archétypes humains fixes (archetypes.js) qui ne
//      co-évoluent JAMAIS — un style gagnant uniquement en interne (contre
//      la population/le HoF) mais perdant contre un rusher/sniper/newbie de
//      base est pénalisé.
//
// Un bonus de diversité comportementale (fitness sharing simplifié) empêche
// en plus la population de converger vers un seul style.
import { randomGenome, crossover, mutate, genomeDistance } from './genome.js';
import { ARCHETYPES, ARCHETYPE_NAMES } from './archetypes.js';
import { addChampion, sampleHallOfFame } from './hall-of-fame.js';
import { simulateMatch } from './simulation.js';

const W_POP = 0.3, W_HOF = 0.3, W_ARCH = 0.3, W_DIV = 0.1;
const SHARING_SIGMA = 0.3;

function behaviorVector(stats, duration) {
  const st = stats.stateTime;
  const total = Math.max(1e-6, (st.approach || 0) + (st.extend || 0) + (st.break || 0) + (st.evade || 0));
  const accuracy = stats.shotsFired > 0 ? stats.shotsHit / stats.shotsFired : 0;
  return [
    (st.approach || 0) / total,
    (st.extend || 0) / total,
    (st.break || 0) / total,
    (st.evade || 0) / total,
    accuracy,
  ];
}

function vectorDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; sum += d * d; }
  return Math.sqrt(sum);
}

// Rend la main à la boucle d'événements après chaque match — sinon le calcul
// synchrone d'une génération entière (des dizaines de matchs, ~0.5-1s chacun)
// bloquerait le serveur HTTP du dashboard et rien ne s'afficherait "en direct".
function yieldTick() {
  return new Promise((resolve) => setImmediate(resolve));
}

async function playMatch(genomeSelf, genomeOpp, duration, onMatch, label) {
  const result = simulateMatch(genomeSelf, genomeOpp, { duration });
  if (onMatch) onMatch({ label, killsA: result.a.kills, killsB: result.b.kills, crashesA: result.a.crashes, crashesB: result.b.crashes, duration });
  await yieldTick();
  return result;
}

// Évalue un individu contre un échantillon de la population, du HoF et tous
// les archétypes. Retourne { rawFitness, behaviorVector, archetypeScores }.
async function evaluateIndividual(genome, population, selfIdx, hof, options, onMatch) {
  const { duration, popSample, hofSample } = options;
  const behaviorSamples = [];
  const scoresPop = [], scoresHof = [], scoresArch = [];
  const archetypeScores = {};

  const others = population.filter((_, i) => i !== selfIdx);
  const popOpponents = sampleWithoutReplacement(others, Math.min(popSample, others.length));
  for (const opp of popOpponents) {
    const r = await playMatch(genome, opp.genome, duration, onMatch, 'population');
    scoresPop.push(r.a.kills - r.a.deaths);
    behaviorSamples.push(behaviorVector(r.a, duration));
  }

  const hofOpponents = sampleHallOfFame(hof, hofSample);
  for (const opp of hofOpponents) {
    const r = await playMatch(genome, opp.genome, duration, onMatch, 'hall-of-fame');
    scoresHof.push(r.a.kills - r.a.deaths);
    behaviorSamples.push(behaviorVector(r.a, duration));
  }

  for (const name of ARCHETYPE_NAMES) {
    const r = await playMatch(genome, ARCHETYPES[name], duration, onMatch, `archetype:${name}`);
    scoresArch.push(r.a.kills - r.a.deaths);
    archetypeScores[name] = { kills: r.a.kills, deaths: r.a.deaths };
    behaviorSamples.push(behaviorVector(r.a, duration));
  }

  const avg = (arr) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const scoreVsPop = avg(scoresPop);
  const scoreVsHof = hofOpponents.length ? avg(scoresHof) : scoreVsPop; // pas encore de HoF : neutre
  const scoreVsArch = avg(scoresArch);
  const rawFitness = W_POP * scoreVsPop + W_HOF * scoreVsHof + W_ARCH * scoreVsArch;

  const bv = behaviorSamples.length
    ? behaviorSamples.reduce((acc, v) => acc.map((x, i) => x + v[i]), [0, 0, 0, 0, 0]).map(x => x / behaviorSamples.length)
    : [0, 0, 0, 0, 0];

  return { rawFitness, behaviorVector: bv, archetypeScores, scoreVsPop, scoreVsHof, scoreVsArch };
}

function sampleWithoutReplacement(arr, n) {
  if (arr.length <= n) return arr;
  const pool = [...arr], out = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}

function tournamentSelect(population, k = 5) {
  let best = null;
  for (let i = 0; i < k; i++) {
    const c = population[Math.floor(Math.random() * population.length)];
    if (!best || c.fitness > best.fitness) best = c;
  }
  return best;
}

export function createInitialPopulation(size) {
  return Array.from({ length: size }, () => ({ genome: randomGenome(), fitness: 0 }));
}

// Une génération complète : évalue toute la population (avec sharing de
// diversité), puis produit la génération suivante par sélection/crossover/mutation.
// callbacks: { onMatch(info), onIndividualEvaluated(info) }
export async function runGeneration(population, hof, generation, options, callbacks = {}) {
  const evaluations = [];
  for (let idx = 0; idx < population.length; idx++) {
    const evalResult = await evaluateIndividual(population[idx].genome, population, idx, hof, options, callbacks.onMatch);
    if (callbacks.onIndividualEvaluated) callbacks.onIndividualEvaluated({ idx, generation, ...evalResult });
    evaluations.push(evalResult);
  }

  // Fitness sharing simplifié : plus un comportement est fréquent dans la
  // population, plus son bonus de diversité est réduit (jamais négatif).
  const nicheCounts = evaluations.map((e, i) => {
    let count = 0;
    for (const other of evaluations) count += Math.max(0, 1 - vectorDistance(e.behaviorVector, other.behaviorVector) / SHARING_SIGMA);
    return count;
  });

  population.forEach((ind, i) => {
    const diversityBonus = W_DIV / nicheCounts[i];
    ind.fitness = evaluations[i].rawFitness + diversityBonus;
    ind.rawFitness = evaluations[i].rawFitness;
    ind.behaviorVector = evaluations[i].behaviorVector;
    ind.archetypeScores = evaluations[i].archetypeScores;
    ind.scoreVsPop = evaluations[i].scoreVsPop;
    ind.scoreVsHof = evaluations[i].scoreVsHof;
    ind.scoreVsArch = evaluations[i].scoreVsArch;
  });

  const sorted = [...population].sort((a, b) => b.fitness - a.fitness);
  const best = sorted[0];

  // Ajout périodique au Hall of Fame — voir hall-of-fame.js pour l'élagage
  // par diversité une fois hof.maxSize dépassé.
  if (generation % options.hofInterval === 0) {
    addChampion(hof, best.genome, generation);
  }

  // Prochaine génération : élitisme + tournoi/crossover/mutation.
  const next = sorted.slice(0, options.elite).map(ind => ({ genome: { ...ind.genome }, fitness: 0 }));
  while (next.length < population.length) {
    const p1 = tournamentSelect(population), p2 = tournamentSelect(population);
    const child = mutate(crossover(p1.genome, p2.genome), options.mutationRate);
    next.push({ genome: child, fitness: 0 });
  }

  return { next, best, sorted, avgFitness: sorted.reduce((s, i) => s + i.fitness, 0) / sorted.length };
}

export function computeGenomeDiversity(population) {
  if (population.length < 2) return 0;
  let sum = 0, count = 0;
  for (let i = 0; i < population.length; i++) {
    for (let j = i + 1; j < population.length; j++) {
      sum += genomeDistance(population[i].genome, population[j].genome);
      count++;
    }
  }
  return sum / count;
}
