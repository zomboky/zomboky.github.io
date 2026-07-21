// ══════════════════════════════════════════════════════════════════
//  Hibou 2D — moteur de monde (rooms, biomes, collisions)
// ══════════════════════════════════════════════════════════════════
// Boîte à outils SANS ÉTAT : pas de canvas/ctx ici (se charge avant le
// resize() du fichier principal), pas de sprites (les sprites pixel-art
// restent dans hibou-2d.html, qui les dessine). Ce fichier fournit juste
// les maths : PRNG seedé, tirage de biome, résolution de collisions
// cercle/rect, recherche de position de spawn libre, génération de la
// grille de grotte.
//
// IMPORTANT : script CLASSIQUE (pas un module), chargé via <script src>
// AVANT le script inline de hibou-2d.html. Les deux scripts partagent la
// même portée lexicale de haut niveau (let/const/function) — tout est
// donc enfermé dans une IIFE et UN SEUL global est exposé (window.HibouWorld)
// pour ne jamais entrer en collision avec les nombreux noms courts déjà
// utilisés par hibou-2d.html (rnd, dist, state, owl, bears...).
(function () {
  'use strict';

  // ── PRNG seedé (identique à celui de hibou-3d.html) ──────────────
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── Tirage pondéré du biome (utilisé uniquement pour un NOUVEAU voisin) ──
  const BIOME_WEIGHTS = [
    ['lac',    0.10],
    ['grotte', 0.20],
    ['foret',  0.35],
    ['champ',  0.35]
  ];
  function rollBiome(rngFn) {
    const rand = rngFn || Math.random;
    let r = rand(), cumul = 0;
    for (const [biome, w] of BIOME_WEIGHTS) {
      cumul += w;
      if (r < cumul) return biome;
    }
    return BIOME_WEIGHTS[BIOME_WEIGHTS.length - 1][0];
  }

  const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };
  function oppositeDir(dir) { return OPPOSITE[dir]; }

  // ── Collision cercle vs rect ──────────────────────────────────────
  // Convention : rect = {x, y, hw, hh} avec x,y = CENTRE (pas coin haut-gauche).
  function resolveCircleRect(entity, rect, radius) {
    const dx = entity.x - rect.x, dy = entity.y - rect.y;
    const cx = Math.max(-rect.hw, Math.min(rect.hw, dx));
    const cy = Math.max(-rect.hh, Math.min(rect.hh, dy));
    const nx = dx - cx, ny = dy - cy;
    const d = Math.hypot(nx, ny);
    if (d === 0) {
      // Centre de l'entité tombé pile dans le rect : pousser sur l'axe le moins pénétré.
      const penX = rect.hw + radius - Math.abs(dx);
      const penY = rect.hh + radius - Math.abs(dy);
      if (penX < penY) entity.x += dx < 0 ? -penX : penX;
      else              entity.y += dy < 0 ? -penY : penY;
      return true;
    }
    if (d < radius) {
      const k = (radius - d) / d;
      entity.x += nx * k; entity.y += ny * k;
      return true;
    }
    return false;
  }

  function resolveSolids(entity, radius, solids) {
    if (!solids || !solids.length) return false;
    let hit = false;
    for (const s of solids) {
      if (Math.abs(entity.x - s.x) > s.hw + radius) continue; // rejet grossier
      if (Math.abs(entity.y - s.y) > s.hh + radius) continue;
      if (resolveCircleRect(entity, s, radius)) hit = true;
    }
    return hit;
  }

  function isSpawnBlocked(x, y, solids, pad) {
    if (!solids) return false;
    for (const s of solids) {
      if (x > s.x - s.hw - pad && x < s.x + s.hw + pad &&
          y > s.y - s.hh - pad && y < s.y + s.hh + pad) return true;
    }
    return false;
  }

  function findSpawnPoint(rngFn, W, H, margin, solids, pad) {
    const rand = rngFn || Math.random;
    let x, y;
    for (let i = 0; i < 12; i++) {
      x = margin + rand() * (W - 2 * margin);
      y = margin + rand() * (H - 2 * margin);
      if (!isSpawnBlocked(x, y, solids, pad)) return { x, y };
    }
    return { x, y }; // repli : on accepte le dernier essai plutôt que boucler indéfiniment
  }

  // ── Génération procédurale de la grotte ──────────────────────────
  // Grille fixe 24x16 (auto-échelle à la taille du canvas). Corridor garanti
  // de 2 cellules de large du centre vers chaque bord (traversée garantie),
  // puis bruit d'automate cellulaire sur le reste pour un aspect organique,
  // puis flood-fill depuis le centre pour éliminer toute poche isolée.
  function generateCave(seed, W, H) {
    const rng  = mulberry32(seed);
    const cols = 24, rows = 16;
    const cellW = W / cols, cellH = H / rows;

    const wall   = [];
    const locked = []; // cellules de corridor : jamais réécrites par l'automate cellulaire
    for (let r = 0; r < rows; r++) {
      wall.push(new Array(cols).fill(true));
      locked.push(new Array(cols).fill(false));
    }

    const midR = rows >> 1, midC = cols >> 1;
    function carve(r0, c0, r1, c1) {
      for (let r = Math.max(0, r0); r <= Math.min(rows - 1, r1); r++) {
        for (let c = Math.max(0, c0); c <= Math.min(cols - 1, c1); c++) {
          wall[r][c] = false; locked[r][c] = true;
        }
      }
    }
    carve(0, midC - 1, rows - 1, midC);   // bande verticale (bras Nord + Sud)
    carve(midR - 1, 0, midR, cols - 1);   // bande horizontale (bras Ouest + Est)

    // Bruit initial 55% mur / 45% ouvert, hors corridors
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (locked[r][c]) continue;
        wall[r][c] = rng() < 0.55;
      }
    }

    function wallNeighbors(r, c) {
      let n = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) { n++; continue; } // hors-grille = mur
          if (wall[rr][cc]) n++;
        }
      }
      return n;
    }
    // 4 itérations de la règle "4-5" (lissage cellular automata classique)
    for (let iter = 0; iter < 4; iter++) {
      const next = wall.map(row => row.slice());
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (locked[r][c]) continue;
          next[r][c] = wallNeighbors(r, c) >= 5;
        }
      }
      for (let r = 0; r < rows; r++) wall[r] = next[r];
    }

    // Flood-fill (BFS) depuis le centre : toute cellule ouverte non atteinte redevient mur
    const reachable = wall.map(row => row.map(() => false));
    reachable[midR][midC] = true;
    const stackR = [midR], stackC = [midC];
    let qi = 0;
    while (qi < stackR.length) {
      const r = stackR[qi], c = stackC[qi]; qi++;
      const nb = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
      for (const [rr, cc] of nb) {
        if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
        if (wall[rr][cc] || reachable[rr][cc]) continue;
        reachable[rr][cc] = true;
        stackR.push(rr); stackC.push(cc);
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!wall[r][c] && !reachable[r][c]) wall[r][c] = true; // poche isolée -> scellée
      }
    }

    // Rects solides : seulement les cellules mur adjacentes à >=1 cellule ouverte
    // (la masse intérieure ne reçoit aucun rect, rien ne peut jamais l'atteindre).
    const solids    = [];
    const cellTone  = wall.map(row => row.map(() => 0));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!wall[r][c]) continue;
        cellTone[r][c] = Math.floor(rng() * 4);
        const nb = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
        let adjacentOpen = false;
        for (const [rr, cc] of nb) {
          if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
          if (!wall[rr][cc]) { adjacentOpen = true; break; }
        }
        if (adjacentOpen) {
          solids.push({ x: c * cellW + cellW / 2, y: r * cellH + cellH / 2, hw: cellW / 2, hh: cellH / 2 });
        }
      }
    }

    return { cols, rows, cellW, cellH, wall, cellTone, solids, reachable };
  }

  window.HibouWorld = {
    mulberry32,
    rollBiome,
    oppositeDir,
    resolveCircleRect,
    resolveSolids,
    isSpawnBlocked,
    findSpawnPoint,
    generateCave
  };
})();
