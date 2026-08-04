// Extraction et empreinte de fonctions dans docs/hibou-3d.html.
//
// Partagé par les garde-fous anti-dérive des harnais de parité. Le portage
// recopie à la main des morceaux du jeu Three.js (`updateFlight`, les fonctions
// de terrain) dans des modules Node exécutables. Une copie manuelle pourrit dès
// que l'original bouge — et une copie pourrie transforme la recette de parité en
// tampon de complaisance : elle continuerait de passer pendant que le portage
// aurait cessé d'être fidèle.

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

/** Corps d'une fonction, délimité par appariement d'accolades à partir du marqueur. */
export function extractFunction(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`marqueur introuvable : "${marker}"`);
  let depth = 0;
  for (let i = start + marker.length - 1; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`accolade fermante introuvable pour "${marker}"`);
}

/** Empreinte SHA-256 de la concaténation des fonctions listées. */
export function fingerprint(gamePath, markers) {
  const source = readFileSync(gamePath, 'utf8');
  const bodies = markers.map(m => extractFunction(source, m));
  return {
    sha256: createHash('sha256').update(bodies.join('\n')).digest('hex'),
    lines: bodies.reduce((n, b) => n + b.split('\n').length, 0),
  };
}

/**
 * Vérifie l'empreinte enregistrée, ou la réenregistre si `--update` est passé.
 * Sort du processus : ce module est fait pour être la dernière chose qu'un
 * script de garde-fou appelle.
 */
export function checkOrUpdate({ gamePath, stampPath, markers, what, transcript, argv }) {
  const current = fingerprint(gamePath, markers);

  if (argv.includes('--update')) {
    writeFileSync(stampPath, JSON.stringify({
      note: `Empreinte de ${what} dans docs/hibou-3d.html au moment de la transcription vers ${transcript}. Régénérer avec --update APRÈS avoir repris la transcription, jamais pour faire taire l'alerte.`,
      markers,
      lines: current.lines,
      sha256: current.sha256,
    }, null, 2) + '\n');
    console.log(`Empreinte enregistrée : ${current.sha256} (${current.lines} lignes)`);
    process.exit(0);
  }

  const stamp = JSON.parse(readFileSync(stampPath, 'utf8'));
  if (stamp.sha256 === current.sha256) {
    console.log(`Référence à jour : ${what}, ${current.lines} lignes, ${current.sha256.slice(0, 12)}…`);
    process.exit(0);
  }

  console.error('');
  console.error(`${what} a changé dans docs/hibou-3d.html depuis la transcription.`);
  console.error(`  empreinte enregistrée : ${stamp.sha256}`);
  console.error(`  empreinte actuelle    : ${current.sha256}`);
  console.error('');
  console.error(`Reprendre ${transcript} pour refléter le changement, rejouer la`);
  console.error('parité, puis relancer ce script avec --update.');
  process.exit(1);
}
