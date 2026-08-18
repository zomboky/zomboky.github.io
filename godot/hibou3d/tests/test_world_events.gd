extends SceneTree
## Recette du lot 8 (PLAN_GODOT.md §9) : les événements du monde, pilotés pas à pas.
##
##   godot --headless --path godot/hibou3d --script res://tests/test_world_events.gd
##
## `WorldEvents` ne touche **aucun** autoload et ne dessine rien : c'est une
## machine à états qu'on peut faire tourner à l'horloge qu'on veut, sans monter la
## scène. Ce test la pousse donc à la seconde près, ce qu'une recette visuelle ne
## permettrait pas — une lune dure 10 s, une tempête 20, et les délais entre deux
## événements se comptent en dizaines de secondes.
##
## Ce qui a besoin de la scène (rochers qui tombent, pluie, ciel qui se plombe)
## est recetté par `tests/test_storm.tscn`.

var _failures := 0


func _init() -> void:
	_test_initial_state()
	_test_moon_cycle()
	_test_blood_moon_odds()
	_test_mutual_exclusion()
	_test_storm_cycle()
	_test_weather_cycle()
	_test_lightning()
	_test_bear_pressure()

	print("")
	if _failures == 0:
		print("Lot 8 : les événements du monde sont conformes.")
	else:
		printerr("Lot 8 : %d vérification(s) en échec." % _failures)
	quit(1 if _failures > 0 else 0)


## Fait tourner l'horloge par pas de 1/60 s, en gardant la nuit (sans quoi aucune
## lune ne se déclencherait). Rend le nombre de pas réellement effectués.
func _run(events: WorldEvents, seconds: float, until: Callable = Callable()) -> float:
	var step := 1.0 / 60.0
	var elapsed := 0.0
	while elapsed < seconds:
		events.step(step)
		events.fade_lightning(step)
		elapsed += step
		if until.is_valid() and until.call():
			break
	return elapsed


func _new_events() -> WorldEvents:
	var events := WorldEvents.new()
	events.reset()
	events.day_factor = 0.0  # nuit pleine : les lunes peuvent se lever
	return events


func _test_initial_state() -> void:
	print("── État de départ ──")
	var events := _new_events()
	_check("aucune lune au décollage", events.moon_state == WorldEvents.Moon.NONE)
	_check("aucune tempête au décollage", not events.storm_active)
	_check("ciel clair au décollage", events.weather_mode == WorldEvents.Weather.CLEAR)
	_check("aucun vent", events.wind_force == 0.0)
	_check("mauvais temps visé à zéro", events.weather_target() == 0.0)
	events.free()


func _test_moon_cycle() -> void:
	print("── Cycle de la lune ──")
	var events := _new_events()

	# Préavis : la lune se remplit AVANT de se lever, c'est le seul avertissement.
	_run(events, WorldEvents.MOON_FIRST - WorldEvents.MOON_WARN_TIME + 0.5)
	_check("la lune se remplit pendant le préavis",
		events.moon_fill_progress > 0.0 and events.moon_fill_progress < 1.0)
	_check("mais ne s'est pas encore levée", events.moon_state == WorldEvents.Moon.NONE)

	_run(events, 5.0, func() -> bool: return events.is_moon_active())
	_check("la lune se lève au bout de %.0f s" % WorldEvents.MOON_FIRST, events.is_moon_active())
	_check("et se remplit complètement", is_equal_approx(events.moon_fill_progress, 1.0))
	_check("la collecte est suspendue sous une lune", events.is_moon_active())

	# Elle doit s'arrêter d'elle-même — un événement qui ne finit pas est un bug.
	# La durée attendue dépend du type qui s'est levé : on le note AVANT qu'il
	# s'éteigne, plutôt que d'accepter une fourchette qui couvrirait les deux.
	var was_blood := events.moon_state == WorldEvents.Moon.BLOOD
	var expected: float = WorldEvents.BLOOD_MOON_DURATION if was_blood else WorldEvents.MOON_DURATION
	var duration := _run(events, 40.0, func() -> bool: return not events.is_moon_active())
	_check("la lune s'éteint toute seule", not events.is_moon_active())
	_check("après exactement sa durée (%.2f s pour %.0f attendues)" % [duration, expected],
		absf(duration - expected) < 0.05)
	_check("et le remplissage retombe à zéro", events.moon_fill_progress == 0.0)
	events.free()

	# En plein jour, aucune lune ne se lève naturellement.
	var day := _new_events()
	day.day_factor = 1.0
	_run(day, WorldEvents.MOON_FIRST + 20.0)
	_check("aucune lune ne se lève en plein jour", day.moon_state == WorldEvents.Moon.NONE)
	day.free()


## La lune de sang est le tirage rare : une fois sur dix. On ne teste pas la
## fréquence (elle serait statistique), mais que les deux issues existent et que
## la version forcée donne bien celle qu'on demande.
func _test_blood_moon_odds() -> void:
	print("── Lune de sang ──")
	_check("une lune sur dix est une lune de sang",
		is_equal_approx(WorldEvents.BLOOD_MOON_CHANCE, 0.1))
	_check("elle dure plus longtemps qu'une pleine lune",
		WorldEvents.BLOOD_MOON_DURATION > WorldEvents.MOON_DURATION)

	var events := _new_events()
	events._activate_moon(true)
	_check("forcée en sang, elle l'est bien", events.moon_state == WorldEvents.Moon.BLOOD)
	_check("et prend la durée longue",
		is_equal_approx(events._moon_timer, WorldEvents.BLOOD_MOON_DURATION))
	events._deactivate_moon()
	events._activate_moon(false)
	_check("forcée en pleine lune, elle l'est bien", events.moon_state == WorldEvents.Moon.FULL)
	_check("et prend la durée courte",
		is_equal_approx(events._moon_timer, WorldEvents.MOON_DURATION))
	events.free()


## Le point le plus facile à casser du lot : les deux événements se surveillent
## mutuellement, dans les DEUX sens.
func _test_mutual_exclusion() -> void:
	print("── Exclusion lune / tempête ──")
	var events := _new_events()
	events._activate_moon(false)
	# Une tempête ne doit pas démarrer sous une lune, même son délai écoulé.
	events._storm_next = 0.0
	_run(events, 3.0)
	_check("aucune tempête ne démarre sous une lune", not events.storm_active)
	events._deactivate_moon()
	events.free()

	var stormy := _new_events()
	stormy._activate_storm()
	# Et réciproquement : une lune ne se lève pas pendant une tempête.
	stormy._moon_next = 0.0
	_run(stormy, 3.0)
	_check("aucune lune ne se lève pendant une tempête",
		stormy.moon_state == WorldEvents.Moon.NONE)
	_check("le remplissage de la lune reste gelé", stormy.moon_fill_progress == 0.0)
	stormy.free()


func _test_storm_cycle() -> void:
	print("── Cycle de la tempête ──")
	var events := _new_events()
	events._activate_storm()
	_check("la tempête souffle", events.storm_active)
	_check("le vent se lève tout de suite", events.wind_force > 0.0)

	# Rafales : la force doit VARIER, pas rester à sa valeur d'ouverture. Ces dix
	# secondes comptent dans la durée de la tempête : on les retient pour vérifier
	# ensuite la durée TOTALE, et non seulement ce qu'il en restait.
	var min_force := INF
	var max_force := -INF
	var gust_seconds := 600.0 / 60.0
	for _i in 600:
		events.step(1.0 / 60.0)
		min_force = minf(min_force, events.wind_force)
		max_force = maxf(max_force, events.wind_force)
	_check("le vent souffle par rafales (%.2f → %.2f)" % [min_force, max_force],
		max_force - min_force > 1.0)
	_check("le vent reste dans les bornes du jeu d'origine",
		min_force >= 0.55 and max_force <= 2.45)
	_check("la tempête sature le mauvais temps", events.weather_target() == 1.0)

	var total := gust_seconds + _run(events, 40.0, func() -> bool: return not events.storm_active)
	_check("la tempête retombe toute seule", not events.storm_active)
	_check("après exactement %.0f s (%.2f mesurées)" % [WorldEvents.STORM_DURATION, total],
		absf(total - WorldEvents.STORM_DURATION) < 0.05)
	_check("et le vent retombe à zéro", events.wind_force == 0.0)
	events.free()


func _test_weather_cycle() -> void:
	print("── Météo ──")
	var events := _new_events()
	events._weather_next = 0.0
	_run(events, 0.5)
	_check("un épisode de pluie finit par se déclencher",
		events.weather_mode == WorldEvents.Weather.RAIN)
	_check("la pluie ne sature pas le mauvais temps (la tempête si)",
		is_equal_approx(events.weather_target(), 0.7))

	var duration := _run(events, 60.0, func() -> bool: return events.weather_mode == WorldEvents.Weather.CLEAR)
	_check("la pluie s'arrête toute seule", events.weather_mode == WorldEvents.Weather.CLEAR)
	_check("après une durée d'épisode plausible (%.1f s)" % duration,
		duration >= WorldEvents.RAIN_DURATION.x - 1.0 and duration <= WorldEvents.RAIN_DURATION.y + 1.0)
	events.free()

	# Les lunes gardent leur ciel dégagé : pas de pluie par-dessus.
	var moonlit := _new_events()
	moonlit._activate_moon(false)
	moonlit._weather_next = 0.0
	_run(moonlit, 3.0)
	_check("il ne pleut pas sous une lune", moonlit.weather_mode == WorldEvents.Weather.CLEAR)
	moonlit.free()


func _test_lightning() -> void:
	print("── Éclairs ──")
	var clear := _new_events()
	_run(clear, 20.0)
	_check("aucun éclair par temps clair", clear.lightning_flash == 0.0)
	clear.free()

	var stormy := _new_events()
	stormy._activate_storm()
	var flashed := false
	for _i in 60 * 12:
		stormy.step(1.0 / 60.0)
		if stormy.lightning_flash > 0.5:
			flashed = true
			break
	_check("il éclate des éclairs pendant la tempête", flashed)

	# Le flash doit s'éteindre, y compris quand le jeu est en pause (c'est tout
	# l'objet de `fade_lightning`, séparé de `step`).
	for _i in 60:
		stormy.fade_lightning(1.0 / 60.0)
	_check("un éclair s'éteint même sans que le jeu avance", stormy.lightning_flash == 0.0)
	stormy.free()


## Sous une lune, l'effectif d'ours n'est plus calculé mais imposé.
func _test_bear_pressure() -> void:
	print("── Pression des ours sous une lune ──")
	_check("pleine lune : effectif imposé à %d" % BearPack.FULL_MOON_COUNT,
		BearPack.moon_count(WorldEvents.Moon.FULL) == BearPack.FULL_MOON_COUNT)
	_check("lune de sang : effectif imposé à %d" % BearPack.BLOOD_MOON_COUNT,
		BearPack.moon_count(WorldEvents.Moon.BLOOD) == BearPack.BLOOD_MOON_COUNT)
	_check("hors lune, aucun effectif imposé",
		BearPack.moon_count(WorldEvents.Moon.NONE) == 0)
	# La lune doit passer OUTRE le plafond solo, sinon l'événement n'aurait
	# aucun effet en fin de partie, quand l'effectif y est déjà.
	_check("la lune dépasse le plafond ordinaire de %d" % BearPack.SOLO_MAX,
		BearPack.target(0.0, 0, BearPack.BLOOD_MOON_COUNT) > BearPack.SOLO_MAX)
	_check("et l'impose même à score nul",
		BearPack.target(0.0, 0, BearPack.FULL_MOON_COUNT) == BearPack.FULL_MOON_COUNT)
	_check("hors lune, le calcul ordinaire reprend",
		BearPack.target(BearPack.RAMP_TIME, 0, 0) == 2)


func _check(label: String, ok: bool) -> void:
	print("  %s %s" % ["[OK]  " if ok else "[FAIL]", label])
	if not ok:
		_failures += 1
