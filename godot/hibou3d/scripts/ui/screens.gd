class_name Screens
extends Control
## Chef d'orchestre des écrans — remplace `drawOverlay()` et les handlers
## `keydown`/`pointerdown` qui aiguillaient sur `state` (docs/hibou-3d.html
## lignes 2250-2464, 5942-5991). PLAN_GODOT.md §9 lot 6.
##
## Chaque écran (Start/Paused/Over/Settings) ne connaît que lui-même ; c'est ici
## que `GameState.state_changed` se traduit en visibilité, et que les entrées qui
## n'appartiennent à AUCUN bouton (clic dans le vide sur Start/Over, n'importe
## quelle touche pour reprendre la pause) sont captées — exactement le rôle du
## repli `if (state === S.START || state === S.OVER) beginGame(); else if
## (state === S.PAUSED) requestFlightPointerLock();` en fin de handler JS.
##
## Hors périmètre du lot 6 (aucun système derrière) : MP_LOBBY, CAMPAIGN_SELECT,
## CAMPAIGN_LOCK, QUICK_SELECT, LEVEL_END, CUTSCENE, MP_DEAD, LOOT — ces états ne
## sont jamais atteints tant que les lots 7/8/10/11 n'existent pas ; s'ils
## l'étaient, cet écran resterait simplement vide plutôt que de planter.

## Émis quand une nouvelle partie doit démarrer (bouton SOLO, ou repli clic/
## touche sur Start/Over) — `main.gd` seul sait faire respawn le hibou.
signal play_requested

@onready var _start: ScreenStart = %ScreenStart
@onready var _paused: ScreenPaused = %ScreenPaused
@onready var _over: ScreenOver = %ScreenOver
@onready var _settings: ScreenSettings = %ScreenSettings

## Câblé par `main.gd` : pilote `controls_enabled` et la sensibilité souris en
## direct depuis l'écran Réglages. `main.gd` l'assigne dans son propre `_ready()`,
## qui tourne APRÈS celui de ce nœud (les enfants finissent avant leur parent) :
## on resynchronise `controls_enabled` ici plutôt que de compter sur le premier
## `state_changed`, qui a déjà eu lieu sans lui à l'état initial START.
var owl_flight: OwlFlight:
	set(value):
		owl_flight = value
		_settings.owl_flight = value
		if owl_flight != null:
			owl_flight.controls_enabled = GameState.state == GameState.State.PLAY

var _settings_open := false


func _ready() -> void:
	GameState.state_changed.connect(_on_state_changed)
	_start.solo_pressed.connect(func() -> void: play_requested.emit())
	_settings.close_requested.connect(_close_settings)
	# Synchronise `controls_enabled` et la visibilité dès le départ : à l'état
	# initial START, aucun `change_state()` n'a encore été appelé pour le faire.
	_on_state_changed(GameState.state, GameState.state)


func _on_state_changed(_previous: GameState.State, current: GameState.State) -> void:
	if owl_flight != null:
		owl_flight.controls_enabled = current == GameState.State.PLAY
	_refresh_visibility()


func _refresh_visibility() -> void:
	var state := GameState.state
	_start.visible = state == GameState.State.START
	_paused.visible = state == GameState.State.PAUSED and not _settings_open
	_over.visible = state == GameState.State.OVER


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("toggle_settings"):
		_toggle_settings()
		get_viewport().set_input_as_handled()
		return

	if _settings_open:
		return  # Le clic extérieur est déjà géré par `ScreenSettings._gui_input`.

	match GameState.state:
		GameState.State.PLAY:
			if event.is_action_pressed("pause"):
				GameState.change_state(GameState.State.PAUSED)
				Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		GameState.State.PAUSED:
			# « Clique ou appuie sur une touche pour reprendre » (drawPaused) :
			# port simplifié du couple pointerlockchange/clavier JS, voir Écart
			# « pause pilotée par la perte du pointer-lock » (AVANCEMENT.md).
			if _is_press(event):
				GameState.change_state(GameState.State.PLAY)
				Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
		GameState.State.START, GameState.State.OVER:
			if _is_press(event):
				play_requested.emit()


static func _is_press(event: InputEvent) -> bool:
	if event is InputEventKey:
		return event.pressed and not event.echo
	if event is InputEventMouseButton:
		return event.pressed and event.button_index == MOUSE_BUTTON_LEFT
	return false


## Port de `toggleSettings()` : verrouillé pendant Over (et, au lot 7, Loot) —
## ouvrir des réglages sur un écran de fin de partie n'a pas de sens.
func _toggle_settings() -> void:
	if GameState.state == GameState.State.OVER:
		return
	_settings_open = not _settings_open
	_settings.visible = _settings_open
	if _settings_open:
		_settings.sync_from_state()
		if GameState.state == GameState.State.PLAY:
			GameState.change_state(GameState.State.PAUSED)
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_refresh_visibility()


func _close_settings() -> void:
	_settings_open = false
	_settings.visible = false
	_refresh_visibility()
