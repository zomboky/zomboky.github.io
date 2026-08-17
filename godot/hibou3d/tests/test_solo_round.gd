extends Node
## Recette du lot 7 (PLAN_GODOT.md §9) : une partie solo, jouée pour de vrai.
##
##   godot --headless --path godot/hibou3d res://tests/test_solo_round.tscn
##
## ⚠️ Comme `test_world.tscn`, ce harnais se lance en **exécution normale** avec un
## chemin de scène, et non via `--script` : il lui faut `GameState` et `Terrain`,
## qui sont des autoloads et n'existent pas quand la `SceneTree` est remplacée.
##
## Le ramassage passe par le serveur physique (`Area3D`, décision B) : ses
## recouvrements sont calculés **pendant** le pas de physique et lus au pas
## suivant. Chaque vérification laisse donc passer quelques frames plutôt que de
## conclure dans la foulée — c'est une latence réelle du moteur, pas une marge de
## confort.

## Frames de physique laissées à la sonde pour voir un objet qu'on vient de poser.
const SETTLE_FRAMES := 5

var _failures := 0
var _main: Main
var _owl: Owl
var _flight: OwlFlight
var _round: SoloRound
var _branches: Node3D
var _bears: Node3D


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	_main = load("res://scenes/main.tscn").instantiate()
	add_child(_main)
	var terrain_mesh: TerrainMesh = _main.get_node("World/Terrain")
	await terrain_mesh.build_finished

	_owl = _main.owl
	_flight = _owl.get_node("Flight")
	_round = _main.round_rules
	_branches = _round.get_node("Branches")
	_bears = _round.get_node("Bears")

	# On veut recetter les RÈGLES, pas la capacité du hibou à éviter une forêt
	# tirée au hasard : sans commandes, il finirait par percuter un arbre et le
	# choc fausserait tout ce qui suit.
	_flight.tree_test = Callable()

	await _test_begin_game()
	await _test_branch_collection()
	await _test_rotten_branch()
	await _test_nest_grants_life()
	await _test_multi_buff()
	await _test_bear_costs_a_life()
	await _test_bear_ends_the_game()
	_test_buff_decay()
	_test_lootbox_roulette()

	print("")
	if _failures == 0:
		print("Lot 7 : la partie solo est conforme.")
	else:
		printerr("Lot 7 : %d vérification(s) en échec." % _failures)
	get_tree().quit(1 if _failures > 0 else 0)


# ══════════════════════════════════════════════════════════════════════════
#  Départ de partie
# ══════════════════════════════════════════════════════════════════════════

func _test_begin_game() -> void:
	print("── beginGame() ──")
	var seed_before := Terrain.terrain_seed
	_main.begin_game()
	# Avant toute frame de physique : passé celle-ci, le clignotement
	# d'invulnérabilité éteint le hibou une frame sur deux, et `visible` ne veut
	# plus rien dire tant que la protection de décollage n'a pas expiré.
	_check("le hibou est de retour en jeu", _owl.visible)
	await _frames(2)

	_check("la partie passe en PLAY", GameState.state == GameState.State.PLAY)
	_check("chaque partie se joue sur une carte neuve", Terrain.terrain_seed != seed_before)
	_check("l'état de manche repart de zéro",
		GameState.score == 0 and GameState.nest == 0 and GameState.combo == 1
		and GameState.lives == 1)
	_check("aucun bonus au décollage", not GameState.buffs.is_any_active())
	_check("le champ compte %d branches" % BranchField.COUNT,
		_live_branches().size() == BranchField.COUNT)
	_check("la meute démarre à %d ours" % BearPack.INITIAL_COUNT,
		_active_bears().size() == BearPack.INITIAL_COUNT)
	_check("le chrono de manche repart de zéro", _round.round_time < 0.2)

	# Les branches doivent être trouvables : semées autour du hibou, pas dans
	# les 1 400 u d'arène. C'est tout l'objet de `collectibleSpawnPos`.
	var far := 0
	for branch in _live_branches():
		if branch.position.distance_to(_owl.global_position) > 260.0:
			far += 1
	_check("toutes les branches apparaissent à portée du hibou", far == 0)

	# L'invulnérabilité de décollage protège le temps de prendre ses marques.
	await _frames(SoloRound.INVUL_START + 5)
	_check("le hibou est visible une fois l'invulnérabilité passée", _owl.visible)


# ══════════════════════════════════════════════════════════════════════════
#  Branches, combo, nid
# ══════════════════════════════════════════════════════════════════════════

func _test_branch_collection() -> void:
	print("── Collecte, score et combo ──")
	var branch := _healthy_branch()
	await _collect(branch)
	_check("une première branche vaut %d points" % BranchField.SCORE_MULT,
		GameState.score == BranchField.SCORE_MULT)
	_check("le nid avance d'un cran", GameState.nest == 1)
	_check("le combo monte à 2", GameState.combo == 2)
	_check("le combo est rechargé à plein", GameState.combo_timer > GameState.MAX_COMBO_TIME - 10.0)
	_check("la branche ramassée est repartie ailleurs",
		branch.position.distance_to(_owl.global_position) > Branch.COLLECT_RADIUS)

	# Le combo multiplie : la deuxième branche vaut deux fois la première.
	var before := GameState.score
	await _collect(_healthy_branch())
	_check("la deuxième branche vaut le double (combo x2)",
		GameState.score - before == 2 * BranchField.SCORE_MULT)
	_check("le combo monte à 3", GameState.combo == 3)


func _test_rotten_branch() -> void:
	print("── Branche pourrie ──")
	var branch := _healthy_branch()
	branch.rotten = true
	var score_before := GameState.score
	var nest_before := GameState.nest
	await _collect(branch)
	_check("une branche pourrie ne rapporte rien", GameState.score == score_before)
	_check("une branche pourrie ne remplit pas le nid", GameState.nest == nest_before)
	# `combo = 0` dans le JS, mais le compteur retombe à 1 dans la FOULÉE : la
	# collecte et le décompte du combo ont lieu dans la même frame, et un
	# compteur vide ramène toujours le combo à 1. La valeur 0 n'est donc jamais
	# observable — ce qui compte, c'est que la série soit repartie de zéro.
	_check("une branche pourrie casse le combo", GameState.combo == 1)
	_check("et vide son compteur", GameState.combo_timer == 0.0)

	# `Math.max(1, combo)` : un combo cassé se comporte comme un combo de 1.
	await _collect(_healthy_branch())
	_check("la branche suivante repart à la valeur de base",
		GameState.score - score_before == BranchField.SCORE_MULT)
	_check("et le combo repart à 2", GameState.combo == 2)


func _test_nest_grants_life() -> void:
	print("── Le nid rend une vie ──")
	GameState.nest = 99
	var lives_before := GameState.lives
	await _collect(_healthy_branch())
	_check("le nid plein rend une vie", GameState.lives == lives_before + 1)
	_check("et le nid repart de son trop-plein", GameState.nest == 0)


func _test_multi_buff() -> void:
	print("── Bonus ✨ Score x5 ──")
	GameState.buffs.multi = 5.0
	GameState.combo = 1
	var before := GameState.score
	await _collect(_healthy_branch())
	_check("le bonus multiplie le gain par cinq",
		GameState.score - before == 5 * BranchField.SCORE_MULT)
	GameState.buffs.multi = 0.0


# ══════════════════════════════════════════════════════════════════════════
#  Ours
# ══════════════════════════════════════════════════════════════════════════

func _test_bear_costs_a_life() -> void:
	print("── Contact d'un ours ──")
	GameState.lives = 3
	var bear := _active_bears()[0]
	await _touch(bear)
	_check("un ours retire une vie", GameState.lives == 2)
	_check("la partie continue tant qu'il reste des vies",
		GameState.state == GameState.State.PLAY)

	# Le hibou reste collé à l'ours : l'invulnérabilité doit tenir bon. C'est ce
	# que le recouvrement continu (et non le signal `area_entered`) permet de
	# vérifier — le contact est toujours là, il ne doit simplement pas compter.
	await _touch(bear)
	_check("l'invulnérabilité encaisse le contact suivant", GameState.lives == 2)


func _test_bear_ends_the_game() -> void:
	print("── Game over ──")
	# On attend la fin de l'invulnérabilité, puis on retente le même contact :
	# le hibou n'a pas bougé, l'ours non plus, seule la protection a expiré.
	await _frames(SoloRound.INVUL_HIT + 5)
	GameState.lives = 1
	var bear := _active_bears()[0]
	await _touch(bear)
	_check("la dernière vie perdue termine la partie",
		GameState.state == GameState.State.OVER)
	_check("l'écran de fin sait qu'on s'est fait manger", GameState.over_reason == "eaten")
	_check("le hibou disparaît", not _owl.visible)
	_check("le meilleur score est retenu", GameState.best >= GameState.score)


func _test_buff_decay() -> void:
	print("── Décroissance des bonus ──")
	# Hors PLAY, les règles ne tournent plus : on vérifie la fonction elle-même.
	GameState.buffs.speed = 1.0
	GameState.buffs.invincible = 0.05
	_round._decay_buffs(0.1)
	_check("un bonus s'écoule en secondes", is_equal_approx(GameState.buffs.speed, 0.9))
	_check("un bonus épuisé s'arrête à zéro", GameState.buffs.invincible == 0.0)
	_check("le bonus ⚡ est répercuté au modèle de vol", _flight.model.speed_buff)
	GameState.buffs.speed = 0.0
	_round._decay_buffs(0.1)
	_check("et se coupe quand il expire", not _flight.model.speed_buff)


# ══════════════════════════════════════════════════════════════════════════
#  Roulette
# ══════════════════════════════════════════════════════════════════════════

## Jouée à la main plutôt qu'en temps réel : la roulette dure ~4,5 s, et sa
## logique ne dépend que du `dt` qu'on lui donne. On lui sert donc 600 pas de
## 1/60 s d'affilée, ce qui la déroule intégralement et instantanément.
func _test_lootbox_roulette() -> void:
	print("── Roulette du cadeau ──")
	var lootbox: ScreenLootbox = _main.screens.get_node("ScreenLootbox")
	var granted: Array[Dictionary] = []
	var finished := [false]
	lootbox.loot_granted.connect(func(loot: Dictionary) -> void: granted.append(loot))
	lootbox.finished.connect(func() -> void: finished[0] = true)

	var result := Loot.TYPES[4]  # l'invincibilité : le lot rare, et le seul rendu à part
	lootbox.open(result)
	for _i in 600:
		lootbox._process(1.0 / 60.0)
		if finished[0]:
			break

	_check("la roulette s'arrête", finished[0])
	_check("le bonus est accordé une seule fois", granted.size() == 1)
	_check("et c'est bien le lot tiré d'avance",
		granted.size() == 1 and granted[0].get("id", "") == "invincible")

	# La bande est construite AUTOUR du résultat : c'est la case gagnante qui
	# doit s'arrêter sous le curseur, pas une case au hasard.
	GameState.lives = 1
	GameState.buffs.invincible = 0.0
	_round.apply_loot("invincible")
	_check("le lot appliqué a bien pris effet",
		is_equal_approx(GameState.buffs.invincible, Loot.INVINCIBLE_DURATION))
	_round.apply_loot("life")
	_check("le lot ❤️ rend une vie", GameState.lives == 2)


# ══════════════════════════════════════════════════════════════════════════
#  Outils
# ══════════════════════════════════════════════════════════════════════════

## Pose une branche sur le hibou et laisse la sonde la voir.
func _collect(branch: Branch) -> void:
	branch.move_to(_owl.global_position)
	await _frames(SETTLE_FRAMES)


## Idem pour un ours, dont on annule la grâce d'apparition : elle n'a de sens
## qu'au moment où il surgit, pas quand on le pose délibérément sur le joueur.
func _touch(bear: Bear) -> void:
	bear.position = _owl.global_position
	bear.spawn_grace = 0
	await _frames(SETTLE_FRAMES)


## Le hibou vole **sans pilote** pendant tout le harnais : livré à lui-même, il
## finit par toucher le sol, et un game over « crash » viendrait fausser tout ce
## qui suit (c'est arrivé, selon le relief tiré au hasard). On le maintient donc
## en altitude — la chute libre n'est pas l'objet de cette recette, elle est
## couverte par la parité du vol du lot 2.
func _frames(count: int) -> void:
	for _i in count:
		if GameState.state == GameState.State.PLAY:
			var p := _flight.model.position
			_flight.model.position.y = maxf(p.y, Terrain.effective_ground_y(p.x, p.z) + 120.0)
		await get_tree().physics_frame


func _live_branches() -> Array[Branch]:
	var out: Array[Branch] = []
	for child in _branches.get_children():
		out.append(child as Branch)
	return out


func _active_bears() -> Array[Bear]:
	var out: Array[Bear] = []
	for child in _bears.get_children():
		var bear := child as Bear
		if bear.active:
			out.append(bear)
	return out


## Une branche saine, prise dans le champ — les pourries y sont mêlées au hasard.
func _healthy_branch() -> Branch:
	for branch in _live_branches():
		if not branch.rotten:
			return branch
	return _live_branches()[0]


func _check(label: String, ok: bool) -> void:
	print("  %s %s" % ["[OK]  " if ok else "[FAIL]", label])
	if not ok:
		_failures += 1
