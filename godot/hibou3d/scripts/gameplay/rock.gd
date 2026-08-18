class_name Rock
extends Node3D
## Un rocher de tempête — port de `newRock()` / `updateRocks()`
## (docs/hibou-3d.html lignes 1385-1450). PLAN_GODOT.md §9 lot 8.
##
## C'est le **danger réel** de la tempête : de vrais cailloux low-poly qui tombent
## tout autour du joueur, accélèrent en chute, sont emportés par le vent — et
## tuent net au contact, quel que soit le nombre de vies.
##
## Le maillage est un **icosaèdre subdivisé une fois, taillé au bruit**. Three.js
## fournit `IcosahedronGeometry` ; Godot n'a que des sphères UV, dont les pôles et
## les quadrilatères ne ressemblent en rien à un galet. La géométrie est donc
## construite ici, en quatre variantes bâties une seule fois pour tout le jeu.

const RADIUS := 1.7
## Nombre de variantes de taille. Le bruit dépend de la POSITION du sommet : deux
## sommets confondus reçoivent donc la même perturbation et la facette reste
## fermée, sans qu'on ait besoin d'une géométrie indexée.
const VARIANTS := 4

const COLORS: Array[Color] = [
	Color(0x5b / 255.0, 0x54 / 255.0, 0x4c / 255.0),
	Color(0x4a / 255.0, 0x42 / 255.0, 0x3a / 255.0),
]

## Chute accélérée jusqu'à une vitesse terminale.
const FALL_ACCEL := 14.0
const FALL_MAX := 46.0
## Conversion force du vent → dérive horizontale, en unités par seconde.
const WIND_DRIFT := 3.5

static var _meshes: Array[ArrayMesh] = []
static var _materials: Array[StandardMaterial3D] = []

var active := false
## Échelle tirée à l'apparition. Elle pilote à la fois la taille visuelle, le
## rayon de contact et la hauteur à laquelle le rocher touche le sol.
var rock_scale := 1.0

var _fall_speed := 0.0
var _spin := Vector3.ZERO

@onready var _mesh: MeshInstance3D = %Mesh
@onready var _contact: Area3D = %Contact
@onready var _shape: CollisionShape3D = %Shape


func _ready() -> void:
	_build_shared_resources()
	_mesh.mesh = _meshes[randi() % _meshes.size()]
	_mesh.material_override = _materials[randi() % _materials.size()]
	# Chaque rocher a son propre rayon de contact (il dépend de son échelle) : la
	# forme ne peut pas être partagée entre instances, contrairement au maillage.
	_shape.shape = SphereShape3D.new()
	set_active(false)


func set_active(value: bool) -> void:
	active = value
	visible = value
	_contact.monitorable = value


## Fait tomber un rocher autour du hibou — port de `newRock()`.
## [param owl_collide_radius] : le gabarit du hibou, mesuré sur son modèle réel.
func spawn(owl_pos: Vector3, velocity: Vector3, owl_collide_radius: float) -> void:
	# La pluie de cailloux couvre une large zone tout AUTOUR du hibou, et pas
	# seulement devant : la tempête doit être une menace où qu'on regarde.
	var lead := randf_range(0.8, 3.2)
	position = Vector3(
		owl_pos.x + velocity.x * lead + randf_range(-220.0, 220.0),
		minf(FlightModel.ARENA_CENTER.y + FlightModel.ARENA_RADIUS_Y * 0.95,
			owl_pos.y + randf_range(55.0, 110.0)),
		owl_pos.z + velocity.z * lead + randf_range(-220.0, 220.0))
	rock_scale = randf_range(1.4, 3.4)
	scale = Vector3.ONE * rock_scale
	rotation = Vector3(randf_range(0.0, TAU), randf_range(0.0, TAU), randf_range(0.0, TAU))
	_fall_speed = randf_range(16.0, 24.0)
	_spin = Vector3(randf_range(-2.5, 2.5), randf_range(-2.5, 2.5), randf_range(-2.5, 2.5))

	# Le rayon de contact suit l'échelle. Il est porté par le rocher et non par la
	# sonde du hibou (même partage qu'au lot 7), et inclut donc le gabarit du hibou.
	var sphere: SphereShape3D = _shape.shape
	sphere.radius = (RADIUS * rock_scale + owl_collide_radius + 0.6) / rock_scale
	set_active(true)


## Un pas de chute. Rend `false` quand le rocher a touché le sol et doit être
## retiré — la gerbe de poussière de l'impact viendra avec les effets (lot 9).
func step(delta: float, storm_active: bool, wind_angle: float, wind_force: float,
		ground_y: Callable) -> bool:
	_fall_speed = minf(_fall_speed + FALL_ACCEL * delta, FALL_MAX)
	position.y -= _fall_speed * delta
	if storm_active:
		position.x += cos(wind_angle) * wind_force * WIND_DRIFT * delta
		position.z += sin(wind_angle) * wind_force * WIND_DRIFT * delta
	rotation += _spin * delta
	return position.y - rock_scale * 0.4 >= ground_y.call(position.x, position.z)


# ══════════════════════════════════════════════════════════════════════════
#  Géométrie
# ══════════════════════════════════════════════════════════════════════════

static func _build_shared_resources() -> void:
	if not _meshes.is_empty():
		return
	for variant in VARIANTS:
		_meshes.append(_carved_icosphere(variant))
	for color in COLORS:
		var material := StandardMaterial3D.new()
		material.albedo_color = color
		material.roughness = 1.0
		_materials.append(material)


## Icosaèdre subdivisé une fois (80 facettes), projeté sur la sphère unité puis
## **taillé** : chaque sommet est repoussé d'un facteur tiré d'un bruit de sa
## propre position, et légèrement aplati sur Y — un galet, pas une boule.
##
## Le maillage est produit **non indexé**, une normale par facette : c'est ce qui
## donne le rendu à facettes du `flatShading: true` de Three.js, que Godot n'expose
## pas comme un interrupteur de matériau.
static func _carved_icosphere(variant: int) -> ArrayMesh:
	var vertices := PackedVector3Array()
	var normals := PackedVector3Array()
	for face in _icosphere_faces():
		var carved: Array[Vector3] = []
		for corner in face:
			carved.append(_carve(corner, variant))
		var face_normal := (carved[1] - carved[0]).cross(carved[2] - carved[0]).normalized()
		for corner in carved:
			vertices.append(corner)
			normals.append(face_normal)

	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_NORMAL] = normals
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return mesh


## La perturbation, fonction de la seule position du sommet — c'est ce qui garantit
## que deux sommets confondus de facettes voisines bougent ensemble.
static func _carve(unit: Vector3, variant: int) -> Vector3:
	var n := 0.72 + 0.5 * Terrain.value_noise(
		unit.x * 2.1 + variant * 37.7,
		unit.y * 2.3 + unit.z * 1.7)
	return Vector3(unit.x * n, unit.y * n * 0.85, unit.z * n)


## Les 80 facettes de l'icosaèdre subdivisé une fois, sommets sur la sphère unité.
static func _icosphere_faces() -> Array:
	var t := (1.0 + sqrt(5.0)) / 2.0
	var base: Array[Vector3] = [
		Vector3(-1, t, 0), Vector3(1, t, 0), Vector3(-1, -t, 0), Vector3(1, -t, 0),
		Vector3(0, -1, t), Vector3(0, 1, t), Vector3(0, -1, -t), Vector3(0, 1, -t),
		Vector3(t, 0, -1), Vector3(t, 0, 1), Vector3(-t, 0, -1), Vector3(-t, 0, 1),
	]
	for i in base.size():
		base[i] = base[i].normalized()
	const INDICES := [
		0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11,
		1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
		3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9,
		4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1,
	]
	var faces := []
	for f in range(0, INDICES.size(), 3):
		var a: Vector3 = base[INDICES[f]]
		var b: Vector3 = base[INDICES[f + 1]]
		var c: Vector3 = base[INDICES[f + 2]]
		# Une subdivision : chaque facette donne quatre facettes, les milieux
		# d'arêtes étant reprojetés sur la sphère.
		var ab := ((a + b) * 0.5).normalized()
		var bc := ((b + c) * 0.5).normalized()
		var ca := ((c + a) * 0.5).normalized()
		faces.append([a, ab, ca])
		faces.append([ab, b, bc])
		faces.append([ca, bc, c])
		faces.append([ab, bc, ca])
	return faces
