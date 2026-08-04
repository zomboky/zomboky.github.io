class_name Clouds
extends Node3D
## Nuages low-poly — port de `makeClouds()` / `updateClouds()` (docs/hibou-3d.html).
##
## Instanciés, dérive lente, recyclés en bord de carte. Purement décoratifs : s'ils
## manquent, le jeu tourne sans repli.
##
## Les paliers d'opacité sont des **groupes séparés** et non une propriété par
## instance : un `MultiMesh` partage un matériau pour toutes ses instances, donc la
## transparence ne peut varier qu'entre groupes. C'est la même contrainte que
## `InstancedMesh` en Three.js, et le jeu d'origine la contourne déjà ainsi.

const CLOUD_COUNT := 64
const CLOUD_SPREAD := Terrain.ARENA_RADIUS_XZ * 0.85  ## zone de semis
const CLOUD_WRAP := Terrain.ARENA_RADIUS_XZ * 0.92    ## bord de recyclage de la dérive
const OPACITY_TIERS := [0.35, 0.65, 0.92]             ## léger / moyen / dense
const CLOUD_HEIGHT := 6.0                             ## hauteur normalisée du modèle

const MODELS := [
	"res://assets/models/cloud1.glb",
	"res://assets/models/cloud2.glb",
	"res://assets/models/cloud3.glb",
]

## Le jeu Three.js sème les nuages avec `Math.random()`. Ils sont purement
## décoratifs, mais un semis semé rend un bug de rendu reproductible.
const CLOUD_SEED := 40213377

## Un groupe d'instances partageant un palier d'opacité.
class Layer extends RefCounted:
	var instances: Array[MultiMeshInstance3D] = []
	var positions := PackedFloat32Array()  ## x, y, z par nuage
	var yaws := PackedFloat32Array()
	var scales := PackedFloat32Array()
	var speeds := PackedFloat32Array()

var _layers: Array[Layer] = []
var _rng := Rng.new(CLOUD_SEED)

## Vent de tempête, renseigné par le lot 8. Au repos, une brise constante.
var storm_active := false
var storm_wind_angle := 0.0
var storm_wind_force := 0.0


func _ready() -> void:
	rebuild()


func rebuild() -> void:
	for child in get_children():
		child.queue_free()
	_layers.clear()
	_rng.seed(CLOUD_SEED)

	var per_type := ceili(float(CLOUD_COUNT) / MODELS.size())
	for path in MODELS:
		var model: Node3D = load(path).instantiate()
		var holder := Node3D.new()
		add_child(holder)
		holder.add_child(model)
		ModelUtils.normalize(holder, model, Vector3.AXIS_Y, CLOUD_HEIGHT, false)
		var parts := MultiMeshBuilder.collect_parts(holder)

		for tier in OPACITY_TIERS.size():
			var count := roundi(float(per_type) / OPACITY_TIERS.size())
			if count <= 0:
				continue
			_layers.append(_make_layer(parts, count, OPACITY_TIERS[tier]))
		holder.queue_free()


func _make_layer(parts: Array[MultiMeshBuilder.Part], count: int, opacity: float) -> Layer:
	var layer := Layer.new()
	var transforms: Array[Transform3D] = []
	for _i in count:
		var position := _pick_position()
		var scale := _rng.range_f(2.4, 6.5)
		var yaw := _rng.range_f(0.0, TAU)
		layer.positions.append_array(PackedFloat32Array([position.x, position.y, position.z]))
		layer.yaws.append(yaw)
		layer.scales.append(scale)
		layer.speeds.append(_rng.range_f(1.2, 3.2))
		transforms.append(Transform3D(Basis(Vector3.UP, yaw).scaled(Vector3.ONE * scale), position))

	# Les nuages ne portent pas d'ombre : ils sont au-dessus de tout, et une ombre
	# de nuage sur 4 500 u de terrain gaspillerait la carte d'ombre.
	layer.instances = MultiMeshBuilder.build(self, parts, transforms, _make_material(opacity), false)
	return layer


func _make_material(opacity: float) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(1.0, 1.0, 1.0, opacity)
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	# Sans cela, les nuages semi-transparents se masquent entre eux selon l'ordre
	# de rendu et non selon la profondeur — artefacts de tri très visibles en vol.
	material.no_depth_test = false
	material.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	material.roughness = 1.0
	return material


## ~60 % des nuages se concentrent près de l'anneau de montagnes, le reste est
## dispersé sur toute l'arène — sinon le ciel se vide au loin.
func _pick_position() -> Vector3:
	if _rng.next() < 0.6:
		var angle := _rng.range_f(0.0, TAU)
		var dist := _rng.range_f(Terrain.ARENA_RADIUS_XZ * 0.65, Terrain.ARENA_RADIUS_XZ * 1.05)
		return Vector3(cos(angle) * dist, _rng.range_f(110.0, 260.0), sin(angle) * dist)
	return Vector3(
		_rng.range_f(-CLOUD_SPREAD, CLOUD_SPREAD),
		_rng.range_f(95.0, 240.0),
		_rng.range_f(-CLOUD_SPREAD, CLOUD_SPREAD))


func _process(delta: float) -> void:
	var wind_x := cos(storm_wind_angle) * storm_wind_force * 6.0 if storm_active else 1.0
	var wind_z := sin(storm_wind_angle) * storm_wind_force * 6.0 if storm_active else 0.3

	for layer in _layers:
		var count := layer.speeds.size()
		for i in count:
			var speed := layer.speeds[i]
			var x := layer.positions[i * 3] + wind_x * speed * delta
			var z := layer.positions[i * 3 + 2] + wind_z * speed * delta
			# Recyclage en bord de carte : le nuage réapparaît du côté opposé.
			if x > CLOUD_WRAP:
				x = -CLOUD_WRAP
			elif x < -CLOUD_WRAP:
				x = CLOUD_WRAP
			if z > CLOUD_WRAP:
				z = -CLOUD_WRAP
			elif z < -CLOUD_WRAP:
				z = CLOUD_WRAP
			layer.positions[i * 3] = x
			layer.positions[i * 3 + 2] = z

			var transform := Transform3D(
				Basis(Vector3.UP, layer.yaws[i]).scaled(Vector3.ONE * layer.scales[i]),
				Vector3(x, layer.positions[i * 3 + 1], z))
			for instance in layer.instances:
				var part_local: Transform3D = instance.get_meta("part_local")
				instance.multimesh.set_instance_transform(i, transform * part_local)
