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
  // Grille fixe 24x16 (auto-échelle à la taille du canvas). Au lieu d'un bruit CA (qui, avec
  // le hors-grille compté comme mur, favorise systématiquement la survie des murs près des
  // BORDS et l'érosion vers du vide à l'intérieur — donnant un simple contour creux), on fait
  // CROÎTRE une seule caverne connexe depuis le centre par agrégation aléatoire (« Eden
  // growth ») : chaque cellule ouverte est forcément adjacente à une cellule déjà ouverte, donc
  // la connexité est garantie par construction, et la forme obtenue est organique et arrondie
  // (lobes), comme une vraie caverne — pas un simple cadre.
  function generateCave(seed, W, H) {
    const rng  = mulberry32(seed);
    const cols = 24, rows = 16;
    const cellW = W / cols, cellH = H / rows;

    const wall = [];
    for (let r = 0; r < rows; r++) wall.push(new Array(cols).fill(true));

    const midR = rows >> 1, midC = cols >> 1;
    const inGrid = (r, c) => r >= 0 && r < rows && c >= 0 && c < cols;
    function openCell(r, c) { if (inGrid(r, c)) wall[r][c] = false; }
    function isOpen(r, c) { return inGrid(r, c) && !wall[r][c]; }

    // 1) Amorce 2x2 au centre (garantit que le hibou, téléporté au centre exact à chaque
    //    transition, apparaît toujours en zone ouverte) puis croissance par agrégation
    //    aléatoire : à chaque étape, une cellule-frontière (mur adjacent à de l'ouvert) est
    //    choisie au hasard et ouverte, jusqu'à couvrir ~56% de la grille.
    const seedCells = [[midR, midC], [midR, midC - 1], [midR - 1, midC], [midR - 1, midC - 1]];
    seedCells.forEach(([r, c]) => openCell(r, c));

    const inFrontier = new Set();
    const frontier = [];
    function pushFrontier(r, c) {
      if (!inGrid(r, c) || !wall[r][c]) return;
      const key = r * cols + c;
      if (inFrontier.has(key)) return;
      inFrontier.add(key); frontier.push([r, c]);
    }
    seedCells.forEach(([r, c]) => {
      [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([rr, cc]) => pushFrontier(rr, cc));
    });

    const totalCells = cols * rows;
    const targetOpen = Math.floor(totalCells * 0.56);
    let openCount = seedCells.length;
    while (openCount < targetOpen && frontier.length) {
      const idx = Math.floor(rng() * frontier.length);
      const [r, c] = frontier[idx];
      frontier[idx] = frontier[frontier.length - 1]; frontier.pop();
      inFrontier.delete(r * cols + c);
      if (!wall[r][c]) continue; // déjà ouverte entre-temps (ajoutée 2x à la frontière)
      openCell(r, c); openCount++;
      [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([rr, cc]) => pushFrontier(rr, cc));
    }

    // 2) Garantit une sortie vers chacun des 4 bords (le hibou doit toujours pouvoir quitter la
    //    carte dans les 4 directions) : si la croissance organique n'a pas déjà atteint un bord,
    //    on tire une « tentacule » légèrement tortueuse depuis le point ouvert le plus proche.
    function nearestOpenTo(targetR, targetC) {
      let bestR = midR, bestC = midC, bestD = Infinity;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (wall[r][c]) continue;
          const d = Math.abs(r - targetR) + Math.abs(c - targetC);
          if (d < bestD) { bestD = d; bestR = r; bestC = c; }
        }
      }
      return [bestR, bestC];
    }
    function carveTendril(targetR, targetC) {
      let [r, c] = nearestOpenTo(targetR, targetC);
      let guard = 0;
      while ((r !== targetR || c !== targetC) && guard++ < 200) {
        if (r !== targetR && (c === targetC || rng() < 0.5)) r += r < targetR ? 1 : -1;
        else if (c !== targetC) c += c < targetC ? 1 : -1;
        if (rng() < 0.25) { r += rng() < 0.5 ? 1 : -1; } // légère déviation organique
        r = Math.max(0, Math.min(rows - 1, r)); c = Math.max(0, Math.min(cols - 1, c));
        openCell(r, c); openCell(r, c + 1); openCell(r + 1, c); // ~2 cellules de large
      }
    }
    let touchesN = false, touchesS = false, touchesW = false, touchesE = false;
    for (let c = 0; c < cols; c++) { if (isOpen(0, c)) touchesN = true; if (isOpen(rows - 1, c)) touchesS = true; }
    for (let r = 0; r < rows; r++) { if (isOpen(r, 0)) touchesW = true; if (isOpen(r, cols - 1)) touchesE = true; }
    if (!touchesN) carveTendril(0, midC);
    if (!touchesS) carveTendril(rows - 1, midC);
    if (!touchesW) carveTendril(midR, 0);
    if (!touchesE) carveTendril(midR, cols - 1);

    // 3) Filet de sécurité : la construction garantit déjà la connexité, mais on revérifie par
    //    flood-fill au cas où (coût négligeable, exécuté une seule fois par génération de carte).
    const reachable = wall.map(row => row.map(() => false));
    reachable[midR][midC] = true;
    const stackR = [midR], stackC = [midC];
    let qi = 0;
    while (qi < stackR.length) {
      const r = stackR[qi], c = stackC[qi]; qi++;
      [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([rr, cc]) => {
        if (!inGrid(rr, cc) || wall[rr][cc] || reachable[rr][cc]) return;
        reachable[rr][cc] = true;
        stackR.push(rr); stackC.push(cc);
      });
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!wall[r][c] && !reachable[r][c]) wall[r][c] = true; // poche isolée (ne devrait pas arriver) -> scellée
      }
    }

    // Rects solides : seulement les cellules mur adjacentes à >=1 cellule ouverte (bordure
    // visible façon référence) — la masse hors-caverne reste du vide, rien ne peut l'atteindre.
    const solids   = [];
    const cellTone = wall.map(row => row.map(() => 0)); // teinte du SABLE (cellules ouvertes)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!wall[r][c]) { cellTone[r][c] = Math.floor(rng() * 4); continue; }
        const adjacentOpen = isOpen(r - 1, c) || isOpen(r + 1, c) || isOpen(r, c - 1) || isOpen(r, c + 1);
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
