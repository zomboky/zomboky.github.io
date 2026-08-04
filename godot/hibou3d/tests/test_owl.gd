extends SceneTree
## Recette du lot 1 (PLAN_GODOT.md §9) — vérifiable sans écran.
##
## Lancer : godot --headless --path godot/hibou3d --script res://tests/test_owl.gd

const EXPECTED_WINGSPAN := 2.6
const TOLERANCE := 0.01

var _failures := 0


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	var owl: Owl = load("res://scenes/owl/owl.tscn").instantiate()
	root.add_child(owl)
	await process_frame

	var size := ModelUtils.aggregate_aabb(owl).size
	print("Envergure normalisée : %.4f (cible %.2f)" % [size.x, EXPECTED_WINGSPAN])
	print("Gabarit de collision : %.3f × %.3f × %.3f" % [size.x, size.y, size.z])
	print("Garde au sol : %.3f | rayon de collision : %.3f" % [owl.ground_clear, owl.collide_radius])

	_check("le modèle est normalisé sur l'envergure visée",
		absf(size.x - EXPECTED_WINGSPAN) < TOLERANCE)
	_check("le gabarit de collision est plus étroit que l'envergure",
		owl.collide_radius < EXPECTED_WINGSPAN / 2.0)
	_check("la garde au sol est cohérente avec la hauteur du modèle",
		is_equal_approx(owl.ground_clear, size.y / 2.0 + 0.15))

	# Le modèle regarde vers +Z ; après le demi-tour, le nez doit pointer vers -Z,
	# la convention de vol partagée par Three.js et Godot (§5.1).
	var nose := -owl.global_transform.basis.z
	_check("le nez du hibou pointe vers -Z", nose.dot(Vector3.BACK) < -0.9)

	var anim: AnimationPlayer = owl.get_node("%Model/AnimationPlayer")
	_check("le clip de battement d'ailes est en lecture", anim.is_playing())
	owl.set_speed_ratio(1.0)
	_check("le battement accélère à pleine vitesse",
		is_equal_approx(anim.speed_scale, Owl.FLAP_CLIP_RATE_MAX))
	owl.set_speed_ratio(0.0)
	_check("le battement ne s'arrête jamais complètement",
		is_equal_approx(anim.speed_scale, Owl.FLAP_CLIP_RATE_MIN))

	var camera: OwlCamera = owl.camera
	_check("la caméra est à l'offset de poursuite",
		camera.position.is_equal_approx(OwlCamera.LOCAL_OFFSET))
	camera.look_back = true
	camera.update_camera(1.0 / 60.0, 0.0)
	_check("la vue arrière place la caméra devant le hibou", camera.position.z < 0.0)
	_check("la vue arrière retourne la caméra", is_equal_approx(camera.rotation.y, PI))
	camera.look_back = false
	camera.update_camera(1.0 / 60.0, 0.0)

	# Champ dynamique : 70 au repos, jusqu'à 84 à pleine vitesse.
	for i in 200:
		camera.update_camera(1.0 / 60.0, 1.0)
	_check("le champ s'élargit à 84° à pleine vitesse", absf(camera.fov - 84.0) < 0.1)

	print("")
	if _failures == 0:
		print("Lot 1 : recette OK.")
	else:
		printerr("Lot 1 : %d vérification(s) en échec." % _failures)
	quit(0 if _failures == 0 else 1)


func _check(label: String, ok: bool) -> void:
	print("  %s %s" % ["[OK]  " if ok else "[FAIL]", label])
	if not ok:
		_failures += 1
