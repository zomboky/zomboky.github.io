'use strict';
// Boucle de match headless — deux owls s'affrontent avec leurs propres génomes
// (tuning), même orchestration que updateBot() (docs/hibou-3d.html
// L.4106-4119) mais généralisée à deux combattants symétriques et sans rendu.
import { createOwl, spawnOwlInArena, respawnOwl } from './owl-state.js';
import { updateAI } from './bot-ai.js';
import { updateFlight } from './flight.js';
import { updateFire, updateBullets, updateDamage } from './combat.js';
import { MP_RESPAWN_DELAY } from './constants.js';

const DT = 1 / 60;

function onDeath(victim, shooter, cause) {
  victim.alive = false;
  victim.velocity.set(0, 0, 0);
  victim.respawnTimer = MP_RESPAWN_DELAY;
  victim.stats.deaths++;
  shooter.stats.kills++;
  shooter.stats.damageDealt++;
}

// tuningA/tuningB : objets de 14 gènes (voir genome.js). options.duration : secondes simulées.
// Retourne { a: {kills,deaths,crashes,shotsFired,shotsHit,damageDealt,stateTime}, b: {...} }
export function simulateMatch(tuningA, tuningB, options = {}) {
  const duration = options.duration ?? 90;
  const a = createOwl('A', tuningA);
  const b = createOwl('B', tuningB);
  let simTime = 0;
  spawnOwlInArena(a, simTime);
  spawnOwlInArena(b, simTime);
  const bullets = [];

  const steps = Math.round(duration / DT);
  for (let i = 0; i < steps; i++) {
    simTime += DT;

    for (const [self, opponent] of [[a, b], [b, a]]) {
      if (!self.alive) {
        self.respawnTimer -= DT;
        if (self.respawnTimer <= 0) respawnOwl(self, opponent.obj.position, simTime);
        continue;
      }
      if (self.invul > 0) self.invul--;
      updateAI(self, opponent, DT);
      const crashed = updateFlight(self, self._flightInput, DT);
      self.throttle = Math.min(self.throttle, self._throttleCap);
      if (crashed === 'crash' && self.alive) {
        self.alive = false;
        self.velocity.set(0, 0, 0);
        self.respawnTimer = MP_RESPAWN_DELAY;
        self.stats.crashes++;
        self.stats.deaths++;
      }
      updateFire(self, bullets, DT);
    }

    updateBullets(bullets, a, b, DT, simTime, onDeath);
    updateDamage(a, DT, simTime);
    updateDamage(b, DT, simTime);
  }

  return { a: a.stats, b: b.stats, duration };
}
