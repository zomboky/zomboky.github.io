extends SceneTree
## Recette des règles **pures** du lot 7 (PLAN_GODOT.md §9) : table de lots,
## position d'apparition des ramassables, effectif de la meute.
##
##   godot --headless --path godot/hibou3d --script res://tests/test_gameplay.gd
##
## Ces trois-là ne touchent ni scène ni autoload — d'où le mode `--script`, où la
## `SceneTree` est remplacée et où `GameState`/`Terrain` n'existent pas. Tout ce
## qui a besoin d'eux (score, combo, ours en vol, ramassage) est recetté par
## `tests/test_solo_round.tscn`, qui monte le vrai jeu.

var _failures := 0


func _init() -> void:
	_test_loot_table()
	_test_loot_pick()
	_test_collectible_spawn()
	_test_bear_target()

	print("")
	if _failures == 0:
		print("Lot 7 (règles pures) : tout est conforme.")
	else:
		printerr("Lot 7 (règles pures) : %d vérification(s) en échec." % _failures)
	quit(1 if _failures > 0 else 0)


func _test_loot_table() -> void:
	print("── Table des lots ──")
	_check("cinq lots, comme LOOT_TYPES", Loot.TYPES.size() == 5)
	var total := 0.0
	for loot in Loot.TYPES:
		total += loot["weight"]
	_check("les poids somment à 1", is_equal_approx(total, 1.0))
	# L'ordre fait partie du contrat : c'est lui qui découpe l'intervalle [0, 1).
	var ids: Array[String] = []
	for loot in Loot.TYPES:
		ids.append(loot["id"])
	var expected: Array[String] = ["speed", "slow", "multi", "life", "invincible"]
	_check("l'ordre est celui du jeu d'origine", ids == expected)
	_check("l'invincibilité dure plus longtemps que les autres bonus",
		Loot.INVINCIBLE_DURATION > Loot.BUFF_DURATION)


## Chaque lot doit occuper exactement sa part de l'intervalle. On sonde l'intérieur
## de chaque tranche et non ses bornes : `0,35 + 0,25` ne fait pas exactement `0,60`
## en flottant, et tester la frontière testerait l'arithmétique, pas la table.
func _test_loot_pick() -> void:
	print("── Tirage pondéré ──")
	var cases := {
		0.0: "speed", 0.1: "speed", 0.34: "speed",
		0.36: "slow", 0.5: "slow", 0.59: "slow",
		0.61: "multi", 0.7: "multi", 0.79: "multi",
		0.81: "life", 0.9: "life", 0.94: "life",
		0.96: "invincible", 0.999: "invincible",
	}
	for r: float in cases:
		var got: String = Loot.pick(r).get("id", "")
		_check("pick(%.3f) → %s" % [r, cases[r]], got == cases[r])


## Le tirage est aléatoire : on ne vérifie pas UNE position, mais les invariants
## que toutes doivent respecter — dans l'arène, au-dessus du sol, sous le plafond.
func _test_collectible_spawn() -> void:
	print("── Apparition des ramassables ──")
	# Sol plat fictif : ce test porte sur la géométrie du tirage, pas sur le relief.
	var ground := func(_x: float, _z: float) -> float: return 10.0
	var owl_pos := Vector3(300.0, 60.0, -200.0)
	var velocity := Vector3(0.0, 0.0, -20.0)

	var in_arena := true
	var above_ground := true
	var under_ceiling := true
	var in_range := true
	var forward_bias := 0
	const SAMPLES := 400
	for _i in SAMPLES:
		var p := CollectibleSpawn.pick(owl_pos, velocity, 35.0, 210.0, ground)
		var center := FlightModel.ARENA_CENTER
		if Vector2(p.x - center.x, p.z - center.z).length() > FlightModel.ARENA_RADIUS_XZ:
			in_arena = false
		if p.y < 10.0:
			above_ground = false
		if p.y > CollectibleSpawn.MAX_Y + 0.001:
			under_ceiling = false
		var flat := Vector2(p.x - owl_pos.x, p.z - owl_pos.z).length()
		# La borne haute peut être rognée par le rabattement vers le centre ; la
		# borne basse, elle, ne peut que l'être aussi — d'où le test à sens unique.
		if flat > 210.001:
			in_range = false
		# Le hibou file vers -Z : un tirage « devant » a donc un z plus petit.
		if p.z < owl_pos.z:
			forward_bias += 1

	_check("aucun ramassable hors de l'arène", in_arena)
	_check("aucun ramassable sous le sol", above_ground)
	_check("aucun ramassable au-dessus du plafond (%.0f u)" % CollectibleSpawn.MAX_Y, under_ceiling)
	_check("aucun ramassable au-delà de la distance demandée", in_range)
	# 60 % des tirages visent le cône de route (±0,9 rad) : la majorité doit tomber
	# devant. Un seuil large — c'est le biais qu'on vérifie, pas sa valeur exacte.
	_check("le tirage est bien biaisé vers l'avant (%d/%d)" % [forward_bias, SAMPLES],
		forward_bias > SAMPLES * 0.6)


## `bearTarget()` : rampe de 1 à 2 ours en BEAR_RAMP_TIME, puis +1 tous les 15
## points, plafonné à 10.
func _test_bear_target() -> void:
	print("── Effectif de la meute ──")
	_check("un seul ours au décollage", BearPack.target(0.0, 0) == 1)
	_check("toujours un ours à mi-rampe", BearPack.target(BearPack.RAMP_TIME * 0.4, 0) == 1)
	_check("deux ours une fois la rampe finie", BearPack.target(BearPack.RAMP_TIME, 0) == 2)
	_check("la rampe ne redescend jamais", BearPack.target(BearPack.RAMP_TIME * 10.0, 0) == 2)
	_check("un ours de plus tous les 15 points",
		BearPack.target(BearPack.RAMP_TIME, 15) == 3 and BearPack.target(BearPack.RAMP_TIME, 45) == 5)
	_check("le score seul ne suffit pas à sauter la rampe", BearPack.target(0.0, 15) == 2)
	_check("l'effectif plafonne à %d" % BearPack.SOLO_MAX,
		BearPack.target(BearPack.RAMP_TIME, 10000) == BearPack.SOLO_MAX)


func _check(label: String, ok: bool) -> void:
	print("  %s %s" % ["[OK]  " if ok else "[FAIL]", label])
	if not ok:
		_failures += 1
