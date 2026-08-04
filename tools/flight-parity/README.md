# Harnais de parité du modèle de vol

Recette bloquante du **lot 2** (`PLAN_GODOT.md` §9.2). Rejoue une séquence de
commandes scriptée de 30 s, à pas fixe de 1/60 s, dans les **deux** implémentations
du modèle de vol — l'originale JavaScript et le portage GDScript — puis compare les
trajectoires.

C'est ce lot qui décide si le portage « a le même goût ». Un modèle de vol
« presque » porté est une dette qui contamine l'IA du bot (lot 10b) et le
multijoueur (lot 11), qui en dépendent tous les deux directement.

## Lancer

```bash
node tools/flight-parity/check_drift.mjs      # la transcription JS est-elle toujours à jour ?
node tools/flight-parity/run_js.mjs           # trace de référence  → out/trace_js.json
(cd godot/hibou3d && ../../godot-tool/godot --headless \
    --script res://tools/flight_parity.gd)    # trace du portage    → out/trace_godot.json
node tools/flight-parity/compare.mjs          # verdict
```

`compare.mjs` sort en code 1 si un critère n'est pas tenu. La CI enchaîne les quatre.

## Critères

| Critère | Seuil |
|---|---|
| Écart de position final | < 1 % de la distance parcourue |
| Écart de position maximal sur le parcours | < 1 % de la distance parcourue |
| Décrochage déclenché des deux côtés | oui |
| Instant du premier décrochage | ± 0,2 s |

La recette **subjective** (« Rémi vole 5 minutes dans les deux versions et valide
le feeling ») reste à faire à la main : aucun harnais ne la remplace.

## Fichiers

| Fichier | Rôle |
|---|---|
| `sequence.json` | La séquence de commandes, partagée par les deux côtés. Décollage, virage serré, chandelle jusqu'au décrochage, récupération, rase-mottes. |
| `flight_reference.mjs` | Transcription verbatim de `updateFlight()` (docs/hibou-3d.html), exécutable sous Node. Importe le vrai Three.js du dépôt : `Vector3`, `Quaternion` et `MathUtils` sont donc exactement ceux du jeu. |
| `run_js.mjs` | Rejoue la séquence côté JavaScript. |
| `../../godot/hibou3d/tools/flight_parity.gd` | Rejoue la même séquence côté Godot. |
| `compare.mjs` | Compare et applique les critères. |
| `check_drift.mjs` | Empreinte SHA-256 du corps de `updateFlight()` : détecte une transcription devenue obsolète. |
| `source_fingerprint.json` | L'empreinte enregistrée. À regénérer **après** avoir repris la transcription, jamais pour faire taire l'alerte. |

## Pourquoi les deux traces ne sont pas identiques au bit près

Elles ne peuvent pas l'être, et c'est structurel : dans une compilation standard de
Godot, **`Vector3`, `Quaternion` et `Basis` stockent des flottants 32 bits**, alors
que le `number` de JavaScript — et le `float` scalaire de GDScript — sont des
64 bits. Mesuré :

```
Vector3.x      = 0.10000000149011611938   (float32)
float GDScript = 0.10000000000000000555   (float64)
```

L'écart naît donc dès le premier pas, à l'échelle de l'epsilon du float32
(~4 × 10⁻⁷ u sur une position de 16 u), puis se propage par intégration. Il reste
borné parce que le modèle est **dissipatif** : la traînée ramène continuellement le
système vers sa vitesse d'équilibre, au lieu d'amplifier les écarts.

Deux conséquences pour la suite du portage :

1. **Ce n'est pas une raison de compiler Godot en double précision.** Le coût
   (build custom, mémoire, perte de compatibilité des templates d'export web) est
   sans commune mesure avec un écart de 0,4 % sur 800 u de vol.
2. **Le calcul du terrain (lot 3) ne doit jamais transiter par un `Vector3`.**
   `terrain_height(x, z)` prend et rend des `float` scalaires, donc du 64 bits, et
   garde la précision de la version JavaScript. Router une coordonnée intermédiaire
   par un `Vector3` la tronquerait à 32 bits et ferait diverger le relief.
