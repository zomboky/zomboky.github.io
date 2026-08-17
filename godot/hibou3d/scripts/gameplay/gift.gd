class_name Gift
extends Node3D
## Le cadeau bonus et son pilier de lumière — port de `spawnGiftIfNeeded()`,
## `updateGift()` et `removeGift()` (docs/hibou-3d.html lignes 2844-2937).
## PLAN_GODOT.md §9 lot 7.
##
## L'ancien tirage (3 %/s, n'importe où dans une arène cinq fois plus grande)
## faisait qu'on n'en voyait jamais : l'apparition est **garantie** à intervalle
## régulier, près du joueur, et signalée par un pilier de lumière doré planté dans
## le sol — le phare qui rend le cadeau trouvable de très loin. S'il est distancé,
## c'est lui qui rejoint le hibou.
##
## Le nœud existe en permanence et se cache entre deux cadeaux : c'est le même
## choix que pour les branches et les ours (pas de création/destruction en vol).

const COLLECT_RADIUS := 3.5
const PILLAR_HEIGHT := 90.0
## Au-delà, le cadeau est réputé perdu et se replace devant le hibou.
const RELOCATE_DIST := 650.0

const GOLD := Color(0xff / 255.0, 0xd7 / 255.0, 0x66 / 255.0)

const FONT_EMOJI := preload("res://assets/fonts/NotoEmoji-Regular.ttf")
const LABEL_FONT_SIZE := 64
## `2,4 u` de sprite dans le JS, dont l'emoji occupe ~70 % (même règle que pour
## les branches, à l'échelle près).
const LABEL_PIXEL_SIZE := 0.036
const GLOW_SIZE := 7.0

## Vrai quand un cadeau est posé dans le monde et ramassable.
var active := false

var _cooldown := 0.0
var _w := 0.0
var _base_y := 0.0

## Hauteur de sol effective, `func(x, z) -> float`.
var ground_y: Callable

@onready var _label: Label3D = %Label
@onready var _glow: Glow = %Glow
@onready var _pillar: MeshInstance3D = %Pillar
@onready var _pickup: Area3D = %Pickup

var _pillar_material: StandardMaterial3D


func _ready() -> void:
	_label.font = FONT_EMOJI
	_label.font_size = LABEL_FONT_SIZE
	_label.pixel_size = LABEL_PIXEL_SIZE
	_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_label.shaded = false
	_label.double_sided = true
	_label.text = "🎁"
	_glow.glow_color = GOLD
	_glow.glow_size = GLOW_SIZE
	_glow.glow_opacity = 0.55
	_build_pillar()
	_set_active(false)


## Remet le compteur à zéro pour une nouvelle manche : premier cadeau garanti au
## bout de quelques secondes (`giftCooldown = rnd(8, 14)` dans `beginGame()`).
func reset() -> void:
	_set_active(false)
	_cooldown = randf_range(8.0, 14.0)


## Retire le cadeau ramassé et arme le suivant — `removeGift()`.
func consume() -> void:
	_set_active(false)
	_cooldown = randf_range(18.0, 28.0)


## Un pas : apparition si le délai est écoulé, puis animation et rapatriement.
## [param blocked] coupe l'apparition sans toucher au compte à rebours — c'est la
## place des lunes et des tempêtes du lot 8 (`moon.state !== 'none'`,
## `storm.active`), qui suspendent les cadeaux le temps de l'événement.
func step(delta: float, owl_pos: Vector3, velocity: Vector3, blocked: bool = false) -> void:
	if not active:
		if blocked:
			return
		_cooldown -= delta
		if _cooldown > 0.0:
			return
		_spawn(owl_pos, velocity)
		return

	# Distancé (le joueur est parti à l'autre bout) : le cadeau le rejoint.
	if position.distance_to(owl_pos) > RELOCATE_DIST:
		_place(CollectibleSpawn.pick(owl_pos, velocity, 80.0, 250.0, ground_y))

	_w += delta * 2.2
	position.y = _base_y + sin(_w) * 0.4
	# Le paquet et son halo respirent ensemble. On module leur **taille** plutôt
	# que l'échelle du nœud : en mode panneau d'affichage, c'est la géométrie qui
	# porte les dimensions, pas la transformation.
	var pulse := 1.0 + sin(_w * 1.7) * 0.12
	_label.pixel_size = LABEL_PIXEL_SIZE * pulse
	_glow.glow_size = GLOW_SIZE * pulse
	_pillar_material.albedo_color = Color(GOLD.r, GOLD.g, GOLD.b,
		0.16 + 0.1 * (0.5 + 0.5 * sin(_w * 1.3)))
	_pillar.rotation.y += delta * 0.6
	# Le pilier reste planté dans le sol pendant que le paquet flotte au-dessus :
	# on annule le ballotement du parent sur sa position locale.
	_pillar.position.y = ground_y.call(position.x, position.z) + PILLAR_HEIGHT / 2.0 - position.y


func _spawn(owl_pos: Vector3, velocity: Vector3) -> void:
	_place(CollectibleSpawn.pick(owl_pos, velocity, 70.0, 260.0, ground_y))
	_w = randf_range(0.0, TAU)
	_set_active(true)


func _place(spawn_position: Vector3) -> void:
	position = spawn_position
	_base_y = spawn_position.y


func _set_active(value: bool) -> void:
	active = value
	visible = value
	_pickup.monitorable = value


## Cylindre ouvert, additif et sans brouillard, planté dans le sol : le phare doré
## qu'on voit de l'autre bout de l'arène (`CylinderGeometry(0.9, 1.7, 90, 10)`).
func _build_pillar() -> void:
	var cylinder := CylinderMesh.new()
	cylinder.top_radius = 0.9
	cylinder.bottom_radius = 1.7
	cylinder.height = PILLAR_HEIGHT
	cylinder.radial_segments = 10
	cylinder.rings = 1
	cylinder.cap_top = false
	cylinder.cap_bottom = false
	_pillar.mesh = cylinder

	_pillar_material = StandardMaterial3D.new()
	_pillar_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_pillar_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_pillar_material.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	_pillar_material.cull_mode = BaseMaterial3D.CULL_DISABLED
	_pillar_material.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	_pillar_material.disable_fog = true
	_pillar_material.albedo_color = Color(GOLD.r, GOLD.g, GOLD.b, 0.22)
	_pillar.material_override = _pillar_material
	_pillar.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
