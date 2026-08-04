class_name Owl
extends Node3D
## Le hibou : modèle visuel, battement d'ailes, et point d'attache de la caméra.
##
## ⚠️ Ce n'est **pas** un `CharacterBody3D` — décision A du PLAN_GODOT.md §4.2.
## Le hibou vole à 34 u/s sous un modèle aérodynamique maison intégré à la main ;
## le brancher sur le serveur physique de Godot coûterait cher, tunneliserait à
## ces vitesses, et ferait perdre le déterminisme dont dépend le multijoueur.
## Godot est ici un moteur de rendu et de scène, pas un moteur physique.
##
## Convention : l'avant du hibou est son axe local **-Z**, comme une caméra.
## Elle est commune à Three.js et à Godot (§5.1), donc rien à convertir.

## Lacet appliqué au modèle pour aligner sa face sur l'avant du jeu (-Z).
## `owl_wings.glb` regarde vers +Z → demi-tour. À ajuster ici si le modèle change.
const MODEL_YAW := PI
## Envergure visée, en unités monde. Le modèle est normalisé sur sa LARGEUR (X) et
## non sa longueur : il a les ailes largement déployées, une normalisation par la
## profondeur le rendrait démesuré.
const MODEL_WINGSPAN := 2.6
## Assiette légèrement piquée : posture de vol plutôt que de perchoir.
const MODEL_PITCH := -0.25

## Cadence de lecture du clip de battement, en multiplicateur de sa vitesse
## d'origine. Jamais nulle à l'arrêt : on garde un frémissement d'ailes.
const FLAP_CLIP_RATE_MIN := 0.25
const FLAP_CLIP_RATE_MAX := 3.2

## Gabarit de collision, dérivé de la boîte englobante réelle du modèle dans
## `_ready()`. Les valeurs ci-dessous ne sont que des replis : le corps qui touche
## vraiment le décor est bien plus étroit que les 2,6 d'envergure visuelle.
var ground_clear := 1.2
var collide_radius := 0.3
var hitbox := Vector3(2.6, 1.2, 1.6)

@onready var _inner: Node3D = %Inner
@onready var _model: Node3D = %Model
@onready var _anim: AnimationPlayer = %Model/AnimationPlayer


func _ready() -> void:
	_apply_feather_material()
	ModelUtils.normalize(_inner, _model, Vector3.AXIS_X, MODEL_WINGSPAN, false)
	_measure_collision_bounds()
	_start_flap()


## Applique la vitesse de vol au battement d'ailes.
## [param speed_ratio] : vitesse courante rapportée à `MAX_SPEED`, dans [0, 1].
func set_speed_ratio(speed_ratio: float) -> void:
	if _anim.current_animation.is_empty():
		return
	_anim.speed_scale = lerpf(FLAP_CLIP_RATE_MIN, FLAP_CLIP_RATE_MAX, clampf(speed_ratio, 0.0, 1.0))


func _apply_feather_material() -> void:
	# Le .glb n'embarque aucun matériau (modèle « ailes seules » sans export de
	# matière) : sans cela, Godot le rend en blanc mat. On lui donne la même teinte
	# plume que le jeu Three.js, en double face — les ailes sont des surfaces fines.
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(0x8a / 255.0, 0x6a / 255.0, 0x3f / 255.0)
	material.roughness = 0.85
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	for mesh in _mesh_instances(_model):
		mesh.material_override = material
		mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON


func _measure_collision_bounds() -> void:
	# Mesuré sur le hibou entier APRÈS normalisation : l'AABB inclut donc l'échelle,
	# le demi-tour du modèle et l'assiette piquée — comme le `Box3.setFromObject(norm)`
	# du jeu Three.js. La caméra, qui n'est pas un `VisualInstance3D`, est ignorée.
	var size := ModelUtils.aggregate_aabb(self).size
	ground_clear = size.y / 2.0 + 0.15
	collide_radius = minf(size.y, size.z) / 2.0
	hitbox = size


func _start_flap() -> void:
	var clips := _anim.get_animation_list()
	if clips.is_empty():
		push_warning("Le modèle du hibou n'a pas de clip d'animation : pas de battement d'ailes.")
		return
	_anim.play(clips[0])


static func _mesh_instances(root: Node) -> Array[MeshInstance3D]:
	var out: Array[MeshInstance3D] = []
	if root is MeshInstance3D:
		out.append(root)
	for child in root.get_children():
		out.append_array(_mesh_instances(child))
	return out
