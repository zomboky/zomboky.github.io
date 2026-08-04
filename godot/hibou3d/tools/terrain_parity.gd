extends SceneTree
## Échantillonne le terrain porté sur la grille de parité et écrit la trace.
##
##   godot --headless --path godot/hibou3d --script res://tools/terrain_parity.gd
##
## Pendant du `run_js.mjs` de `tools/terrain-parity/`. C'est la première étape du
## lot 3, et le plan la place avant tout le reste : elle conditionne la suite
## (PLAN_GODOT.md §5.4).
##
## Le script tourne sans arbre de scène, donc **sans autoload** : il instancie le
## script du terrain directement. C'est une vérification en soi — la fonction de
## terrain ne doit dépendre d'aucun état de scène.
##
## Les tableaux de flottants sont transportés en **base64 de float64 bruts** et non
## en nombres JSON : `JSON.stringify` de Godot arrondit à 15 chiffres significatifs
## et ne fait pas d'aller-retour exact. Or on cherche justement à mesurer un écart
## en dernières décimales.

const GRID_N := 100
const GRID_ORIGIN := -1650.0
const GRID_STEP := 33.0

const OUTPUT_REL := "tools/terrain-parity/out/trace_godot.json"


func _init() -> void:
	var terrain: Node = load("res://autoload/terrain.gd").new()
	terrain._ready()  # sème pics et rivières

	var heights := PackedFloat64Array()
	var forest := PackedFloat64Array()
	heights.resize(GRID_N * GRID_N)
	forest.resize(GRID_N * GRID_N)
	var k := 0
	for i in GRID_N:
		var x := GRID_ORIGIN + i * GRID_STEP
		for j in GRID_N:
			var z := GRID_ORIGIN + j * GRID_STEP
			heights[k] = terrain.terrain_height(x, z)
			forest[k] = terrain.forest_density(x, z)
			k += 1

	# Le semis fait partie de ce qui doit coïncider : deux implémentations peuvent
	# partager `terrain_height()` et diverger faute d'avoir tiré les mêmes pics.
	var peaks := PackedFloat64Array()
	for p in terrain.mountain_peaks:
		peaks.append_array(PackedFloat64Array([p["x"], p["z"], p["h"], p["r"]]))

	var river_shape := PackedFloat64Array()  # largeur, profondeur, par rivière
	var river_points := PackedFloat64Array()
	var river_counts := []
	for r in terrain.river_paths:
		river_shape.append_array(PackedFloat64Array([r["width"], r["depth"]]))
		var pts: PackedFloat64Array = r["points"]
		river_points.append_array(pts)
		river_counts.append(pts.size() / 2)

	var repo_root := ProjectSettings.globalize_path("res://").path_join("../..").simplify_path()
	var output_path := repo_root.path_join(OUTPUT_REL)
	DirAccess.make_dir_recursive_absolute(output_path.get_base_dir())
	var file := FileAccess.open(output_path, FileAccess.WRITE)
	if file == null:
		printerr("Écriture impossible : %s" % output_path)
		quit(1)
		return
	file.store_string(JSON.stringify({
		"source": "godot",
		"grid": { "n": GRID_N, "origin": GRID_ORIGIN, "step": GRID_STEP },
		"peaks_b64": _encode(peaks),
		"river_counts": river_counts,
		"river_shape_b64": _encode(river_shape),
		"river_points_b64": _encode(river_points),
		"heights_b64": _encode(heights),
		"forest_b64": _encode(forest),
	}))
	file.close()

	var lowest := heights[0]
	var highest := heights[0]
	for h in heights:
		lowest = minf(lowest, h)
		highest = maxf(highest, h)
	print("Godot : %d points échantillonnés, %d pics, %d rivières" %
		[heights.size(), peaks.size() / 4, river_counts.size()])
	print("        altitudes de %.3f à %.3f" % [lowest, highest])
	print("        trace → %s" % output_path)
	quit(0)


static func _encode(values: PackedFloat64Array) -> String:
	return Marshalls.raw_to_base64(values.to_byte_array())
