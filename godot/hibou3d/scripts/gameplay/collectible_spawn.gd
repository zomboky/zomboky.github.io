class_name CollectibleSpawn
extends RefCounted
## Où faire apparaître un ramassable — port de `collectibleSpawnPos()`
## (docs/hibou-3d.html lignes 3017-3039). PLAN_GODOT.md §9 lot 7.
##
## Semées au hasard dans tout le volume, les branches étaient introuvables depuis
## l'élargissement de l'arène (×5). Le tirage est donc doublement biaisé : **devant**
## le hibou (dans son cône de route, deux fois sur trois) et **vers le sol** (la
## récolte tire naturellement le vol vers le bas, là où il y a du risque). Un
## tirage qui sortirait près de la muraille est rabattu vers le centre.
##
## Fonction pure : elle prend la position et la vitesse du hibou, rend un point.
## Le sol lui est fourni en `Callable` plutôt que lu sur l'autoload `Terrain` — un
## test headless (`--script`) n'a pas d'autoloads, et c'est ce paramètre qui rend
## la fonction vérifiable hors jeu.

## Plafond d'apparition. `ARENA_CENTER.y + ARENA_RADIUS_Y × ((130 − 35) / 210)` :
## l'ancienne altitude plafond (130 u dans une arène haute de 210) rapportée à la
## nouvelle `ARENA_RADIUS_Y`, comme en JS (ligne 597). Vaut 320 u.
const MAX_Y := FlightModel.ARENA_CENTER.y + FlightModel.ARENA_RADIUS_Y * ((130.0 - 35.0) / 210.0)

## Au-delà de cette fraction du rayon d'arène, le tirage est ramené vers le centre.
const ARENA_KEEP_IN := 0.85


## [param owl_pos] / [param velocity] : état courant du hibou — le tirage se fait
##   autour de lui, biaisé dans sa direction de vol.
## [param ground_y] : `func(x: float, z: float) -> float`, la hauteur de sol
##   effective (`Terrain.effective_ground_y` en jeu).
static func pick(owl_pos: Vector3, velocity: Vector3, min_dist: float, max_dist: float,
		ground_y: Callable) -> Vector3:
	var angle: float
	if velocity.length_squared() > 4.0 and randf() < 0.6:
		# Dans le cône de route : le ramassable se présente sur la trajectoire.
		angle = atan2(velocity.z, velocity.x) + randf_range(-0.9, 0.9)
	else:
		angle = randf_range(0.0, TAU)

	var dist := randf_range(min_dist, max_dist)
	var p := Vector3(
		owl_pos.x + cos(angle) * dist,
		0.0,
		owl_pos.z + sin(angle) * dist)

	# Rabattu vers le centre si le tirage sort de l'arène (près de la muraille).
	var center := FlightModel.ARENA_CENTER
	var f := Vector2(p.x - center.x, p.z - center.z).length() / FlightModel.ARENA_RADIUS_XZ
	if f > ARENA_KEEP_IN:
		p.x = center.x + (p.x - center.x) * ARENA_KEEP_IN / f
		p.z = center.z + (p.z - center.z) * ARENA_KEEP_IN / f

	var g: float = ground_y.call(p.x, p.z)
	if randf() < 0.6:
		p.y = g + randf_range(2.5, 14.0)                    # ras du sol / cime des arbres
	else:
		p.y = minf(g + randf_range(15.0, 70.0), MAX_Y)      # plein ciel
	return p
