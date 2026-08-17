class_name GameWorld
extends Node3D
## Le décor, et la seule chose qu'on lui demande de faire en cours de jeu : se
## régénérer. Port de la séquence `disposeWorldGeometry(); regenerateTerrainSeed();
## makeTerrain(); makeMountainScenery(); makeTrees(); makeBuildings();` qui ouvre
## `beginGame()` (docs/hibou-3d.html lignes 6023-6029). PLAN_GODOT.md §9 lot 7.
##
## **Chaque partie solo se joue sur une carte neuve** : nouveau bruit de relief,
## nouveaux pics, nouvelles rivières, nouvelle forêt, nouveaux hameaux. C'est ce
## qui empêche d'apprendre le terrain par cœur — et c'est aussi pourquoi le
## multijoueur, lui, restaure la carte canonique (`Terrain.restore_canonical()`,
## lot 11).
##
## Les nuages ne sont **pas** refaits : ils dérivent en boucle au-dessus de la
## carte sans en dépendre, et le jeu d'origine ne les reconstruit pas non plus.
##
## `class_name GameWorld` et non `World` : le nom court frôle `World2D`/`World3D`
## du moteur, et une collision de nom de classe se paie en erreurs de parsing
## obscures (déjà rencontré au lot 5 avec `Sky`).

@onready var terrain_mesh: TerrainMesh = $Terrain
@onready var forest: Forest = %Forest
@onready var mountains: MountainScenery = $Mountains
@onready var village: Village = %Village
@onready var boundary_grid: BoundaryGrid = %BoundaryGrid


## Nouvelle carte. Le **maillage** du terrain est reconstruit en tâche de fond
## (`rebuild_async`) : à 240 segments il fige le thread principal plusieurs
## secondes en WebAssembly, et le jeu d'origine, lui, bloquait franchement.
## Rien n'attend ce maillage pour être juste — la hauteur du sol vient de la
## fonction `Terrain.effective_ground_y`, exacte dès la première frame, aussi bien
## pour le vol que pour l'apparition des branches. Seul le relief **visible**
## rattrape son retard sur quelques frames.
func regenerate() -> void:
	Terrain.regenerate_seed()
	terrain_mesh.rebuild_async()
	mountains.rebuild()
	forest.rebuild()
	village.rebuild()
