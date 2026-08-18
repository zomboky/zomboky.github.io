extends Node
## Recette du lot 8 côté scène : ce que la machine à états ne peut pas prouver
## seule — des rochers qui tombent vraiment, une pluie qui se lève, un ciel qui
## se plombe, et un caillou qui tue.
##
##   godot --headless --path godot/hibou3d res://tests/test_storm.tscn
##
## Comme `test_solo_round.tscn`, ce harnais se lance en **exécution normale** :
## il lui faut `GameState`, `Terrain` et le serveur physique.

const SETTLE_FRAMES := 5

var _failures := 0
var _main: Main
var _owl: Owl
var _flight: OwlFlight
var _events: WorldEvents
var _rocks: RockStorm
var _terrain: TerrainMesh


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	_main = load("res://scenes/main.tscn").instantiate()
	add_child(_main)
	_terrain = _main.get_node("World/Terrain")
	await _terrain.build_finished

	_owl = _main.owl
	_flight = _owl.get_node("Flight")
	_events = _main.events
	_rocks = _main.round_rules.rocks
	_flight.tree_test = Callable()

	_main.begin_game()
	await _frames(2)
	_check("la partie démarre par temps clair",
		not _events.is_moon_active() and not _events.storm_active)
	_check("aucun rocher au décollage", _rocks.active_count() == 0)

	await _test_storm_drops_rocks()
	await _test_rocks_reach_the_ground()
	await _test_weather_darkens_the_sky()
	await _test_rock_is_fatal()
	await _test_storm_cleans_up()

	# Le dernier `begin_game()` a relancé une construction de terrain en tâche de
	# fond : on la laisse finir avant de quitter, sinon sa coroutine reste
	# suspendue et Godot signale une instance non libérée à la sortie.
	await _terrain.build_finished

	print("")
	if _failures == 0:
		print("Lot 8 : la tempête est conforme.")
	else:
		printerr("Lot 8 : %d vérification(s) en échec." % _failures)
	get_tree().quit(1 if _failures > 0 else 0)


func _test_storm_drops_rocks() -> void:
	print("── La tempête fait tomber des rochers ──")
	_events._activate_storm()
	await _frames(90)
	_check("la tempête souffle", _events.storm_active)
	_check("des rochers tombent (%d)" % _rocks.active_count(), _rocks.active_count() > 0)
	_check("le vent est répercuté au modèle de vol",
		_flight.model.storm.active and _flight.model.storm.wind_force > 0.0)

	# Le vivier est plafonné : une tempête longue ne doit pas remplir la scène.
	await _frames(600)
	_check("le vivier reste plafonné à %d (%d en vol)" % [RockStorm.MAX, _rocks.active_count()],
		_rocks.active_count() <= RockStorm.MAX)


## Un rocher n'est pas un décor : il tombe, **accélère**, et disparaît au sol.
##
## La chute est mesurée sur un rocher **isolé**, monté hors du vivier et poussé à
## la main : dans la tempête, un rocher qui touche le sol est immédiatement recyclé
## pour la chute suivante, et la mesure porterait alors sur un autre caillou
## réapparu 100 u plus haut (c'est exactement ce qui a fait échouer une première
## version de ce test).
func _test_rocks_reach_the_ground() -> void:
	print("── Les rochers tombent vraiment ──")
	var rock: Rock = load("res://scenes/entities/rock.tscn").instantiate()
	add_child(rock)
	var ground := func(_x: float, _z: float) -> float: return 0.0
	rock.spawn(Vector3(0, 400, 0), Vector3.ZERO, 0.3)
	rock.position = Vector3(0, 400, 0)

	var start_y := rock.position.y
	for _i in 20:
		rock.step(1.0 / 60.0, false, 0.0, 0.0, ground)
	var first_drop := start_y - rock.position.y
	var mid_y := rock.position.y
	for _i in 20:
		rock.step(1.0 / 60.0, false, 0.0, 0.0, ground)
	var second_drop := mid_y - rock.position.y

	_check("un rocher descend", first_drop > 0.0)
	# La chute accélère jusqu'à une vitesse terminale : sur les premières
	# secondes, la seconde tranche doit être franchement plus longue.
	_check("et sa chute accélère (%.2f u puis %.2f u)" % [first_drop, second_drop],
		second_drop > first_drop * 1.05)

	# Il finit par toucher le sol, et le signale à son vivier.
	var alive := true
	var steps := 0
	while alive and steps < 3000:
		alive = rock.step(1.0 / 60.0, false, 0.0, 0.0, ground)
		steps += 1
	_check("il finit par toucher le sol", not alive)
	_check("et il le signale à hauteur de sol (y = %.2f)" % rock.position.y,
		rock.position.y < 1.0)

	# Le vent le pousse de côté — c'est ce qui fait qu'une tempête balaie la zone.
	rock.spawn(Vector3(0, 400, 0), Vector3.ZERO, 0.3)
	rock.position = Vector3(0, 400, 0)
	for _i in 60:
		rock.step(1.0 / 60.0, true, 0.0, 2.0, ground)
	_check("le vent emporte les rochers (%.2f u de dérive)" % rock.position.x,
		rock.position.x > 1.0)
	rock.queue_free()

	# Et dans la vraie tempête, aucun rocher ne doit jamais s'enfoncer sous le sol.
	var sunk := 0
	var seen := 0
	for _i in 240:
		await get_tree().physics_frame
		for r in _active_rocks():
			seen += 1
			var g := Terrain.effective_ground_y(r.global_position.x, r.global_position.z)
			if r.global_position.y - r.rock_scale * 0.4 < g - 1.0:
				sunk += 1
	_check("aucun rocher ne s'enfonce dans le sol (%d observations)" % seen,
		seen > 0 and sunk == 0)


func _test_weather_darkens_the_sky() -> void:
	print("── Le ciel se plombe ──")
	var sky: SkySystem = _main.sky
	await _frames(120)
	_check("le mauvais temps monte vers son maximum sous la tempête",
		sky.weather_level > 0.8)
	_check("le brouillard se resserre",
		sky.get_node("WorldEnvironment").environment.fog_depth_end
			< Terrain.ARENA_RADIUS_XZ * SkySystem.FOG_END_CLEAR)
	_check("la pluie est levée", _main.world.precipitation.visible)


## Contrairement à l'ours, le rocher ne retire pas une vie : il tue net.
func _test_rock_is_fatal() -> void:
	print("── Un rocher tue net ──")
	GameState.lives = 5
	var rock := _active_rocks()[0]
	rock.global_position = _owl.global_position
	await _frames(SETTLE_FRAMES)
	_check("la partie s'arrête malgré les vies restantes",
		GameState.state == GameState.State.OVER)
	_check("l'écran de fin sait qu'on s'est fait écraser", GameState.over_reason == "rock")
	_check("le hibou disparaît", not _owl.visible)


func _test_storm_cleans_up() -> void:
	print("── Fin de tempête ──")
	# On relance une partie : `beginGame()` doit balayer les rochers restants.
	_main.begin_game()
	await _frames(3)
	_check("une nouvelle partie repart sans rochers", _rocks.active_count() == 0)
	_check("et sans tempête", not _events.storm_active)
	_check("le vent est retombé côté modèle de vol", not _flight.model.storm.active)

	# Puis une tempête qu'on laisse expirer : elle doit faire le ménage SEULE.
	# Sans cela, un caillou lâché juste avant la fin continuerait sa chute et
	# pourrait tuer bien après que le vent soit retombé.
	_events._activate_storm()
	await _frames(60)
	var during := _rocks.active_count()
	_events._deactivate_storm()
	await _frames(3)
	_check("la fin de tempête retire les rochers en vol (%d pendant)" % during,
		during > 0 and _rocks.active_count() == 0)


func _active_rocks() -> Array[Rock]:
	var out: Array[Rock] = []
	for child in _rocks.get_children():
		var rock := child as Rock
		if rock.active:
			out.append(rock)
	return out


func _frames(count: int) -> void:
	for _i in count:
		if GameState.state == GameState.State.PLAY:
			var p := _flight.model.position
			_flight.model.position.y = maxf(p.y, Terrain.effective_ground_y(p.x, p.z) + 120.0)
		await get_tree().physics_frame


func _check(label: String, ok: bool) -> void:
	print("  %s %s" % ["[OK]  " if ok else "[FAIL]", label])
	if not ok:
		_failures += 1
