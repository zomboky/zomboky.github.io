class_name Main
extends Node3D
## Racine du jeu : elle relie le monde, le hibou et les écrans.
##
## Le décor et le hibou sont écrits sans se connaître — la forêt ne sait pas qu'un
## hibou existe, le vol ne sait pas qu'il y a des arbres. C'est ici, et seulement
## ici, que les deux sont branchés l'un sur l'autre. Le lot 7 y ajoutera les
## règles de jeu (score, nid, ours, branches) ; pour l'instant `_begin_game()` ne
## fait que le sous-ensemble de `beginGame()` que le lot 6 peut tester : remettre
## l'état de manche à zéro et faire redécoller le hibou.

# Chemins explicites et non noms uniques (`%`) : ceux-ci ne se résolvent que dans
# la scène qui les déclare, or la forêt et le village appartiennent à `world.tscn`.
@onready var owl: Owl = $Owl
@onready var forest: Forest = $World/Forest
@onready var village: Village = $World/Village
@onready var sky: SkySystem = $Sky
@onready var hud: Hud = $UI/Hud
@onready var screens: Screens = $UI/Screens

@onready var _flight: OwlFlight = owl.get_node("Flight")


func _ready() -> void:
	# La caméra ne doit traverser ni le feuillage ni le relief. Le test des arbres
	# est analytique (cônes et cylindres) : il n'y a aucun corps physique à croiser.
	owl.camera.point_in_tree = forest.point_inside_tree
	_flight.tree_test = forest.point_inside_tree
	# Les lumières de feu de camp suivent le joueur : sept lumières pour une
	# trentaine de foyers, réassignées aux plus proches.
	village.player = owl
	# La lumière céleste unique (soleil/lune) reste proche du joueur, comme
	# `moonLight.position` dans le jeu d'origine.
	sky.player = owl

	hud.owl = owl
	hud.owl_flight = _flight
	screens.owl_flight = _flight
	screens.play_requested.connect(_begin_game)
	_flight.crashed_into_ground.connect(_on_crashed_into_ground)

	# Caché jusqu'au premier lancement de partie, comme `owlGroup.visible = false`
	# à la construction du jeu JS (ligne 1958) : l'écran d'accueil ne montre pas
	# un hibou déjà planté au centre de l'arène.
	owl.visible = false


## Sous-ensemble de `beginGame()` (ligne 6014) qui concerne l'état de manche et
## le redécollage — la régénération du monde (terrain/forêt/ours) reste au lot 7,
## `World` garde la carte construite au chargement.
func _begin_game() -> void:
	GameState.reset_round()
	_flight.model.reset()
	owl.visible = true
	GameState.change_state(GameState.State.PLAY)
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


## Port de `onGroundCrash()` (ligne 2791), sous-ensemble solo : contact du sol,
## game over immédiat (`lives` reste toujours à 1 tant que le lot 7 n'ajoute pas
## de vies supplémentaires ni de perte de score par étape).
func _on_crashed_into_ground() -> void:
	if GameState.state != GameState.State.PLAY:
		return
	GameState.best = maxi(GameState.best, GameState.score)
	owl.visible = false
	GameState.over_reason = "crash"
	GameState.change_state(GameState.State.OVER)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
