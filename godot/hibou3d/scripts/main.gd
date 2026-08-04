class_name Main
extends Node3D
## Racine du jeu : elle relie le monde et le hibou.
##
## Le décor et le hibou sont écrits sans se connaître — la forêt ne sait pas qu'un
## hibou existe, le vol ne sait pas qu'il y a des arbres. C'est ici, et seulement
## ici, que les deux sont branchés l'un sur l'autre. Le lot 6 y ajoutera la machine
## à états d'écrans, le lot 7 les règles de jeu.

# Chemins explicites et non noms uniques (`%`) : ceux-ci ne se résolvent que dans
# la scène qui les déclare, or la forêt et le village appartiennent à `world.tscn`.
@onready var owl: Owl = $Owl
@onready var forest: Forest = $World/Forest
@onready var village: Village = $World/Village
@onready var sky: SkySystem = $Sky


func _ready() -> void:
	var flight: OwlFlight = owl.get_node("Flight")
	# La caméra ne doit traverser ni le feuillage ni le relief. Le test des arbres
	# est analytique (cônes et cylindres) : il n'y a aucun corps physique à croiser.
	owl.camera.point_in_tree = forest.point_inside_tree
	flight.tree_test = forest.point_inside_tree
	# Les lumières de feu de camp suivent le joueur : sept lumières pour une
	# trentaine de foyers, réassignées aux plus proches.
	village.player = owl
	# La lumière céleste unique (soleil/lune) reste proche du joueur, comme
	# `moonLight.position` dans le jeu d'origine.
	sky.player = owl
