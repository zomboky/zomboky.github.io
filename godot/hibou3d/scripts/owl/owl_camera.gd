class_name OwlCamera
extends Camera3D
## Caméra de poursuite, rigidement attachée au hibou.
##
## Elle est enfant direct du hibou : elle hérite donc de **toute** son orientation,
## roulis compris. C'est ce qui fait qu'un tonneau fait tourner l'image, et non
## qu'on regarde le hibou tourner — le port conserve ce choix tel quel.
##
## Anti-clipping (PLAN_GODOT.md §6.1) : le jeu Three.js échantillonne 10 points sur
## le segment hibou→caméra pour rapprocher la caméra quand un arbre ou le relief
## bloque la vue. Le réflexe Godot serait un `SpringArm3D`, mais il s'appuie sur le
## serveur physique, or il n'y a **aucun corps physique** dans ce portage
## (décision A, §4.2) : ni terrain, ni arbres. On garde donc l'échantillonnage
## analytique, activé au lot 4 quand la forêt existera.

## Position locale de la caméra par rapport au hibou : légèrement en hauteur, en arrière.
const LOCAL_OFFSET := Vector3(0, 2, 6.5)
## Distance mini si un obstacle bloque la vue — la caméra se rapproche, ne traverse pas.
const MIN_DIST := 2.5
## Nombre de points testés sur le segment hibou→caméra.
const CLIP_SAMPLES := 10

const FOV_BASE := 70.0
## Élargissement maximal du champ à pleine vitesse. La sensation de vitesse est
## volontairement exagérée : c'est un choix de game feel du jeu d'origine.
const FOV_SPEED_GAIN := 14.0
## Bonus de champ pendant un bonus de vitesse.
const FOV_BOOST := 5.0
## Vitesse de convergence du champ vers sa cible (s⁻¹).
const FOV_RESPONSE := 6.0

## Vue arrière (clic droit) : la caméra passe DEVANT le hibou et regarde vers
## l'arrière — le hibou reste au centre de l'image, comme en vue avant.
var look_back := false
## Activé au lot 4, quand la forêt et le terrain existent.
var clipping_enabled := false

## Rappel fournissant la hauteur de sol effective en (x, z). Injecté au lot 3.
var ground_height: Callable = Callable()
## Rappel indiquant si un point monde est dans le feuillage d'un arbre. Injecté au lot 4.
var point_in_tree: Callable = Callable()


func _ready() -> void:
	fov = FOV_BASE
	near = 0.1
	# La lune est à 2 400 u et les étoiles entre 1 700 et 2 500 : le plan lointain
	# doit les englober, sinon le ciel se vide en vol haut.
	far = 3200.0
	position = LOCAL_OFFSET


## À appeler une fois par frame de rendu (pas par pas de physique : c'est cosmétique).
## [param speed_ratio] : vitesse rapportée à `MAX_SPEED`, dans [0, 1].
func update_camera(delta: float, speed_ratio: float, speed_buff: bool = false) -> void:
	_update_clip()
	var target_fov := FOV_BASE + speed_ratio * speed_ratio * FOV_SPEED_GAIN
	if speed_buff:
		target_fov += FOV_BOOST
	fov += (target_fov - fov) * minf(1.0, FOV_RESPONSE * delta)


func _update_clip() -> void:
	var offset := LOCAL_OFFSET
	if look_back:
		offset.z = -offset.z
	var max_dist := offset.length()
	var safe_dist := max_dist

	if clipping_enabled:
		var owl := get_parent() as Node3D
		var dir := owl.global_transform.basis * offset.normalized()
		for i in range(1, CLIP_SAMPLES + 1):
			var t := (float(i) / CLIP_SAMPLES) * max_dist
			var point := owl.global_position + dir * t
			if _blocked(point):
				# On recule d'une demi-unité avant l'obstacle plutôt que de s'arrêter
				# dessus : la caméra ne doit pas raser le feuillage non plus.
				safe_dist = maxf(MIN_DIST, t - 0.5)
				break

	position = offset.normalized() * safe_dist
	# Demi-tour d'orientation en vue arrière.
	rotation = Vector3(0, PI if look_back else 0.0, 0)


func _blocked(point: Vector3) -> bool:
	if point_in_tree.is_valid() and point_in_tree.call(point):
		return true
	if ground_height.is_valid() and point.y < float(ground_height.call(point.x, point.z)) + 0.4:
		return true
	return false


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("look_back"):
		look_back = true
	elif event.is_action_released("look_back"):
		look_back = false
