extends Node
## Recette du lot 3 (PLAN_GODOT.md §9) : terrain et eau, montés dans la vraie scène.
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

	print("")
	if _failures == 0:
		print("Lot 3 : recette OK.")
	else:
		printerr("Lot 3 : %d vérification(s) en échec." % _failures)
	get_tree().quit(0 if _failures == 0 else 1)


func _check(label: String, ok: bool) -> void:
	print("  %s %s" % ["[OK]  " if ok else "[FAIL]", label])
	if not ok:
		_failures += 1
