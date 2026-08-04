extends SceneTree
## Recette du lot 6 (PLAN_GODOT.md §9) — machine à états et état de manche solo.
##
## `GameState` est un autoload, indisponible en mode `--script` (Écart n°4,
## AVANCEMENT.md) : ce test instancie donc le script directement
## (`preload(...).new()`) plutôt que de référencer le singleton global — la
## logique testée est exactement la même, aucun de ces champs ni méthodes ne
## dépend du mécanisme de singleton lui-même.
##
## Lancer : godot --headless --path godot/hibou3d --script res://tests/test_game_state.gd

const GameStateScript := preload("res://autoload/game_state.gd")

var _failures := 0

# Réceptacles des signaux, en variables de script et non en variables locales
# capturées par une lambda : les fermetures GDScript capturent les variables
# locales **par valeur** (une copie figée à la création), les réassigner
# depuis l'intérieur d'une lambda ne se voit jamais à l'extérieur. Se
# connecter à une méthode liée à `self` n'a pas ce problème.
var _seen_previous := -1
var _seen_current := -1
var _seen_score := -1


func _init() -> void:
	_run.call_deferred()


func _on_state_changed(previous: int, current: int) -> void:
	_seen_previous = previous
	_seen_current = current


func _on_score_changed(new_score: int) -> void:
	_seen_score = new_score


func _run() -> void:
	# L'ordre de l'enum est le contrat : il doit rester identique à `const S = {
	# START: 0, PLAY: 1, OVER: 2, PAUSED: 3, LOOT: 4, MP_LOBBY: 5, MP_DEAD: 6,
	# CAMPAIGN_SELECT: 7, LEVEL_END: 8, CUTSCENE: 9, CAMPAIGN_LOCK: 10,
	# QUICK_SELECT: 11 }` (docs/hibou-3d.html ligne 92).
	var s := GameStateScript.State
	_check("START = 0", s.START == 0)
	_check("PLAY = 1", s.PLAY == 1)
	_check("OVER = 2", s.OVER == 2)
	_check("PAUSED = 3", s.PAUSED == 3)
	_check("LOOT = 4", s.LOOT == 4)
	_check("MP_LOBBY = 5", s.MP_LOBBY == 5)
	_check("MP_DEAD = 6", s.MP_DEAD == 6)
	_check("CAMPAIGN_SELECT = 7", s.CAMPAIGN_SELECT == 7)
	_check("LEVEL_END = 8", s.LEVEL_END == 8)
	_check("CUTSCENE = 9", s.CUTSCENE == 9)
	_check("CAMPAIGN_LOCK = 10", s.CAMPAIGN_LOCK == 10)
	_check("QUICK_SELECT = 11", s.QUICK_SELECT == 11)

	var gs: Node = GameStateScript.new()

	# État initial — reflète les globales JS avant tout `beginGame()`.
	_check("état initial = START", gs.state == s.START)
	_check("score initial = 0", gs.score == 0)
	_check("nid initial = 0", gs.nest == 0)
	_check("combo initial = 1", gs.combo == 1)
	_check("vies initiales = 1", gs.lives == 1)
	_check("meilleur score initial = 0", gs.best == 0)
	_check("sensibilité souris initiale = 0.5", is_equal_approx(gs.mouse_sensitivity, 0.5))
	_check("aucun bonus actif au départ", not gs.buffs.is_any_active())

	# `change_state()` doit prévenir les écouteurs avec l'ancien ET le nouvel état
	# — c'est ce qui permet à `screens.gd` de savoir, par exemple, qu'on quitte
	# PLAY (et donc de couper `OwlFlight.controls_enabled`) sans avoir à
	# comparer lui-même à l'état précédent.
	gs.state_changed.connect(_on_state_changed)
	gs.change_state(s.PLAY)
	_check("change_state met à jour l'état courant", gs.state == s.PLAY)
	_check("state_changed transmet l'état précédent", _seen_previous == s.START)
	_check("state_changed transmet le nouvel état", _seen_current == s.PLAY)

	# Le score a un setter qui émet `score_changed` — c'est lui que le HUD
	# écouterait pour ne redessiner le score qu'au changement plutôt qu'à
	# chaque frame, si un jour ce n'était plus `queue_redraw()` systématique.
	gs.score_changed.connect(_on_score_changed)
	gs.score = 42
	_check("score_changed transmet la nouvelle valeur", _seen_score == 42)

	# `reset_round()` est le sous-ensemble de `beginGame()` (ligne 6034) que le
	# lot 6 peut tester : score/nid/combo/vies/bonus repartent à zéro, MAIS ni
	# l'état de jeu (`state`) ni les réglages persistants (`best`,
	# `mouse_sensitivity`) ne sont concernés — ce ne sont pas des globales de
	# manche.
	gs.nest = 77
	gs.combo = 6
	gs.combo_timer = 40.0
	gs.lives = 3
	gs.over_reason = "rock"
	gs.buffs.speed = 5.0
	gs.best = 99
	gs.mouse_sensitivity = 0.8
	gs.reset_round()
	_check("reset_round remet le score à 0", gs.score == 0)
	_check("reset_round remet le nid à 0", gs.nest == 0)
	_check("reset_round remet le combo à 1", gs.combo == 1)
	_check("reset_round remet le minuteur de combo à 0", is_equal_approx(gs.combo_timer, 0.0))
	_check("reset_round remet les vies à 1", gs.lives == 1)
	_check("reset_round remet la raison de fin à 'eaten'", gs.over_reason == "eaten")
	_check("reset_round coupe tous les bonus", not gs.buffs.is_any_active())
	_check("reset_round ne touche pas au meilleur score", gs.best == 99)
	_check("reset_round ne touche pas à la sensibilité souris", is_equal_approx(gs.mouse_sensitivity, 0.8))
	_check("reset_round ne touche pas à l'état de jeu", gs.state == s.PLAY)

	gs.free()  # Node hors arbre : pas de comptage de références, à libérer à la main.

	print("")
	if _failures == 0:
		print("Lot 6 : recette GameState OK.")
	else:
		printerr("Lot 6 : %d vérification(s) en échec." % _failures)
	quit(0 if _failures == 0 else 1)


func _check(label: String, ok: bool) -> void:
	print("  %s %s" % ["[OK]  " if ok else "[FAIL]", label])
	if not ok:
		_failures += 1
