class_name Main
extends Node3D
## Racine du jeu : elle relie le monde, le hibou, les règles et les écrans.
##
## Le décor et le hibou sont écrits sans se connaître — la forêt ne sait pas qu'un
## hibou existe, le vol ne sait pas qu'il y a des arbres, les règles de jeu ne
## savent pas dessiner. C'est ici, et seulement ici, que tout est branché, et que
## les **transitions d'état** sont décidées : les autres nœuds signalent ce qui
## leur arrive (« je me suis écrasé », « j'ai ouvert un cadeau »), jamais ce qui
## doit s'ensuivre.

# Chemins explicites et non noms uniques (`%`) : ceux-ci ne se résolvent que dans
# la scène qui les déclare, or la forêt et le village appartiennent à `world.tscn`.
@onready var owl: Owl = $Owl
@onready var world: GameWorld = $World
@onready var sky: SkySystem = $Sky
@onready var round_rules: SoloRound = $Entities
@onready var events: WorldEvents = $Events
@onready var hud: Hud = $UI/Hud
@onready var screens: Screens = $UI/Screens

@onready var _flight: OwlFlight = owl.get_node("Flight")

## Niveau de mauvais temps lissé, dans [0, 1]. Amorti frame après frame vers
## `WorldEvents.weather_target()` : un ciel ne se couvre pas d'un coup.
var _weather_level := 0.0


func _ready() -> void:
	# La caméra ne doit traverser ni le feuillage ni le relief. Le test des arbres
	# est analytique (cônes et cylindres) : il n'y a aucun corps physique à croiser.
	owl.camera.point_in_tree = world.forest.point_inside_tree
	_flight.tree_test = world.forest.point_inside_tree
	# Les lumières de feu de camp suivent le joueur : sept lumières pour une
	# trentaine de foyers, réassignées aux plus proches.
	world.village.player = owl
	# La lumière céleste unique (soleil/lune) reste proche du joueur, comme
	# `moonLight.position` dans le jeu d'origine.
	sky.player = owl
	# L'avertissement de bord d'arène s'allume en fonction de la distance du hibou
	# à la muraille ellipsoïde.
	world.boundary_grid.player = owl

	hud.owl = owl
	hud.owl_flight = _flight
	hud.round_rules = round_rules
	screens.owl_flight = _flight
	screens.play_requested.connect(begin_game)
	screens.loot_granted.connect(_on_loot_granted)
	screens.loot_finished.connect(_on_loot_finished)

	round_rules.owl = owl
	round_rules.owl_flight = _flight
	round_rules.pickup_area = owl.get_node("PickupArea")
	round_rules.world_events = events
	world.precipitation.ground_y = Terrain.effective_ground_y
	# `deactivateStorm()` balaie les rochers encore en l'air (ligne 1325) : sans
	# cela, un caillou lâché juste avant la fin continuerait sa chute et pourrait
	# tuer bien après que le vent soit retombé.
	events.storm_ended.connect(round_rules.rocks.clear_all)
	round_rules.owl_died.connect(_game_over)
	round_rules.gift_opened.connect(_on_gift_opened)
	_flight.crashed_into_ground.connect(_on_crashed_into_ground)

	# Caché jusqu'au premier lancement de partie, comme `owlGroup.visible = false`
	# à la construction du jeu JS (ligne 1958) : l'écran d'accueil ne montre pas
	# un hibou déjà planté au centre de l'arène.
	owl.visible = false


## Port de `beginGame()` (ligne 6014), branche solo. L'ordre compte : la carte est
## régénérée **avant** que le hibou et les entités ne se replacent, car branches et
## ours s'accrochent à la hauteur du sol — celle de la nouvelle carte.
func begin_game() -> void:
	world.regenerate()
	GameState.reset_round()
	_flight.model.reset()
	events.reset()
	world.precipitation.reset(_flight.model.position)
	round_rules.begin()
	owl.visible = true
	GameState.change_state(GameState.State.PLAY)
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


## Port de `onGroundCrash()` (ligne 2791). Contrairement aux ours, le sol ne
## retire pas une vie : il tue net, quel qu'en soit le compte.
func _on_crashed_into_ground() -> void:
	if GameState.state != GameState.State.PLAY:
		return
	_game_over("crash")


func _game_over(reason: String) -> void:
	GameState.best = maxi(GameState.best, GameState.score)
	owl.visible = false
	GameState.over_reason = reason
	GameState.change_state(GameState.State.OVER)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


## Le cadeau est ramassé : le vol se fige derrière la roulette, qui met en scène
## un lot déjà tiré (`state = S.LOOT` dans `updateGift()`).
func _on_gift_opened(loot: Dictionary) -> void:
	screens.open_lootbox(loot)
	GameState.change_state(GameState.State.LOOT)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


func _on_loot_granted(loot: Dictionary) -> void:
	round_rules.apply_loot(loot.get("id", ""))


func _on_loot_finished() -> void:
	GameState.change_state(GameState.State.PLAY)
	round_rules.resume_after_loot()
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


## Les événements du monde n'avancent **qu'en jeu** : une lune ne se lève pas
## derrière un écran de pause. Port de leur place dans la branche `S.PLAY` de
## `update()` (lignes 6096-6102).
func _physics_process(delta: float) -> void:
	if GameState.state != GameState.State.PLAY:
		return
	# Aucune lune ne se déclenche naturellement en plein jour : l'événement lit
	# l'heure au ciel plutôt que de la recalculer.
	events.day_factor = sky.day_factor
	events.step(delta)
	# Le modèle de vol ne connaît pas les événements : c'est ici qu'il reçoit le
	# vent, exactement comme il reçoit le bonus ⚡ depuis `SoloRound`.
	var storm := _flight.model.storm
	storm.active = events.storm_active
	storm.wind_angle = events.wind_angle
	storm.wind_force = events.wind_force


## Le **rendu** de la météo, lui, tourne toujours — y compris derrière un menu :
## « la pluie ne se fige pas » (commentaire de `updateWeatherFX`, ligne 1535). Le
## niveau de mauvais temps est amorti ici et non dans `WorldEvents`, qui n'a pas à
## savoir qu'un ciel met quelques secondes à se plomber.
func _process(delta: float) -> void:
	events.fade_lightning(delta)
	_weather_level += (events.weather_target() - _weather_level) * minf(1.0, 1.2 * delta)

	sky.moon_fill_progress = events.moon_fill_progress
	sky.moon_blood = events.moon_state == WorldEvents.Moon.BLOOD
	sky.weather_level = _weather_level
	sky.lightning_flash = events.lightning_flash

	world.precipitation.step(delta, owl.global_position, _weather_level,
		events.storm_active, events.wind_angle, events.wind_force)
