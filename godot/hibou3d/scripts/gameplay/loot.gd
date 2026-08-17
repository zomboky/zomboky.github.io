class_name Loot
extends RefCounted
## Table des cadeaux et tirage pondéré — port de `LOOT_TYPES` et `rollLoot()`
## (docs/hibou-3d.html lignes 106-121). PLAN_GODOT.md §9 lot 7.
##
## Purement déclaratif : ni nœud, ni scène, ni état global — pas même `GameState`,
## dont la seule mention suffirait à rendre ce fichier incompilable en test
## headless `--script` (les autoloads n'y existent pas). C'est `SoloRound` qui
## applique le lot tiré ; ici on ne fait que le décrire et le tirer.
##
## Le tirage est isolé dans [method pick], qui prend son aléa en paramètre : c'est
## ce qui rend la table de poids vérifiable exactement plutôt que statistiquement.

## L'ordre et les poids sont ceux du jeu d'origine, et leur somme fait exactement
## 1,0 : le repli `TYPES[0]` de [method pick] n'est donc atteint qu'en cas
## d'arrondi flottant sur le dernier intervalle, jamais par construction.
const TYPES: Array[Dictionary] = [
	{ "id": "speed",      "emoji": "⚡", "text": "Vitesse Éclair !",   "weight": 0.35 },
	{ "id": "slow",       "emoji": "❄️", "text": "Ours Gelés !",       "weight": 0.25 },
	{ "id": "multi",      "emoji": "✨", "text": "Score x5 !",         "weight": 0.20 },
	{ "id": "life",       "emoji": "❤️", "text": "+1 Vie !",           "weight": 0.15 },
	{ "id": "invincible", "emoji": "🦉", "text": "HIBOU INVINCIBLE !", "weight": 0.05 },
]

## Durée des bonus temporaires, en secondes — `buffs.speed = 7` et consorts dans
## `applyGiftLoot()`. L'invincibilité dure plus longtemps : c'est le lot rare.
const BUFF_DURATION := 7.0
const INVINCIBLE_DURATION := 10.0


## Tire un lot au hasard, selon les poids de [constant TYPES].
static func roll() -> Dictionary:
	return pick(randf())


## Le tirage proprement dit, séparé de sa source d'aléa.
## [param r] : un tirage uniforme dans [0, 1).
static func pick(r: float) -> Dictionary:
	var cumul := 0.0
	for loot in TYPES:
		cumul += loot["weight"]
		if r < cumul:
			return loot
	return TYPES[0]
