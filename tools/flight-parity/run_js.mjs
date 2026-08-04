// Rejoue la séquence de commandes avec la référence JavaScript et écrit la trace.
//
//   node tools/flight-parity/run_js.mjs [sortie.json]
//
// La trace est volontairement écrite dans le MÊME format que celle produite côté
// Godot (`godot/hibou3d/tools/flight_parity.gd`) : `compare.mjs` n'a alors rien à
// interpréter, il soustrait.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlightReference } from './flight_reference.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const seq = JSON.parse(readFileSync(resolve(here, 'sequence.json'), 'utf8'));
const outPath = process.argv[2] || resolve(here, 'out/trace_js.json');

/** Commandes en vigueur à l'instant t : le dernier segment commencé. */
function commandsAt(t) {
  let active = seq.segments[0];
  for (const s of seq.segments) {
    if (t >= s.t) active = s; else break;
  }
  return {
    pitch: active.pitch, yaw: active.yaw, roll: active.roll,
    thrust: active.thrust, brake: active.brake,
  };
}

const model = new FlightReference({
  rngSeed: seq.rng_seed,
  groundY: seq.ground_y,
  groundClear: seq.ground_clear,
});
model.reset(seq.start_position);

const dt = seq.dt;
const steps = Math.round(seq.duration / dt);
const samples = [];
let distance = 0;
let prev = model.position.clone();
let firstStallTime = null;

for (let i = 0; i < steps; i++) {
  const t = i * dt;
  model.step(commandsAt(t), dt);
  distance += model.position.distanceTo(prev);
  prev.copy(model.position);
  if (firstStallTime === null && model.stallMode) firstStallTime = t + dt;

  samples.push({
    t: t + dt,
    pos: [model.position.x, model.position.y, model.position.z],
    vel: [model.velocity.x, model.velocity.y, model.velocity.z],
    quat: [model.quaternion.x, model.quaternion.y, model.quaternion.z, model.quaternion.w],
    speed: model.speed,
    throttle: model.throttle,
    aoa: model.flight.aoa,
    stall: model.stallMode,
  });
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify({
  source: 'javascript',
  steps,
  distance,
  first_stall_time: firstStallTime,
  final_position: [model.position.x, model.position.y, model.position.z],
  samples,
}, null, 1));

console.log(`JS  : ${steps} pas, distance parcourue ${distance.toFixed(3)} u`);
console.log(`      position finale (${model.position.x.toFixed(4)}, ${model.position.y.toFixed(4)}, ${model.position.z.toFixed(4)})`);
console.log(`      premier décrochage à ${firstStallTime === null ? 'jamais' : firstStallTime.toFixed(3) + ' s'}`);
console.log(`      trace → ${outPath}`);
