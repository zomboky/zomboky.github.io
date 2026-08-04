# Harnais de parité du terrain

Première étape du **lot 3** (`PLAN_GODOT.md` §5.4), et le plan la place **avant tout
le reste du lot** : elle conditionne la suite. Échantillonne `terrainHeight()` sur
10 000 points dans les deux implémentations — l'originale JavaScript et le portage
GDScript — puis compare.

## Ce que ce harnais cherche vraiment

`hashNoise()` fait :

```js
const n = Math.sin(ix * 127.1 + iz * 311.7 + terrainSeed * 17.3) * 43758.5453;
return n - Math.floor(n);
```

L'amplification par 43 758,5453 est le principe même de ce hash — et c'est aussi
son danger. Un écart de quelques ULP entre deux implémentations de `sin()` (V8
contre la libm de GDScript, ou natif contre WebAssembly) ne donne pas « à peu
près » la même valeur : il donne une valeur **complètement différente**, donc un
relief entièrement autre. Un tel échec serait franc, pas marginal.

C'est la raison d'être du seuil serré, et du repli prévu au plan si le harnais
échouait : remplacer `Math.sin` par un hash entier déterministe **des deux côtés**,
`docs/hibou-3d.html` compris.

## Résultat

**Aucune divergence.** Le repli n'est pas nécessaire.

| Mesure | Écart max |
|---|---|
| Altitude (relief de -21,5 à +489,0 u) | **1,0 × 10⁻⁹ u** |
| Altitude, écart moyen | 4,6 × 10⁻¹¹ u |
| Masque de forêt | 3,6 × 10⁻¹² |
| Pics de montagne (semis) | 2,8 × 10⁻¹⁴ |
| Tracé et forme des rivières | **0 — exact** |

Les rivières sortent exactes parce que `mulberry32` est de l'arithmétique entière
32 bits : il n'y a rien à y perdre. Les pics et les altitudes gardent un résidu de
l'ordre de l'epsilon du float64 accumulé, sans commune mesure avec ce qu'une
divergence du hash produirait.

## Lancer

```bash
node tools/terrain-parity/check_drift.mjs    # la transcription est-elle à jour ?
node tools/terrain-parity/run_js.mjs         # trace de référence → out/trace_js.json
(cd godot/hibou3d && ../../godot-tool/godot --headless \
    --script res://tools/terrain_parity.gd)  # trace du portage  → out/trace_godot.json
node tools/terrain-parity/compare.mjs        # verdict
```

## Précision : deux pièges rencontrés

1. **`JSON.stringify` de Godot arrondit à 15 chiffres significatifs** et ne fait pas
   d'aller-retour exact. Or c'est précisément la dernière décimale qu'on mesure ici.
   Les tableaux de flottants sont donc transportés en **base64 de float64 bruts**.
2. **`Buffer.from(b64, 'base64').buffer` renvoie le pool partagé de Node**, pas la
   tranche : sans passer par `byteOffset` et `byteLength`, on compare de la mémoire
   voisine au lieu des données. Ce bug a d'abord fait croire à 256 pics au lieu de 10.

## Ce qui reste à vérifier plus tard

Ce harnais compare **JavaScript ↔ GDScript natif**. Il ne compare pas encore
**natif ↔ WebAssembly**, l'autre divergence redoutée au §5.4 (Emscripten peut
embarquer sa propre implémentation de `sin`). À faire au lot 12, quand l'export web
sera outillé pour ressortir une trace.

Enjeu réel : depuis la décision « Godot seulement » (§12.3), le multijoueur n'a plus
besoin d'une parité bit-à-bit avec le client Three.js. Ce qui compte désormais est
que **tous les clients Godot voient le même sol** — donc que natif et WebAssembly
coïncident entre eux.
