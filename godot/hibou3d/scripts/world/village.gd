class_name Village
extends Node3D
## Hameaux et feux de camp — port de `makeBuildings()` (docs/hibou-3d.html).
##
## Chalets et tours de guet groupés en hameaux ou éparpillés, chacun posé sur un
## terrain plat, hors de l'eau et sous la limite des arbres. Purement décoratifs :
## aucune collision dédiée, comme les massifs.
##
## Le placement est déterministe (`Terrain.building_rng`) : il doit être identique
## sur tous les clients multijoueur.
##
## ⚠️ **Le pool de lumières est à conserver impérativement** (§10.3). En rendu
## Compatibility, le nombre d'`OmniLight3D` affectant un même objet est limité :
## une lumière par feu de camp, avec une trentaine de feux, ferait clignoter ou
## disparaître l'éclairage. Sept lumières sont réassignées chaque frame aux feux
## les plus proches du joueur — exactement ce que fait déjà le jeu d'origine.

const TREE_SPREAD := Terrain.ARENA_RADIUS_XZ * 0.84
const TOWER_HEIGHT := 13.8
const CABIN_HEIGHT := 3.8
## Le variant « à étage » reprend le même modèle agrandi, faute d'un second maillage.
const FLOOR_SCALE := 1.35

const CAMPFIRE_POOL_SIZE := 7
const CAMPFIRE_LIGHT_COLOR := Color("ffa33e")
const CAMPFIRE_RANGE := 26.0
## Au-delà, une lumière du pool est éteinte plutôt que gaspillée.
const CAMPFIRE_MAX_DIST := 90.0

const TOWER_MODEL := "res://assets/models/watchtower.glb"
const CABIN_MODEL := "res://assets/models/cabin.obj"
const WOOD_LIGHT := Color("8a6a3f")

## Position monde de chaque feu de camp (le foyer, à 0,9 u du sol).
var _campfires: Array[Vector3] = []
var _lights: Array[OmniLight3D] = []
## Le hibou, pour trier les feux par distance. Renseigné par la scène principale.
var player: Node3D = null


func _ready() -> void:
	_init_light_pool()
	rebuild()


func rebuild() -> void:
	var started := Time.get_ticks_usec()
	for child in get_children():
		if child is OmniLight3D:
			continue  # le pool est créé une fois pour toutes, au démarrage
		child.queue_free()
	_campfires.clear()

	var rng := Terrain.building_rng
	# Transforms par type de bâtiment : simple, à étage, tour de guet.
	var transforms: Array[Array] = [
		[] as Array[Transform3D], [] as Array[Transform3D], [] as Array[Transform3D],
	]

	# ── Centres de hameaux : du terrain plat, espacé, hors de l'eau ──────
	var hamlets: Array[Vector3] = []
	var hamlet_count := 3 + int(floorf(rng.next() * 3.0))
	var tries := 0
	while hamlets.size() < hamlet_count and tries < 200:
		tries += 1
		var angle := rng.range_f(0.0, TAU)
		var r := 90.0 + rng.next() * (TREE_SPREAD - 90.0)
		var x := cos(angle) * r
		var z := sin(angle) * r
		var h := Terrain.terrain_height(x, z)
		if h < Terrain.WATER_Y + 1.5 or h > Terrain.TREE_LINE:
			continue
		if _slope(x, z, h, 3.0) > 1.4:
			continue  # un hameau demande du plat
		var too_close := false
		for c in hamlets:
			if Vector2(c.x - x, c.z - z).length_squared() < 130.0 * 130.0:
				too_close = true
				break
		if too_close:
			continue
		hamlets.append(Vector3(x, h, z))

	for center in hamlets:
		var count := 4 + int(floorf(rng.next() * 7.0))
		for _i in count:
			var a := rng.range_f(0.0, TAU)
			var r := rng.range_f(4.0, 22.0)
			_place(transforms, center.x + cos(a) * r, center.z + sin(a) * r, rng)
		_add_campfire(center.x, center.y, center.z)  # un feu au centre de chaque hameau

	# ── Bâtiments isolés ─────────────────────────────────────────────────
	var isolated_count := 5 + int(floorf(rng.next() * 6.0))
	var placed := 0
	var attempts := 0
	while placed < isolated_count and attempts < isolated_count * 15:
		attempts += 1
		var angle := rng.range_f(0.0, TAU)
		var r := sqrt(rng.next()) * TREE_SPREAD
		var x := cos(angle) * r
		var z := sin(angle) * r
		if r < 30.0:
			continue
		var h := Terrain.terrain_height(x, z)
		if h < Terrain.WATER_Y + 1.5 or h > Terrain.TREE_LINE:
			continue
		if _slope(x, z, h, 3.0) > 1.6:
			continue
		_place(transforms, x, z, rng)
		if rng.next() < 0.3:
			_add_campfire(x, h, z)  # 30 % de chance d'avoir son propre feu
		placed += 1

	_build_instances(transforms)
	print("Hameaux : %d groupes, %d feux de camp, semés en %.0f ms" %
		[hamlets.size(), _campfires.size(), (Time.get_ticks_usec() - started) / 1000.0])


## Pente locale, mesurée comme dans le jeu d'origine : somme des dénivelés sur
## deux axes à distance fixe. Grossier mais suffisant, et surtout identique.
static func _slope(x: float, z: float, h: float, step: float) -> float:
	return absf(Terrain.terrain_height(x + step, z) - h) \
		+ absf(Terrain.terrain_height(x, z + step) - h)


func _place(transforms: Array[Array], x: float, z: float, rng: Rng) -> void:
	# L'ordre des tirages reproduit celui du jeu : `placeOne(x, z, pickKind())`
	# évalue le type AVANT d'entrer dans la fonction, donc avant le test de
	# hauteur — et le lacet n'est tiré que si le bâtiment est effectivement posé.
	# Un tirage consommé au mauvais moment décale tout le village.
	var pick := rng.next()
	var kind := 0 if pick < 0.55 else (1 if pick < 0.9 else 2)
	var h := Terrain.terrain_height(x, z)
	# Garde-fou : le jitter du hameau peut retomber dans l'eau ou dans une rivière.
	if h < Terrain.WATER_Y + 1.2:
		return
	var yaw := rng.range_f(0.0, TAU)
	transforms[kind].append(Transform3D(Basis(Vector3.UP, yaw), Vector3(x, h, z)))


func _build_instances(transforms: Array[Array]) -> void:
	# Les deux variantes de chalet partagent un modèle, à des hauteurs différentes.
	_build_kind(CABIN_MODEL, CABIN_HEIGHT, transforms[0])
	_build_kind(CABIN_MODEL, CABIN_HEIGHT * FLOOR_SCALE, transforms[1])
	_build_kind(TOWER_MODEL, TOWER_HEIGHT, transforms[2])


func _build_kind(model_path: String, height: float, transforms: Array) -> void:
	if transforms.is_empty():
		return
	var holder := Node3D.new()
	add_child(holder)
	holder.add_child(_instantiate_model(model_path))
	ModelUtils.normalize(holder, holder.get_child(0), Vector3.AXIS_Y, height, true)
	# `cabin.obj` est livré sans `.mtl` : le modèle n'a aucune couleur d'origine.
	# On lui donne la teinte bois de la palette des chalets du jeu.
	var material: Material = null
	if model_path.ends_with(".obj"):
		var wood := StandardMaterial3D.new()
		wood.albedo_color = WOOD_LIGHT
		wood.roughness = 0.9
		material = wood
	var typed: Array[Transform3D] = []
	typed.assign(transforms)
	MultiMeshBuilder.build(self, MultiMeshBuilder.collect_parts(holder), typed, material)
	holder.queue_free()


## Godot importe un `.glb` en `PackedScene` mais un `.obj` en simple `Mesh` :
## `cabin.obj` doit donc être enveloppé à la main dans un `MeshInstance3D`.
static func _instantiate_model(path: String) -> Node3D:
	var resource := load(path)
	if resource is PackedScene:
		return (resource as PackedScene).instantiate()
	var instance := MeshInstance3D.new()
	instance.mesh = resource
	return instance


func _add_campfire(x: float, ground_y: float, z: float) -> void:
	_campfires.append(Vector3(x, ground_y + 0.9, z))


func _init_light_pool() -> void:
	for _i in CAMPFIRE_POOL_SIZE:
		var light := OmniLight3D.new()
		light.light_color = CAMPFIRE_LIGHT_COLOR
		light.light_energy = 0.0
		light.omni_range = CAMPFIRE_RANGE
		light.omni_attenuation = 2.0
		light.shadow_enabled = false  # sept lumières à ombres coûteraient bien trop cher
		add_child(light)
		_lights.append(light)


func _process(_delta: float) -> void:
	if player == null or _campfires.is_empty():
		for light in _lights:
			light.light_energy = 0.0
		return

	# Les feux les plus proches du joueur récupèrent les lumières du pool. Trier
	# une trentaine d'entrées par frame est négligeable devant le coût qu'aurait
	# une lumière par feu en rendu Compatibility.
	var origin := player.global_position
	var sorted := _campfires.duplicate()
	sorted.sort_custom(func(a: Vector3, b: Vector3) -> bool:
		return a.distance_squared_to(origin) < b.distance_squared_to(origin))

	var now := Time.get_ticks_msec()
	for i in _lights.size():
		var light := _lights[i]
		if i >= sorted.size() or sorted[i].distance_squared_to(origin) > CAMPFIRE_MAX_DIST * CAMPFIRE_MAX_DIST:
			light.light_energy = 0.0
			continue
		light.global_position = sorted[i]
		# Vacillement : chaque lumière a sa propre phase, sinon toutes les flammes
		# du village battent à l'unisson.
		light.light_energy = 2.4 * (0.85 + 0.15 * sin(now * 0.006 + i * 7.3))
