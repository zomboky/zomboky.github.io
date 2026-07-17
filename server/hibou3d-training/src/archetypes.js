'use strict';
// Archétypes humains fixes — anti-overfitting (voir Phase 5 du plan). Un bot
// évolué en self-play pur peut développer une stratégie qui ne bat QUE
// lui-même ; ces 4 profils simulent des styles de jeu humain typiques et
// entrent dans le calcul du fitness pour garder le bot exploitable/dangereux
// contre de vrais joueurs, pas seulement contre sa propre lignée.
const deg = Math.PI / 180;

export const ARCHETYPES = {
  rusher: {
    // Fonce tout droit, tire de près, ne fuit jamais.
    aiTickInterval: 0.35, aimConeRad: 8 * deg, reactionDelay: 0.5, leadFactor: 0.3,
    throttleCap: 1.0, evadeLifeThreshold: 1, breakChance: 0, jinkPeriod: 0, fireDist: 120,
    extendDist: 20, extendClimb: 15, jinkAmplitude: 0.3, breakPerpWeight: 1.0, aggressionBias: 0.2,
  },
  sniper: {
    // Tir longue portée, esquive beaucoup, garde ses distances.
    aiTickInterval: 0.2, aimConeRad: 2 * deg, reactionDelay: 0.3, leadFactor: 1.0,
    throttleCap: 0.85, evadeLifeThreshold: 5, breakChance: 0.7, jinkPeriod: 0.7, fireDist: 280,
    extendDist: 45, extendClimb: 30, jinkAmplitude: 0.5, breakPerpWeight: 1.1, aggressionBias: -0.1,
  },
  acrobat: {
    // Manœuvres imprévisibles, jink agressif, esquive systématique.
    aiTickInterval: 0.25, aimConeRad: 6 * deg, reactionDelay: 0.35, leadFactor: 0.6,
    throttleCap: 0.95, evadeLifeThreshold: 4, breakChance: 0.9, jinkPeriod: 0.35, fireDist: 180,
    extendDist: 25, extendClimb: 20, jinkAmplitude: 0.7, breakPerpWeight: 1.3, aggressionBias: -0.2,
  },
  newbie: {
    // Réactions lentes, visée imprécise : joueur débutant typique. Essentiel
    // pour garantir que le bot évolué sait toujours punir un adversaire faible.
    aiTickInterval: 0.7, aimConeRad: 14 * deg, reactionDelay: 1.0, leadFactor: 0,
    throttleCap: 0.7, evadeLifeThreshold: 3, breakChance: 0.1, jinkPeriod: 0, fireDist: 150,
    extendDist: 30, extendClimb: 25, jinkAmplitude: 0.3, breakPerpWeight: 1.0, aggressionBias: 0,
  },
};

export const ARCHETYPE_NAMES = Object.keys(ARCHETYPES);
