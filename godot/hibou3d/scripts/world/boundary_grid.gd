class_name BoundaryGrid
extends MeshInstance3D
## Le quadrillage vert qui marque la limite de l'arène — port de
## `makeBoundaryGrid()` / `updateBoundaryGrid()` (docs/hibou-3d.html lignes
## 607-629). PLAN_GODOT.md §9 lot 7 (reporté du lot 5 : c'est un avertissement de
## bord de zone de jeu, pas un élément de ciel).
##
## Invisible tant qu'on vole au large, il apparaît en fondu dans les 22 dernières
## unités avant la muraille — juste assez tôt pour comprendre pourquoi le vol
## commence à être repoussé vers le centre (`FlightModel._apply_boundary()`).
##
## Three.js affiche n'importe quelle géométrie en fil de fer d'un simple
## `wireframe: true`. Godot n'a pas cet interrupteur hors mode debug : le maillage
## est donc construit en **lignes** (`PRIMITIVE_LINES`), une fois, aux mêmes 40×28
## subdivisions que la `SphereGeometry` d'origine — ce qui donne exactement le
## même quadrillage, parallèles et méridiens.

const SEGMENTS := 40
const RINGS := 28
const COLOR := Color(0x33 / 255.0, 0xff / 255.0, 0x66 / 255.0)
## Opacité maximale : le quadrillage reste translucide même collé à la muraille.
const MAX_OPACITY := 0.85

## Le hibou, câblé par `main.gd` — comme `sky.player` et `village.player`.
var player: Node3D

var _material: StandardMaterial3D


func _ready() -> void:
	mesh = _build_wireframe_sphere()
	scale = Vector3(FlightModel.ARENA_RADIUS_XZ, FlightModel.ARENA_RADIUS_Y,
		FlightModel.ARENA_RADIUS_XZ)
	position = FlightModel.ARENA_CENTER

	_material = StandardMaterial3D.new()
	_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_material.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	_material.disable_fog = true
	_material.albedo_color = Color(COLOR.r, COLOR.g, COLOR.b, 0.0)
	material_override = _material
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	visible = false


func _process(_delta: float) -> void:
	# Comme en JS : le quadrillage n'existe qu'en vol. Sur tous les autres écrans
	# il disparaît, plutôt que de rester affiché derrière un menu.
	if player == null or GameState.state != GameState.State.PLAY:
		visible = false
		return
	var f := FlightModel.ellipsoid_factor(player.global_position)
	var fade_fraction := FlightModel.BOUNDARY_FADE_DIST / FlightModel.ARENA_RADIUS_XZ
	var opacity := clampf((f - (1.0 - fade_fraction)) / fade_fraction, 0.0, MAX_OPACITY)
	_material.albedo_color = Color(COLOR.r, COLOR.g, COLOR.b, opacity)
	visible = opacity > 0.01


## Sphère unitaire en fil de fer : les parallèles (un anneau par rangée) et les
## méridiens (un segment vertical par colonne).
static func _build_wireframe_sphere() -> ArrayMesh:
	var points := PackedVector3Array()
	for ring in range(1, RINGS):
		var phi := PI * ring / float(RINGS)
		for segment in SEGMENTS:
			var a := TAU * segment / float(SEGMENTS)
			var b := TAU * (segment + 1) / float(SEGMENTS)
			points.append(_on_sphere(phi, a))
			points.append(_on_sphere(phi, b))
	for segment in SEGMENTS:
		var a := TAU * segment / float(SEGMENTS)
		for ring in RINGS:
			points.append(_on_sphere(PI * ring / float(RINGS), a))
			points.append(_on_sphere(PI * (ring + 1) / float(RINGS), a))

	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = points
	var array_mesh := ArrayMesh.new()
	array_mesh.add_surface_from_arrays(Mesh.PRIMITIVE_LINES, arrays)
	return array_mesh


static func _on_sphere(phi: float, theta: float) -> Vector3:
	return Vector3(sin(phi) * cos(theta), cos(phi), sin(phi) * sin(theta))
