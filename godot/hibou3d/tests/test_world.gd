extends Node
## Recette des lots 3 et 4 (PLAN_GODOT.md §9) : terrain, eau et décor instancié,
## montés dans la vraie scène.
##
##   godot --headless --path godot/hibou3d res://tests/test_world.tscn
##
## ⚠️ Ce test se lance comme une **exécution normale du projet**, avec un chemin de
## scène en argument — et non via `--script`. En mode `--script`, Godot remplace la
## `SceneTree` : les autoloads ne sont jamais instanciés, donc `Terrain` n'existe
## ni à la compilation ni à l'exécution. Les harnais qui n'ont besoin d'aucun
## autoload (parité du vol, parité du terrain, recette du hibou) restent, eux,
## en `--script`.

var _failures := 0


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	var started := Time.get_ticks_msec()
	var main: Node3D = load("res://scenes/main.tscn").instantiate()
	add_child(main)
	var terrain_mesh: TerrainMesh = main.get_node("World/Terrain")
	# La construction est découpée sur plusieurs frames : on attend son signal.
	await terrain_mesh.build_finished
	var build_ms := Time.get_ticks_msec() - started

	var water: MeshInstance3D = main.get_node("World/Water")
	var owl: Owl = main.get_node("Owl")
	var flight: OwlFlight = owl.get_node("Flight")
	var forest: Forest = main.get_node("World/Forest")
	var village: Village = main.get_node("World/Village")
	var mountains: Node3D = main.get_node("World/Mountains")
	var clouds: Clouds = main.get_node("World/Clouds")

	print("Scène complète montée en %d ms" % build_ms)
	print("AABB du terrain : %s" % terrain_mesh.get_aabb())

	# ── Le maillage n'est qu'un affichage de la fonction ──────────────────
	var aabb := terrain_mesh.get_aabb()
	_check("le terrain couvre toute la carte",
		is_equal_approx(aabb.size.x, Terrain.TERRAIN_SIZE) and is_equal_approx(aabb.size.z, Terrain.TERRAIN_SIZE))
	_check("le relief atteint la muraille de montagnes", aabb.size.y > Terrain.RING_BASE)
	_check("le maillage est non indexé (facettes franches)",
		terrain_mesh.mesh.surface_get_arrays(0)[Mesh.ARRAY_INDEX] == null)
	_check("le maillage porte une couleur par sommet",
		terrain_mesh.mesh.surface_get_arrays(0)[Mesh.ARRAY_COLOR] != null)

	# Le sommet du maillage doit coïncider avec la fonction : c'est elle qui fait
	# autorité pour les collisions, le maillage n'en est qu'une image.
	var vertices: PackedVector3Array = terrain_mesh.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]
	var worst := 0.0
	for i in range(0, vertices.size(), 997):  # pas premier : balaie tout le maillage
		var v := vertices[i]
		worst = maxf(worst, absf(v.y - Terrain.terrain_height(v.x, v.z)))
	print("Écart maillage ↔ fonction : %.6f u (float32 du Vector3)" % worst)
	_check("le maillage suit la fonction de terrain", worst < 0.05)

	# ── La zone de départ est aplanie ─────────────────────────────────────
	_check("le centre de l'arène est aplani", absf(Terrain.terrain_height(0.0, 0.0)) < 0.001)
	_check("la muraille se dresse au bord de l'arène",
		Terrain.terrain_height(Terrain.ARENA_RADIUS_XZ * 1.18, 0.0) > Terrain.RING_BASE)

	# ── L'eau ─────────────────────────────────────────────────────────────
	_check("le plan d'eau est au niveau des lacs", is_equal_approx(water.position.y, Terrain.WATER_Y))
	_check("l'eau est rendue par un shader, pas recalculée sur le CPU",
		water.get_surface_override_material(0) is ShaderMaterial)
	_check("le sol effectif ne descend jamais sous l'eau",
		Terrain.effective_ground_y(0.0, 0.0) >= Terrain.WATER_Y)

	# ── Le vol interroge bien la fonction ─────────────────────────────────
	_check("le modèle de vol lit la hauteur de terrain",
		flight.model.ground_height.get_object() == Terrain)
	_check("l'anti-clipping caméra est actif contre le relief", owl.camera.clipping_enabled)

	# ── Régénération et restauration ──────────────────────────────────────
	var canonical := Terrain.terrain_height(300.0, -200.0)
	Terrain.regenerate_seed()
	var regenerated := Terrain.terrain_height(300.0, -200.0)
	_check("une partie solo re-tire une nouvelle carte", absf(canonical - regenerated) > 0.01)
	_check("la régénération est signalée", Terrain.world_regenerated)
	Terrain.restore_canonical()
	_check("le terrain canonique est restauré au bit près",
		Terrain.terrain_height(300.0, -200.0) == canonical)
	_check("les pics canoniques sont restaurés", Terrain.mountain_peaks.size() > 0)
	_check("les graines de décor sont restaurées", not Terrain.world_regenerated)

	# ── Lot 4 : décor instancié ───────────────────────────────────────────
	print("")
	print("Décor : %d arbres, %d nœuds de forêt, %d de montagnes, %d de nuages, %d de village" %
		[forest.tree_count(), forest.get_child_count(), mountains.get_child_count(),
		clouds.get_child_count(), village.get_child_count()])

	_check("la forêt compte 3 000 arbres", forest.tree_count() == Forest.TREE_COUNT)
	_check("la forêt est rendue en MultiMesh, pas en nœuds individuels",
		forest.get_child_count() > 0 and forest.get_child_count() < 40
		and forest.get_child(0) is MultiMeshInstance3D)
	_check("aucun arbre n'est un corps physique", _count_bodies(main) == 0)
	# Un MultiMesh vide, ou dont l'AABB est restée à l'origine, se voit comme une
	# forêt invisible — et rien d'autre ne le signalerait.
	# Une essence est rendue par autant de MultiMesh que son modèle a de surfaces,
	# et chacun porte toutes les instances de CETTE essence. La somme sur les
	# quatre essences doit redonner les 3 000 arbres.
	var instanced := _sum_first_surface_instances(forest)
	print("Instances de forêt (première surface de chaque essence) : %d" % instanced)
	_check("les MultiMesh de forêt totalisent 3 000 instances", instanced == Forest.TREE_COUNT)
	var extent := _forest_extent(forest)
	print("Étendue du semis en X : %.0f u (semis limité à ±%.0f)" % [extent, Forest.TREE_SPREAD])
	_check("la forêt s'étend sur l'arène jouable", extent > Forest.TREE_SPREAD)
	_check("les massifs décoratifs cernent l'arène", mountains.get_child_count() > 0)
	_check("les nuages sont instanciés par palier d'opacité", clouds.get_child_count() >= 9)
	_check("le village a posé des bâtiments", village.get_child_count() > Village.CAMPFIRE_POOL_SIZE)

	# Le pool de lumières est une obligation du rendu Compatibility (§10.3) : une
	# lumière par feu de camp ferait clignoter ou disparaître l'éclairage.
	var lights := 0
	for child in village.get_children():
		if child is OmniLight3D:
			lights += 1
	_check("les feux de camp partagent un pool de 7 lumières",
		lights == Village.CAMPFIRE_POOL_SIZE)

	# Collision d'arbre : analytique, jamais un raycast.
	_check("le vol teste les arbres", flight.tree_test.is_valid())
	_check("la caméra teste les arbres", owl.camera.point_in_tree.is_valid())
	_check("le ciel au-dessus de la clairière de départ est dégagé",
		not forest.point_inside_tree(Vector3(0, 5, 0)))
	_check("chaque arbre est détecté au cœur de son feuillage", _all_trees_hit(forest))

	print("")
	if _failures == 0:
		print("Lots 3 et 4 : recette OK.")
	else:
		printerr("Lots 3 et 4 : %d vérification(s) en échec." % _failures)
	get_tree().quit(0 if _failures == 0 else 1)


## Chaque arbre doit être détecté au cœur de son propre feuillage. C'est ce qui
## vérifie la grille d'accélération : mal indexée, elle renverrait « rien » sans
## que rien d'autre ne le signale.
static func _all_trees_hit(forest: Forest) -> bool:
	for i in forest.tree_count():
		if not forest.point_inside_tree(forest.tree_leaf_point(i)):
			return false
	return true


## Somme des instances, en ne comptant qu'une fois chaque essence : plusieurs
## `MultiMeshInstance3D` d'une même essence répètent le même jeu d'instances, un
## par surface du modèle.
static func _sum_first_surface_instances(root: Node) -> int:
	var total := 0
	var seen: Dictionary = {}
	for child in root.get_children():
		if child is MultiMeshInstance3D:
			var key: Variant = (child as MultiMeshInstance3D).get_meta("part_local")
			if seen.has(key):
				continue
			seen[key] = true
			total += (child as MultiMeshInstance3D).multimesh.instance_count
	return total


## Étendue horizontale du semis, lue sur les colliders de la forêt.
##
## Ni `get_aabb()` ni `get_instance_transform()` ne conviennent : les données d'un
## `MultiMesh` vivent dans le serveur de rendu, qui est un bouchon en mode headless
## et renvoie des transforms identité. Les colliders, eux, appartiennent au script
## et sont de toute façon ce qui fait autorité pour le jeu.
static func _forest_extent(forest: Forest) -> float:
	var min_x := INF
	var max_x := -INF
	for i in forest.tree_count():
		var x := forest.tree_leaf_point(i).x
		min_x = minf(min_x, x)
		max_x = maxf(max_x, x)
	return max_x - min_x


## Compte les corps physiques de la scène. Il doit y en avoir zéro : ni terrain,
## ni arbres, ni hibou (décision A du §4.2).
static func _count_bodies(root: Node) -> int:
	var count := 1 if root is CollisionObject3D else 0
	for child in root.get_children():
		count += _count_bodies(child)
	return count


func _check(label: String, ok: bool) -> void:
	print("  %s %s" % ["[OK]  " if ok else "[FAIL]", label])
	if not ok:
		_failures += 1
