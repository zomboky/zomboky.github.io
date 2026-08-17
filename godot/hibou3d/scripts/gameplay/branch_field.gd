class_name BranchField
extends Node3D
## Le champ de branches : un pool fixe de [constant COUNT] nœuds toujours vivants,
## recyclés au lieu d'être détruits — port de la liste `branches` et de la boucle
## `updateBranches()` (docs/hibou-3d.html lignes 3068-3115). PLAN_GODOT.md §9 lot 7.
##
## Ce nœud ne connaît **ni le score, ni le combo, ni le nid** : il place, anime et
## recycle des branches, rien de plus. Ce qu'une branche rapporte est décidé par
## `SoloRound`, qui détient les règles — même séparation qu'entre `FlightModel`
## (l'intégration) et `OwlFlight` (la scène).

## `BRANCH_COUNT` en JS : le champ en compte toujours autant, une branche ramassée
## étant immédiatement réattribuée ailleurs.
const COUNT := 14
## `BRANCH_SCORE_MULT` : une branche vaut 10 points par cran de combo, contre 1
## point par seconde de rase-mottes — la récolte doit rester la voie rentable.
const SCORE_MULT := 10

const BRANCH_SCENE := preload("res://scenes/entities/branch.tscn")

## Hauteur de sol effective, `func(x, z) -> float`. Fournie par l'appelant plutôt
## que lue sur l'autoload : c'est aussi ce qui rend le champ testable hors jeu.
var ground_y: Callable

var _branches: Array[Branch] = []


## Peuple le champ (première partie) puis redistribue tout autour du hibou —
## l'équivalent du `branches = Array.from({ length: BRANCH_COUNT }, newBranch)`
## de `beginGame()`, réutilisable d'une manche à l'autre.
func reset(owl_pos: Vector3, velocity: Vector3) -> void:
	while _branches.size() < COUNT:
		var branch: Branch = BRANCH_SCENE.instantiate()
		add_child(branch)
		_branches.append(branch)
	for branch in _branches:
		branch.reroll(owl_pos, velocity, ground_y)


## Un pas d'animation pour tout le champ : ballotement, respiration des halos,
## recyclage à distance, et renouvellement des branches pourries arrivées à terme.
func step(owl_pos: Vector3, velocity: Vector3) -> void:
	for branch in _branches:
		if branch.step(owl_pos, velocity, ground_y):
			branch.reroll(owl_pos, velocity, ground_y)


## Rend une branche ramassée au champ, sous une nouvelle identité et ailleurs.
func recycle(branch: Branch, owl_pos: Vector3, velocity: Vector3) -> void:
	branch.reroll(owl_pos, velocity, ground_y)
