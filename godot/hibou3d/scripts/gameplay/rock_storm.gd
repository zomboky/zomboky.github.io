class_name RockStorm
extends Node3D
## La pluie de cailloux d'une tempête : combien, à quel rythme, et le ménage quand
## la tempête retombe. Port de l'enveloppe de `updateRocks()` et du semis de
## `updateStorm()` (docs/hibou-3d.html lignes 1345-1352, 1412-1450).
## PLAN_GODOT.md §9 lot 8.
##
## Comme les branches et les ours (lot 7), les rochers sont **mis en réserve**
## plutôt que détruits — un vivier qui grandit à la demande jusqu'à
## [constant MAX]. Le contact avec le hibou n'est pas traité ici : c'est une règle
## de jeu, elle appartient à `SoloRound`.

const ROCK_SCENE := preload("res://scenes/entities/rock.tscn")

## `ROCK_MAX` en JS : au-delà, la tempête cesse d'en ajouter.
const MAX := 46
## Intervalle entre deux chutes, en secondes. Volontairement court : c'est une
## averse de cailloux, pas une pierre de temps en temps.
const SPAWN_INTERVAL := Vector2(0.12, 0.3)
## Délai avant le tout premier caillou d'une tempête.
const FIRST_SPAWN := 0.6

## Hauteur de sol effective, `func(x, z) -> float`.
var ground_y: Callable
## Gabarit de collision du hibou, mesuré sur son modèle (`Owl.collide_radius`).
var owl_collide_radius := 0.3

var _rocks: Array[Rock] = []
var _spawn_timer := 0.0


func active_count() -> int:
	var n := 0
	for rock in _rocks:
		if rock.active:
			n += 1
	return n


## Retire tous les rochers en vol — appelé à la fin d'une tempête et au début
## d'une partie (`deactivateStorm()` et `beginGame()` font tous deux le ménage).
func clear_all() -> void:
	for rock in _rocks:
		rock.set_active(false)
	_spawn_timer = FIRST_SPAWN


## Un pas : chute de tous les rochers en vol, puis semis d'un nouveau si la
## tempête souffle encore. Les rochers déjà tombés finissent leur course même
## après la fin de la tempête — ce sont eux qui n'ont plus de vent pour les pousser.
func step(delta: float, owl_pos: Vector3, velocity: Vector3, storm_active: bool,
		wind_angle: float, wind_force: float) -> void:
	for rock in _rocks:
		if not rock.active:
			continue
		if not rock.step(delta, storm_active, wind_angle, wind_force, ground_y):
			rock.set_active(false)

	if not storm_active:
		return
	_spawn_timer -= delta
	if _spawn_timer <= 0.0 and active_count() < MAX:
		_take_idle().spawn(owl_pos, velocity, owl_collide_radius)
		_spawn_timer = randf_range(SPAWN_INTERVAL.x, SPAWN_INTERVAL.y)


func _take_idle() -> Rock:
	for rock in _rocks:
		if not rock.active:
			return rock
	var rock: Rock = ROCK_SCENE.instantiate()
	add_child(rock)
	_rocks.append(rock)
	return rock
