class_name OwlFlight
extends Node
## Couche d'adaptation entre le modèle de vol et la scène.
##
## Le modèle (`scripts/flight/flight_model.gd`) est **pur** : il ne connaît ni
## nœud, ni caméra, ni entrées. Ce script fait les trois branchements qui lui
## manquent — lire les commandes, recopier l'état intégré sur le nœud `Owl`,
## relayer les sorties (battement d'ailes, champ de la caméra, secousse d'écran).
##
## Le vol tourne en `_physics_process` (pas fixe garanti, PLAN_GODOT.md §5.5) :
## c'est ce qui rend la trajectoire reproductible et le feeling identique quel que
## soit le framerate. Le cosmétique (caméra, champ) reste en `_process`.

## Émis à chaque pas de vol, pour les instruments du HUD (lot 6).
signal flight_updated(readout: FlightModel.Readout, speed_ratio: float)
## Émis quand le hibou touche le sol. La conséquence — game over en solo, respawn
## en multijoueur — est décidée par l'appelant, pas ici.
signal crashed_into_ground()
## Émis quand le hibou percute un arbre. Le vol casse net l'élan ; la perte de
## score et de nid viendra avec les règles de jeu (lot 7).
signal hit_tree()

## Délai avant qu'un second choc d'arbre puisse compter, en pas de physique.
## 45 frames à 60 Hz, comme le `TREE_HIT_COOLDOWN` du jeu d'origine.
const TREE_HIT_COOLDOWN := 45

## Sensibilité souris du joueur (réglable au lot 6, écran Réglages).
var mouse_sensitivity := 0.5
## Coupe le pilotage sans figer la scène : écrans de menu, cinématiques, mort.
var controls_enabled := true
## Test de présence dans un arbre, fourni par la forêt (lot 4). Vide, pas de collision.
var tree_test: Callable = Callable()

var model := FlightModel.new()

@onready var _owl: Owl = get_parent()

## Cumul des mouvements souris depuis le dernier pas de physique : Godot délivre
## la souris par évènements, le modèle la consomme une fois par pas.
var _mouse_motion := Vector2.ZERO
var _speed_ratio := 0.0
var _tree_cooldown := 0


func _ready() -> void:
	model.rng = Rng.new(randi())
	# Le vol interroge la fonction de terrain, pas un maillage : hauteur de sol
	# exacte en O(1), sans raycast ni corps physique (décision A, §4.2).
	model.ground_height = Terrain.effective_ground_y
	model.reset()
	_sync_owl()
	# `_ready()` remonte des enfants vers le parent : celui du hibou n'a donc pas
	# encore tourné, et son gabarit n'est pas mesuré. On attend son signal plutôt
	# que de lire une garde au sol encore à sa valeur de repli.
	_owl.ready.connect(_on_owl_ready)


func _on_owl_ready() -> void:
	model.ground_clear = _owl.ground_clear
	# Anti-clipping caméra contre le relief. Le test des arbres viendra avec la
	# forêt au lot 4 ; `point_in_tree` reste vide d'ici là et n'est pas appelé.
	_owl.camera.ground_height = Terrain.effective_ground_y
	_owl.camera.clipping_enabled = true


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_mouse_motion += (event as InputEventMouseMotion).relative
	elif event is InputEventMouseButton and (event as InputEventMouseButton).pressed:
		# Le pointer-lock web est géré nativement par Godot ; comme dans le
		# navigateur, il exige un geste utilisateur pour être demandé.
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event.is_action_pressed("pause"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


func _physics_process(delta: float) -> void:
	var input := FlightInput.new()
	if controls_enabled:
		input = FlightInput.from_player(_mouse_motion, mouse_sensitivity)
	_mouse_motion = Vector2.ZERO

	_speed_ratio = model.step(input, delta)
	_sync_owl()

	_owl.set_speed_ratio(_speed_ratio)
	flight_updated.emit(model.readout, _speed_ratio)
	if model.ground_crash:
		crashed_into_ground.emit()
	_check_tree_collision()


func _check_tree_collision() -> void:
	if _tree_cooldown > 0:
		_tree_cooldown -= 1
		return
	if not tree_test.is_valid() or not tree_test.call(model.position):
		return
	# Le choc casse net l'élan : le VECTEUR vitesse, pas seulement son module.
	model.velocity = Vector3.ZERO
	model.speed = 0.0
	_tree_cooldown = TREE_HIT_COOLDOWN
	hit_tree.emit()


func _process(delta: float) -> void:
	_owl.camera.update_camera(delta, _speed_ratio, model.speed_buff)


func _sync_owl() -> void:
	# Le modèle est la source de vérité : le nœud n'est qu'un affichage. On écrit
	# la transform d'un bloc plutôt que position/rotation séparément, pour ne pas
	# repasser par les angles d'Euler (ordre YXZ en Godot, XYZ en Three.js — §5.1).
	_owl.transform = Transform3D(Basis(model.orientation), model.position)
