class_name Bear
extends Node3D
## Un ours — port de `newBear()` / `updateBears()` (docs/hibou-3d.html lignes
## 3172-3358). PLAN_GODOT.md §9 lot 7.
##
## L'ours n'est pas un poursuivant bête : il **anticipe** (il vise là où le hibou
## sera dans `lead` secondes, pas là où il est), il **dérive** (une composante
## aléatoire renouvelée toutes les 0,5 à 2 s, pour ne pas converger en ligne
## parfaite), et il charge par une séquence lisible — traque, préparation
## télégraphiée en rouge, bond en ligne **figée**, récupération. Cette ligne figée
## est ce qui rend la charge esquivable : le joueur qui vire serré au bon moment
## la voit passer à côté.
##
## L'orientation passe par `look_at(..., use_model_front = true)` : la convention
## `Object3D.lookAt` de Three.js oriente le **+Z** de l'objet vers la cible, et
## c'est précisément ce que fait ce troisième argument en Godot. Le modèle n'a donc
## besoin d'aucun demi-tour, contrairement au hibou (§5.1).

## Échelle visuelle du modèle, une fois normalisé sur une hauteur de 1 u.
const SCALE := 2.2
## Contact « mangé » : `COLLECT_RADIUS + 1` en JS. Porté par l'`Area3D` de l'ours,
## que sonde le `PickupArea` ponctuel du hibou (décision B, §4.2).
const CONTACT_RADIUS := 4.0

const LUNGE_RANGE := 38.0   ## distance de déclenchement de la charge
const LUNGE_SPEED := 31.0   ## vitesse de charge : plus vite que la croisière du hibou
const PACK_DIST := 16.0     ## distance de répulsion entre ours (comportement de meute)

## Immunité après apparition, **en frames** (comme en JS) : sans elle, un ours qui
## naît sur la trajectoire tue dans la seconde qui suit.
const SPAWN_GRACE := 90

const MENACE_COLOR := Color(0xff / 255.0, 0x22 / 255.0, 0x11 / 255.0)
## Diamètre du halo de menace **dans le repère de `Visual`** : il est donc multiplié
## par l'échelle courante de l'ours, exactement comme le sprite enfant du JS.
const MENACE_SIZE := 1.6

const MODEL_SCENE := preload("res://assets/models/bear.glb")

enum Mode { STALK, WINDUP, LUNGE, RECOVER }

## Vrai tant que l'ours est en jeu. Les ours sont **mis en réserve** plutôt que
## détruits (voir `BearPack`) : c'est ce drapeau, et non la présence du nœud, qui
## dit s'il compte dans l'effectif.
var active := false

var mode: Mode = Mode.STALK
var spawn_grace := 0

var _life := 0
var _speed_base := 0.0
var _lead := 0.0
var _drift := Vector3.ZERO
var _drift_timer := 0.0
var _mode_timer := 0.0
var _lunge_cooldown := 0.0
var _lunge_dir := Vector3.ZERO
var _bob := 0.0
var _spawn_pulse := 0.0
var _menace_opacity := 0.0

@onready var _visual: Node3D = %Visual
@onready var _inner: Node3D = %Inner
@onready var _menace: Glow = %Menace
@onready var _contact: Area3D = %Contact


func _ready() -> void:
	var model: Node3D = MODEL_SCENE.instantiate()
	_inner.add_child(model)
	ModelUtils.normalize(_inner, model, Vector3.AXIS_Y, 1.0, false)
	for mesh in _mesh_instances(model):
		mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	_menace.glow_color = MENACE_COLOR
	_menace.glow_size = MENACE_SIZE
	_menace.glow_opacity = 0.0
	set_active(false)


## Met l'ours en jeu (ou en réserve). Un ours en réserve est invisible et son
## `Area3D` cesse d'être détectable : il ne peut plus ni être vu ni mordre.
func set_active(value: bool) -> void:
	active = value
	visible = value
	_contact.monitorable = value


## Fait naître l'ours près du hibou — port du corps de `newBear()`.
## [param round_time] pilote la rampe de difficulté, [param score] la vitesse.
## [param moon] : sous une lune, l'ours est plus rapide et vit moins longtemps —
## un pic bref et violent, là où un ours ordinaire est une menace qui dure.
func spawn(owl_pos: Vector3, velocity: Vector3, round_time: float, score: int,
		ramp_time: float, ground_y: Callable,
		moon: WorldEvents.Moon = WorldEvents.Moon.NONE) -> void:
	# Une fois sur deux, l'ours apparaît DEVANT le hibou, sur sa trajectoire :
	# fuir tout droit, c'est foncer dans les prochains.
	var dir: Vector3
	if randf() < 0.5 and velocity.length_squared() > 4.0:
		dir = velocity.normalized().rotated(Vector3.UP, randf_range(-0.7, 0.7))
		dir.y = clampf(dir.y + randf_range(-0.3, 0.3), -0.5, 0.5)
		dir = dir.normalized()
	else:
		var angle := randf_range(0.0, TAU)
		var elev := randf_range(-0.4, 0.4)
		dir = Vector3(cos(angle) * cos(elev), sin(elev), sin(angle) * cos(elev))

	var pos := owl_pos + dir * randf_range(42.0, 65.0)
	# Jamais au-delà de la muraille : le tirage est rabattu dans l'ellipsoïde.
	var offset := pos - FlightModel.ARENA_CENTER
	var f := FlightModel.ellipsoid_factor(pos)
	if f > 1.0:
		offset *= 0.95 / f
	pos = FlightModel.ARENA_CENTER + offset
	pos.y = maxf(
		ground_y.call(pos.x, pos.z) + 2.5,
		minf(pos.y, FlightModel.ARENA_CENTER.y + FlightModel.ARENA_RADIUS_Y * 0.55))
	position = pos

	# Rampe de début de partie : les premiers ours sont plus lents et chargent
	# moins souvent, puis rejoignent la pleine intensité en `ramp_time` secondes.
	# Les lunes, elles, sont des pics à pleine intensité d'emblée : la rampe ne
	# s'applique pas, sans quoi l'événement n'aurait aucun mordant en début de partie.
	var ramp: float = minf(round_time / ramp_time, 1.0)
	var under_moon := moon != WorldEvents.Moon.NONE
	var speed_ramp := 1.0 if under_moon else lerpf(0.55, 1.0, ramp)

	match moon:
		WorldEvents.Moon.BLOOD:
			_life = roundi(randf_range(400.0, 900.0))
			_speed_base = (22.0 + minf(score * 0.15, 10.0)) * speed_ramp
		WorldEvents.Moon.FULL:
			_life = roundi(randf_range(300.0, 600.0))
			_speed_base = (16.0 + minf(score * 0.15, 10.0)) * speed_ramp
		_:
			_life = roundi(randf_range(1000.0, 2000.0))
			_speed_base = (11.0 + minf(score * 0.15, 10.0)) * speed_ramp
	_lead = randf_range(0.5, 1.5)
	_drift = Vector3.ZERO
	_drift_timer = 0.0
	mode = Mode.STALK
	_mode_timer = 0.0
	_lunge_cooldown = randf_range(1.5, 3.5) + (1.0 - speed_ramp) * 2.0
	_lunge_dir = Vector3.ZERO
	_bob = randf_range(0.0, TAU)
	# L'ours « éclot » : il naît écrasé et reprend sa taille en une vingtaine de
	# frames, ce qui signale une apparition sans la rendre brutale.
	_spawn_pulse = 1.0
	spawn_grace = SPAWN_GRACE
	_menace_opacity = 0.0
	_apply_visual_scale(1.0)
	set_active(true)


## Un pas d'IA. Rend `false` quand l'ours a fini sa vie et doit être retiré.
##
## [param others] sert à la seule répulsion de meute ; [param slow_mul] vaut 0,3
## sous le bonus ❄️, 1 sinon.
func step(delta: float, owl_pos: Vector3, velocity: Vector3, slow_mul: float,
		others: Array[Bear], ground_y: Callable) -> bool:
	_life -= 1
	if _life <= 0:
		return false
	if spawn_grace > 0:
		spawn_grace -= 1
	_bob += 0.12
	if _spawn_pulse > 0.0:
		_spawn_pulse = maxf(0.0, _spawn_pulse - 0.05)

	var dist := position.distance_to(owl_pos)

	# Dérive : une cible légèrement décalée, renouvelée par à-coups. Sans elle,
	# tous les ours convergeraient sur la même ligne parfaite.
	_drift_timer -= delta
	if _drift_timer <= 0.0:
		_drift_timer = randf_range(0.5, 2.0)
		_drift = Vector3(randf_range(-1.0, 1.0), randf_range(-0.6, 0.6), randf_range(-1.0, 1.0)) \
			.normalized() * randf_range(2.0, 9.0)
	# Poursuite avec ANTICIPATION, réévaluée à chaque frame : l'ours coupe la
	# trajectoire au lieu de suivre bêtement.
	var aim := owl_pos + velocity * _lead + _drift

	var speed := _speed_base * slow_mul
	var move := aim - position

	_mode_timer -= delta
	_lunge_cooldown -= delta
	match mode:
		Mode.STALK:
			if dist < LUNGE_RANGE and _lunge_cooldown <= 0.0 and spawn_grace <= 0:
				mode = Mode.WINDUP
				_mode_timer = 0.45
		Mode.WINDUP:
			speed *= 0.25  # se ramasse sur lui-même avant de bondir
			if _mode_timer <= 0.0:
				mode = Mode.LUNGE
				_mode_timer = 0.85
				_lunge_dir = (aim - position).normalized()
		Mode.LUNGE:
			speed = maxf(LUNGE_SPEED, _speed_base * 1.5) * slow_mul
			# Direction FIGÉE au départ du bond : c'est ce qui la rend esquivable.
			move = _lunge_dir
			if _mode_timer <= 0.0:
				mode = Mode.RECOVER
				_mode_timer = 1.1
				_lunge_cooldown = randf_range(2.2, 4.0)
		Mode.RECOVER:
			speed *= 0.45
			if _mode_timer <= 0.0:
				mode = Mode.STALK

	_update_menace()

	# Esprit de meute : répulsion douce entre ours proches — plutôt que de
	# s'agglutiner sur la même trajectoire, ils s'écartent et encerclent.
	if mode != Mode.LUNGE:
		var separation := Vector3.ZERO
		for other in others:
			if other == self or not other.active:
				continue
			var away := position - other.position
			var sd := away.length()
			if sd > 1e-3 and sd < PACK_DIST:
				separation += away * ((1.0 - sd / PACK_DIST) / sd)
		if separation.length_squared() > 1e-6 and move.length_squared() > 1e-6:
			move = (move.normalized() + separation.normalized() * 0.65).normalized()

	var d := move.length()
	if d <= 0.0:
		d = 1.0
	position += move * (speed * delta / d)
	position.y += sin(_bob) * 0.02
	# Jamais sous le terrain (les ours volants restent des ours polis).
	position.y = maxf(position.y, ground_y.call(position.x, position.z) + 1.2)

	# Le modèle regarde dans sa direction de déplacement. `look_at` refuse une
	# direction colinéaire à la verticale : dans ce cas, on garde le cap précédent.
	if move.length_squared() > 1e-6:
		var target := position + move
		if absf(move.normalized().dot(Vector3.UP)) < 0.999:
			look_at(target, Vector3.UP, true)
	return true


## Télégraphe visuel : halo rouge pulsé pendant la préparation, atténué pendant la
## charge, éteint le reste du temps — et un ours qui « gonfle » avant de bondir.
func _update_menace() -> void:
	var target := 0.0
	match mode:
		Mode.WINDUP:
			target = 0.85 + 0.15 * sin(_bob * 4.0)
		Mode.LUNGE:
			target = 0.55
	_menace_opacity = lerpf(_menace_opacity, target, 0.25)
	_menace.set_opacity(_menace_opacity)

	var menace := 1.0
	if mode == Mode.WINDUP:
		menace = 1.25
	elif mode == Mode.LUNGE:
		menace = 1.12
	_apply_visual_scale(menace)


func _apply_visual_scale(menace: float) -> void:
	_visual.scale = Vector3.ONE * (SCALE * (1.0 - _spawn_pulse * 0.6) * menace)


static func _mesh_instances(root: Node) -> Array[MeshInstance3D]:
	var out: Array[MeshInstance3D] = []
	if root is MeshInstance3D:
		out.append(root)
	for child in root.get_children():
		out.append_array(_mesh_instances(child))
	return out
