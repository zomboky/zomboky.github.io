class_name MountainScenery
extends Node3D
## Massifs décoratifs — port de `makeMountainScenery()` (docs/hibou-3d.html).
##
## Des silhouettes déchiquetées plantées **sur** la muraille procédurale, tout
## autour de l'arène. Purement visuelles : la collision, c'est `terrain_height()`.
##
## Le semis passe malgré tout par un générateur semé et non par `randf()` : « pas
## la même carte d'un client à l'autre » casse l'immersion en multijoueur, même
## quand ce qui diffère ne touche à aucune règle du jeu.
const SCENERY_SEED := 51413379
const RING_COUNT := 22
const MODEL_HEIGHT := 150.0
## Enracinement dans la pente : sans cela les massifs flottent sur la crête.
const SINK := 18.0

const MODELS := [
	"res://assets/models/mountains.glb",
	"res://assets/models/mountain_group.glb",
]

var _rng := Rng.new(SCENERY_SEED)


func _ready() -> void:
	rebuild()


func rebuild() -> void:
	for child in get_children():
		child.queue_free()
	_rng.seed(SCENERY_SEED)

	var transforms: Array[Array] = []
	for _i in MODELS.size():
		transforms.append([] as Array[Transform3D])

	for i in RING_COUNT:
		var angle := (float(i) / RING_COUNT) * TAU + _rng.range_f(-0.14, 0.14)
		# À cheval sur la crête de la muraille.
		var dist := _rng.range_f(Terrain.ARENA_RADIUS_XZ * 0.98, Terrain.ARENA_RADIUS_XZ * 1.3)
		var x := cos(angle) * dist
		var z := sin(angle) * dist
		var yaw := _rng.range_f(0.0, TAU)
		var scale := _rng.range_f(1.3, 2.6)
		var basis := Basis(Vector3.UP, yaw).scaled(Vector3.ONE * scale)
		var position := Vector3(x, Terrain.terrain_height(x, z) - SINK, z)
		transforms[i % MODELS.size()].append(Transform3D(basis, position))

	for i in MODELS.size():
		var model: Node3D = load(MODELS[i]).instantiate()
		var holder := Node3D.new()
		add_child(holder)
		holder.add_child(model)
		ModelUtils.normalize(holder, model, Vector3.AXIS_Y, MODEL_HEIGHT, true)
		MultiMeshBuilder.build(self, MultiMeshBuilder.collect_parts(holder), transforms[i])
		holder.queue_free()
