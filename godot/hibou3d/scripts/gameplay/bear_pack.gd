class_name BearPack
extends Node3D
## La meute : combien d'ours, quand ils apparaissent, quand ils meurent — port de
## `bearTarget()` et de l'enveloppe de `updateBears()` (docs/hibou-3d.html lignes
## 3161-3358). PLAN_GODOT.md §9 lot 7.
##
## L'effectif visé monte de deux façons : avec le **temps** (rampe de début de
## partie, `BEAR_RAMP_TIME`) et avec le **score** (un ours de plus tous les 15
## points), plafonné à [constant SOLO_MAX]. Les ours ne meurent pas de blessure —
## ils ont une durée de vie — et sont remplacés dès qu'il en manque.
##
## Comme les branches, les ours sont **mis en réserve** plutôt que détruits, mais
## le vivier grandit à la demande : une partie qui reste à deux ours n'en instancie
## jamais dix.

## Plafond de l'effectif solo (`Math.min(..., 10)`). Les lunes du lot 8 le
## dépasseront (12 en pleine lune, 18 en lune de sang) : le vivier n'ayant pas de
## taille fixe, il suffira de relever ce plafond.
const SOLO_MAX := 10
## `BEAR_RAMP_TIME` : durée, en secondes, pour que la meute atteigne sa pleine
## intensité — vitesse des ours et fréquence des charges comprises.
const RAMP_TIME := 90.0
## L'effectif de départ d'une manche, `bears = [newBear(), newBear()]`.
const INITIAL_COUNT := 2
## Probabilité, **par frame**, qu'un ours manquant soit ajouté. Volontairement
## basse : le renfort arrive en traînant, il ne surgit pas d'un bloc.
const TRICKLE_CHANCE := 0.02

const BEAR_SCENE := preload("res://scenes/entities/bear.tscn")

## Hauteur de sol effective, `func(x, z) -> float`.
var ground_y: Callable

var _bears: Array[Bear] = []


## Effectif visé — port de `bearTarget()`, branche solo (le multijoueur le met à
## zéro, la campagne le fixe par niveau, les lunes le forcent : lots 8, 10 et 11).
##
## Statique : c'est une règle de difficulté, pas un état de scène, et cela la rend
## vérifiable sans monter le moindre nœud (`tests/test_gameplay.gd`).
static func target(round_time: float, score: int) -> int:
	var ramp: float = minf(round_time / RAMP_TIME, 1.0)
	var base := roundi(lerpf(1.0, 2.0, ramp))
	return mini(base + floori(score / 15.0), SOLO_MAX)


func active_count() -> int:
	var n := 0
	for bear in _bears:
		if bear.active:
			n += 1
	return n


## Remet la meute à son effectif de départ autour du hibou.
func reset(owl_pos: Vector3, velocity: Vector3) -> void:
	for bear in _bears:
		bear.set_active(false)
	for _i in INITIAL_COUNT:
		spawn_one(owl_pos, velocity, 0.0, 0)


## Fait apparaître un ours, en réactivant un nœud en réserve ou en en créant un.
func spawn_one(owl_pos: Vector3, velocity: Vector3, round_time: float, score: int) -> void:
	var bear := _take_idle()
	bear.spawn(owl_pos, velocity, round_time, score, RAMP_TIME, ground_y)


## Complète la meute jusqu'à l'effectif visé, d'un coup — appelé après une collecte
## de branche (`while (bears.length < bearTarget()) bears.push(newBear())` en JS :
## récolter attire les ours, c'est le prix du score).
func top_up(owl_pos: Vector3, velocity: Vector3, round_time: float, score: int) -> void:
	while active_count() < target(round_time, score):
		spawn_one(owl_pos, velocity, round_time, score)


## Un pas d'IA pour toute la meute, plus le renfort au compte-gouttes.
func step(delta: float, owl_pos: Vector3, velocity: Vector3, slow_mul: float,
		round_time: float, score: int) -> void:
	for bear in _bears:
		if not bear.active:
			continue
		if not bear.step(delta, owl_pos, velocity, slow_mul, _bears, ground_y):
			bear.set_active(false)
			if active_count() < target(round_time, score):
				spawn_one(owl_pos, velocity, round_time, score)
	if active_count() < target(round_time, score) and randf() < TRICKLE_CHANCE:
		spawn_one(owl_pos, velocity, round_time, score)


func _take_idle() -> Bear:
	for bear in _bears:
		if not bear.active:
			return bear
	var bear: Bear = BEAR_SCENE.instantiate()
	add_child(bear)
	_bears.append(bear)
	return bear
