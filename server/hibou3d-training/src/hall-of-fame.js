'use strict';
// Hall of Fame — anti-oubli catastrophique (voir Phase 4 du plan). Archive
// permanente de champions passés : chaque individu de la population est aussi
// évalué contre TOUS les membres du HoF (voir evolution.js), donc un bot qui
// oublie comment battre les stratégies des premières générations pour se
// spécialiser contre la population courante voit son score chuter et se fait
// éliminer par la sélection.
import { genomeDistance } from './genome.js';

export function createHallOfFame(maxSize = 30) {
  return { members: [], maxSize };
}

// Ajoute un champion, puis élague par diversité si le HoF dépasse sa taille
// max : on retire le membre dont le plus proche voisin est le plus proche
// (celui qui apporte le moins d'information nouvelle), jamais un tirage
// aléatoire — ça garantit que le HoF reste un échantillon large de styles.
export function addChampion(hof, genome, generation) {
  hof.members.push({ genome, generation });
  while (hof.members.length > hof.maxSize) {
    let worstIdx = 0, worstNearest = Infinity;
    for (let i = 0; i < hof.members.length; i++) {
      let nearest = Infinity;
      for (let j = 0; j < hof.members.length; j++) {
        if (i === j) continue;
        const d = genomeDistance(hof.members[i].genome, hof.members[j].genome);
        if (d < nearest) nearest = d;
      }
      if (nearest < worstNearest) { worstNearest = nearest; worstIdx = i; }
    }
    hof.members.splice(worstIdx, 1);
  }
}

// Échantillon sans remise de `n` membres (ou tous si le HoF en a moins) —
// évite de rejouer l'intégralité du HoF à chaque individu à chaque
// génération, ce qui exploserait le temps de calcul.
export function sampleHallOfFame(hof, n) {
  if (hof.members.length <= n) return hof.members;
  const pool = [...hof.members];
  const sample = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    sample.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return sample;
}
