extends SceneTree
## Rejoue la séquence de commandes avec le modèle Godot et écrit la trace.
##
##   godot --headless --path godot/hibou3d --script res://tools/flight_parity.gd
##
## Pendant du `run_js.mjs` de `tools/flight-parity/` : même séquence, même pas de
## temps, même graine de générateur, même format de sortie. C'est la moitié Godot
## de la recette bloquante du lot 2 (PLAN_GODOT.md §9.2).

## Le harnais vit hors du projet Godot : il est partagé avec la moitié JavaScript.
## `res://` ne pouvant pas remonter au-dessus du projet, on repasse par un chemin
## système absolu.
const SEQUENCE_REL := "tools/flight-parity/sequence.json"
const OUTPUT_REL := "tools/flight-parity/out/trace_godot.json"

var _sequence_path := ""
var _output_path := ""


func _init() -> void:
	var repo_root := ProjectSettings.globalize_path("res://").path_join("../..").simplify_path()
	_sequence_path = repo_root.path_join(SEQUENCE_REL)
	_output_path = repo_root.path_join(OUTPUT_REL)

	var seq := _load_sequence()
	if seq.is_empty():
		quit(1)
		return

	var model := FlightModel.new()
	model.rng = Rng.new(int(seq["rng_seed"]))
	var ground_y: float = seq["ground_y"]
	model.ground_height = func(_x: float, _z: float) -> float: return ground_y
	model.ground_clear = seq["ground_clear"]
	var start: Array = seq["start_position"]
	model.reset(Vector3(start[0], start[1], start[2]))

	var dt: float = seq["dt"]
	var steps := int(round(float(seq["duration"]) / dt))
	var segments: Array = seq["segments"]

	var samples: Array = []
	var distance := 0.0
	var previous := model.position
	var first_stall_time: Variant = null

	for i in steps:
		var t := i * dt
		model.step(_commands_at(segments, t), dt)
		distance += model.position.distance_to(previous)
		previous = model.position
		if first_stall_time == null and model.stall_mode:
			first_stall_time = t + dt

		samples.append({
			"t": t + dt,
			"pos": [model.position.x, model.position.y, model.position.z],
			"vel": [model.velocity.x, model.velocity.y, model.velocity.z],
			"quat": [model.orientation.x, model.orientation.y, model.orientation.z, model.orientation.w],
			"speed": model.speed,
			"throttle": model.throttle,
			"aoa": model.readout.aoa,
			"stall": model.stall_mode,
		})

	var payload := {
		"source": "godot",
		"steps": steps,
		"distance": distance,
		"first_stall_time": first_stall_time,
		"final_position": [model.position.x, model.position.y, model.position.z],
		"samples": samples,
	}
	DirAccess.make_dir_recursive_absolute(_output_path.get_base_dir())
	var file := FileAccess.open(_output_path, FileAccess.WRITE)
	if file == null:
		printerr("Écriture impossible : %s" % _output_path)
		quit(1)
		return
	file.store_string(JSON.stringify(payload, " "))
	file.close()

	print("Godot : %d pas, distance parcourue %.3f u" % [steps, distance])
	print("        position finale (%.4f, %.4f, %.4f)" % [model.position.x, model.position.y, model.position.z])
	print("        premier décrochage à %s" %
		["jamais" if first_stall_time == null else "%.3f s" % first_stall_time])
	print("        trace → %s" % _output_path)
	quit(0)


## Commandes en vigueur à l'instant t : le dernier segment commencé.
func _commands_at(segments: Array, t: float) -> FlightInput:
	var active: Dictionary = segments[0]
	for segment in segments:
		if t >= float(segment["t"]):
			active = segment
		else:
			break
	var input := FlightInput.new()
	input.pitch = float(active["pitch"])
	input.yaw = float(active["yaw"])
	input.roll = float(active["roll"])
	input.thrust_held = bool(active["thrust"])
	input.brake_held = bool(active["brake"])
	return input


func _load_sequence() -> Dictionary:
	var file := FileAccess.open(_sequence_path, FileAccess.READ)
	if file == null:
		printerr("Séquence introuvable : %s" % _sequence_path)
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) != TYPE_DICTIONARY:
		printerr("Séquence illisible : %s" % _sequence_path)
		return {}
	return parsed
