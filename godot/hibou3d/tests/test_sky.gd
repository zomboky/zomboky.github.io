extends SceneTree
## Recette du lot 5 (PLAN_GODOT.md §9) — vérifiable sans écran.
##
## `SkySystem.compute()` est pur (aucun nœud, aucune horloge de session) : ces vérifications
## portent directement sur cette fonction, pas sur la scène. C'est elle qui garantit la
## condition d'acceptation « deux instances lancées à 1 minute d'intervalle affichent la
## même heure du jour » — un test de scène ne pourrait pas attendre une minute pour le
## prouver, un test de pureté le prouve pour toute paire d'instants.
##
## Lancer : godot --headless --path godot/hibou3d --script res://tests/test_sky.gd

var _failures := 0


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	# Déterminisme : même instant → même résultat, bit à bit. C'est la propriété qui rend
	# la synchro multijoueur du cycle gratuite (aucune donnée réseau à échanger).
	var a := SkySystem.compute(1_772_000_000.0)
	var b := SkySystem.compute(1_772_000_000.0)
	_check("un même instant produit la même direction solaire",
		a.sun_dir.is_equal_approx(b.sun_dir))
	_check("un même instant produit le même facteur jour/nuit",
		is_equal_approx(a.day_factor, b.day_factor))

	# Boucle continue : la phase est strictement périodique sur DAY_NIGHT_CYCLE_SECONDS.
	var t0 := 1_772_000_123.0
	var one_cycle_later := SkySystem.compute(t0 + SkySystem.DAY_NIGHT_CYCLE_SECONDS)
	var reference := SkySystem.compute(t0)
	_check("le cycle se reboucle exactement après 480 s",
		reference.sun_dir.is_equal_approx(one_cycle_later.sun_dir))

	# Soleil et lune sont toujours à l'opposé l'un de l'autre sur le même arc.
	var e := SkySystem.compute(t0)
	_check("la lune est diamétralement opposée au soleil", e.moon_dir.is_equal_approx(-e.sun_dir))

	# day_factor doit rester borné et balayer tout [0, 1] sur un cycle complet.
	var min_factor := 1.0
	var max_factor := 0.0
	var out_of_range := false
	var samples := 480
	for i in samples:
		var sample := SkySystem.compute(t0 + float(i) * (SkySystem.DAY_NIGHT_CYCLE_SECONDS / samples))
		min_factor = minf(min_factor, sample.day_factor)
		max_factor = maxf(max_factor, sample.day_factor)
		if sample.day_factor < 0.0 or sample.day_factor > 1.0:
			out_of_range = true
	_check("day_factor reste dans [0, 1] sur tout le cycle", not out_of_range)
	_check("le cycle atteint la nuit pleine", min_factor < 0.01)
	_check("le cycle atteint le jour plein", max_factor > 0.99)

	print("")
	if _failures == 0:
		print("Lot 5 : recette OK.")
	else:
		printerr("Lot 5 : %d vérification(s) en échec." % _failures)
	quit(0 if _failures == 0 else 1)


func _check(label: String, ok: bool) -> void:
	print("  %s %s" % ["[OK]  " if ok else "[FAIL]", label])
	if not ok:
		_failures += 1
