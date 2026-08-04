class_name OwlFlight
extends Node
## Pilote du hibou : lit les commandes, fait avancer le modèle de vol, applique le
## résultat au nœud `Owl`.
##
## ⚠️ **Provisoire — lot 1.** À ce stade seule la commande de rotation est branchée,
## pour recetter le hibou et la caméra sans dépendre du modèle aérodynamique. Le vol
## complet (11 étapes, forces, décrochage, virage coordonné) arrive au **lot 2** :
## ce script deviendra alors une simple couche d'adaptation autour de
## `scripts/flight/flight_model.gd`, qui reste pur et testable hors scène.

## Vitesses angulaires maximales commandées (rad/s) — voir §2.3 du plan.
const YAW_RATE := deg_to_rad(70.0)
const PITCH_RATE := deg_to_rad(55.0)
const ROLL_RATE := deg_to_rad(200.0)

## Sensibilité souris du joueur (réglable au lot 6, écran Réglages).
var mouse_sensitivity := 0.5

@onready var _owl: Owl = get_parent()

## Cumul des mouvements souris depuis le dernier pas de physique : Godot délivre la
## souris par évènements, le modèle de vol la consomme une fois par pas.
var _mouse_motion := Vector2.ZERO
## Poussée factice tant que le modèle de vol n'existe pas : pilote le battement d'ailes.
var _fake_speed_ratio := 0.0


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_mouse_motion += (event as InputEventMouseMotion).relative
	elif event is InputEventMouseButton and (event as InputEventMouseButton).pressed:
		# Le pointer-lock web est géré nativement par Godot ; il exige, comme dans le
		# navigateur, un geste utilisateur pour être demandé.
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event.is_action_pressed("pause"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


func _physics_process(delta: float) -> void:
	var input := FlightInput.from_player(_mouse_motion, mouse_sensitivity)
	_mouse_motion = Vector2.ZERO

	# Commandes en vitesse angulaire, appliquées dans le repère LOCAL du hibou.
	# `rotate_object_local` et non `rotate_x` : ce dernier tourne autour de l'axe
	# GLOBAL et donnerait un pilotage faux dès que le hibou n'est plus à plat (§5.2).
	_owl.rotate_object_local(Vector3.RIGHT, input.pitch * PITCH_RATE * delta)
	_owl.rotate_object_local(Vector3.UP, input.yaw * YAW_RATE * delta)
	_owl.rotate_object_local(Vector3.BACK, input.roll * ROLL_RATE * delta)
	# La souris est un pilotage fin : appliquée directement, sans inertie (crisp).
	_owl.rotate_object_local(Vector3.UP, input.mouse_dx)
	_owl.rotate_object_local(Vector3.RIGHT, -input.mouse_dy)

	# Provisoire : la « vitesse » ne sert qu'à animer le battement d'ailes et le champ
	# de la caméra tant que le modèle de vol n'est pas porté.
	var target := 1.0 if input.thrust_held else (0.0 if input.brake_held else _fake_speed_ratio)
	_fake_speed_ratio = move_toward(_fake_speed_ratio, target, delta * 0.5)
	_owl.set_speed_ratio(_fake_speed_ratio)


func _process(delta: float) -> void:
	_owl.camera.update_camera(delta, _fake_speed_ratio)
