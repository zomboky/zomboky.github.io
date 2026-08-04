class_name Forest
extends Node3D
## Forêt — port de `makeTrees()` (docs/hibou-3d.html).
##
## 3 000 arbres placés sur le terrain par masque de bruit : denses dans les
## vallées, absents au-dessus de `TREE_LINE`, jamais dans les lacs ni sur les
## pentes raides. Rendus en `MultiMeshInstance3D` (§6.5).
##
## **Aucun arbre n'est un corps physique** (décision A, §4.2). 3 000 `StaticBody3D`
## seraient rédhibitoires en WebAssembly ; la collision passe par des cônes et des
## cylindres analytiques, de coût quasi nul, exactement comme dans le jeu d'origine.

const TREE_COUNT := 3000
## La forêt s'arrête avant les pentes de la muraille.
const TREE_SPREAD := Terrain.ARENA_RADIUS_XZ * 0.84
## Hauteur normalisée de tous les arbres, quelle que soit l'échelle du modèle source.
const TREE_HEIGHT := 9.0

## Essences et leur poids de tirage. L'ordre et les poids font partie du semis :
## les changer change la forêt à graine égale.
const SPECIES := [
	{ "model": "res://assets/models/pine1.glb", "weight": 0.38 },
	{ "model": "res://assets/models/pine2.glb", "weight": 0.30 },
	{ "model": "res://assets/models/birch.glb", "weight": 0.20 },
	{ "model": "res://assets/models/tree1.glb", "weight": 0.12 },
]

## Côté d'une cellule de la grille d'accélération, en unités monde. Doit rester
## grand devant le rayon d'un feuillage (~5 u) pour que chaque arbre ne tombe que
## dans une poignée de cellules.
const CELL_SIZE := 64.0

## Colliders, à plat : x, z, rayon de tronc, base et sommet du feuillage, rayon de
## feuillage, altitude du sol — sept valeurs par arbre. Un `Array[Dictionary]`
## coûterait sept recherches par arbre et par test, et il y a onze tests par frame
## (dix pour l'anti-clipping caméra, un pour la collision du hibou).
var _colliders := PackedFloat32Array()
## Grille uniforme : clé de cellule → indices d'arbres. Sans elle, chaque test
## balaierait les 3 000 arbres — 33 000 itérations par frame.
var _grid: Dictionary = {}

const STRIDE := 7
const F_X := 0
const F_Z := 1
const F_TRUNK_R := 2
const F_LEAF_BASE := 3
const F_LEAF_TOP := 4
const F_LEAF_R := 5
const F_GROUND_Y := 6


func _ready() -> void:
	rebuild()


## (Re)sème la forêt à partir de l'état courant de `Terrain`.
func rebuild() -> void:
	var started := Time.get_ticks_usec()
	for child in get_children():
		child.queue_free()
	_colliders = PackedFloat32Array()
	_grid.clear()

	var protos := _load_species()
	var transforms: Array[Array] = []
	for _i in SPECIES.size():
		transforms.append([] as Array[Transform3D])

	var placed := 0
	var attempts := 0
	while placed < TREE_COUNT and attempts < TREE_COUNT * 20:
		attempts += 1
		# L'ordre des tirages fait partie du semis, y compris les court-circuits
		# ci-dessous : un tirage consommé en trop décale toute la suite.
		var angle := Terrain.tree_rng.range_f(0.0, TAU)
		var r := sqrt(Terrain.tree_rng.next()) * TREE_SPREAD  # aire uniforme
		var x := cos(angle) * r
		var z := sin(angle) * r
		if r < 14.0:
			continue  # clairière de départ
		var h := Terrain.terrain_height(x, z)
		if h < Terrain.WATER_Y + 0.8:
			continue  # pas d'arbres dans les lacs
		if h > Terrain.TREE_LINE:
			continue  # au-dessus : roche et neige
		var slope := absf(Terrain.terrain_height(x + 2.0, z) - h) \
			+ absf(Terrain.terrain_height(x, z + 2.0) - h)
		if slope > 2.2:
			continue  # pentes raides : pas de forêt
		# Berge d'un lac : la forêt y descend même hors du masque.
		var near_shore := h < Terrain.WATER_Y + 5.0
		if not near_shore and Terrain.forest_density(x, z) < 0.42 \
				and Terrain.tree_rng.next() > 0.15:
			continue  # masque de forêt, avec 15 % d'arbres isolés

		var species := _pick_species()
		var scale := Terrain.tree_rng.range_f(0.7, 1.5)
		var yaw := Terrain.tree_rng.range_f(0.0, TAU)

		var basis := Basis(Vector3.UP, yaw).scaled(Vector3.ONE * scale)
		# Très légèrement enterré, pour épouser la pente.
		transforms[species].append(Transform3D(basis, Vector3(x, h - 0.15, z)))
		_append_collider(protos[species], x, z, h, scale)
		placed += 1

	for i in SPECIES.size():
		MultiMeshBuilder.build(self, protos[i]["parts"], transforms[i])

	_build_grid()
	for proto in protos:
		(proto["node"] as Node).queue_free()

	print("Forêt : %d arbres en %d essences, semés en %.0f ms" %
		[placed, SPECIES.size(), (Time.get_ticks_usec() - started) / 1000.0])


## Vrai si le point est dans le tronc ou le feuillage d'un arbre.
##
## Le feuillage est un cône qui se rétrécit vers le sommet ; sous sa base, seul le
## tronc, bien plus fin, peut toucher.
func point_inside_tree(p: Vector3) -> bool:
	var bucket: PackedInt32Array = _grid.get(_cell_key(p.x, p.z), PackedInt32Array())
	for index in bucket:
		var base := index * STRIDE
		var leaf_base := _colliders[base + F_LEAF_BASE]
		var leaf_top := _colliders[base + F_LEAF_TOP]
		var radius: float
		if p.y < leaf_base:
			radius = _colliders[base + F_TRUNK_R]
		elif p.y <= leaf_top:
			radius = _colliders[base + F_LEAF_R] * (1.0 - (p.y - leaf_base) / (leaf_top - leaf_base))
		else:
			continue
		var dx := p.x - _colliders[base + F_X]
		var dz := p.z - _colliders[base + F_Z]
		if dx * dx + dz * dz < radius * radius:
			return true
	return false


func tree_count() -> int:
	return _colliders.size() / STRIDE


## Point situé au cœur du feuillage de l'arbre [param index]. Sert aux tests et au
## débogage : c'est un point qui doit, par construction, être détecté en collision.
func tree_leaf_point(index: int) -> Vector3:
	var base := index * STRIDE
	return Vector3(
		_colliders[base + F_X],
		(_colliders[base + F_LEAF_BASE] + _colliders[base + F_LEAF_TOP]) / 2.0,
		_colliders[base + F_Z])


func _load_species() -> Array[Dictionary]:
	var protos: Array[Dictionary] = []
	for species in SPECIES:
		var model: Node3D = load(species["model"]).instantiate()
		# La normalisation lit des transforms globales : le modèle doit être dans
		# l'arbre. On le retire une fois ses pièces relevées.
		var holder := Node3D.new()
		add_child(holder)
		holder.add_child(model)
		ModelUtils.normalize(holder, model, Vector3.AXIS_Y, TREE_HEIGHT, true)
		var aabb := ModelUtils.aggregate_aabb(holder)
		protos.append({
			"node": holder,
			"parts": MultiMeshBuilder.collect_parts(holder),
			# Gabarit de collision estimé depuis la boîte englobante du modèle
			# normalisé, comme dans le jeu d'origine.
			"radius_xz": maxf(aabb.size.x, aabb.size.z) / 2.0,
		})
	return protos


func _pick_species() -> int:
	var pick := Terrain.tree_rng.next()
	for i in SPECIES.size():
		pick -= SPECIES[i]["weight"]
		if pick <= 0.0:
			return i
	return 0


func _append_collider(proto: Dictionary, x: float, z: float, h: float, scale: float) -> void:
	var radius_xz: float = proto["radius_xz"]
	_colliders.append_array(PackedFloat32Array([
		x, z,
		maxf(0.28, radius_xz * 0.14) * scale,   # tronc
		h + TREE_HEIGHT * 0.22 * scale,          # base du feuillage
		h + TREE_HEIGHT * scale,                 # sommet
		radius_xz * 0.72 * scale,                # rayon du feuillage
		h,
	]))


func _build_grid() -> void:
	for index in tree_count():
		var base := index * STRIDE
		var x := _colliders[base + F_X]
		var z := _colliders[base + F_Z]
		var reach := _colliders[base + F_LEAF_R]
		# Un arbre est inscrit dans toutes les cellules que son feuillage touche,
		# pour qu'une interrogation n'ait à regarder qu'une seule cellule.
		for cx in range(floori((x - reach) / CELL_SIZE), floori((x + reach) / CELL_SIZE) + 1):
			for cz in range(floori((z - reach) / CELL_SIZE), floori((z + reach) / CELL_SIZE) + 1):
				var key := cx * 100000 + cz
				if not _grid.has(key):
					_grid[key] = PackedInt32Array()
				var bucket: PackedInt32Array = _grid[key]
				bucket.append(index)
				_grid[key] = bucket


static func _cell_key(x: float, z: float) -> int:
	return floori(x / CELL_SIZE) * 100000 + floori(z / CELL_SIZE)
