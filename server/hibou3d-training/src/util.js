'use strict';
// Utilitaires partagés — extraits de docs/hibou-3d.html (L.83-96).
export const rnd = (a, b) => a + Math.random() * (b - a);

// PRNG déterministe (mulberry32) : garantit un terrain reproductible entre
// les matchs d'entraînement (essentiel — sinon le fitness varierait selon un
// terrain aléatoire au lieu du seul comportement du bot).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
