class_name WorldEvents
extends Node
## Les événements qui bousculent une partie : **pleine lune**, **lune de sang**,
## **tempête** et **météo**. Port de `updateMoon()`, `updateStorm()` et
## `updateWeatherLogic()` (docs/hibou-3d.html lignes 1222-1305, 1310-1356,
## 1506-1531). PLAN_GODOT.md §9 lot 8.
##
## Trois horloges indépendantes, mais **pas** trois systèmes indépendants :
## - une lune et une tempête ne se déclenchent **jamais** ensemble (exclusion
##   mutuelle explicite dans les deux sens) ;
## - la pluie s'arrête sous une lune (qui garde son ciel dégagé dramatique) et
##   passe en mode battant sous une tempête, qui est son paroxysme ;
## - les éclairs n'existent que pendant la tempête.
##
## Ce nœud ne dessine rien et ne connaît ni le hibou ni les ours : il tient l'état
## et l'expose. C'est `main.gd` qui le relie à ceux qui le lisent — `SoloRound`
## (collecte et cadeaux suspendus), `BearPack` (effectif renforcé), `FlightModel`
## (vent), `SkySystem` (lune, brouillard, lumière) et `RockStorm` (les cailloux).

## Émis à chaque changement d'événement, avec l'état qui vient de commencer.
## `BearPack` s'en sert pour rattraper son effectif d'un coup, comme le
## `while (bears.length < bearTarget()) bears.push(newBear())` de `activateFullMoon()`.
signal moon_started(blood: bool)
signal moon_ended
signal storm_started
signal storm_ended

enum Moon { NONE, FULL, BLOOD }
enum Weather { CLEAR, RAIN }

const MOON_DURATION := 10.0
const BLOOD_MOON_DURATION := 15.0
## Une lune sur dix est une lune de sang — même probabilité que le jeu 2D d'origine.
const BLOOD_MOON_CHANCE := 0.1
## Secondes de « remplissage » de la lune avant le déclenchement : c'est le
## préavis visuel (la lune grossit et rougit) qui laisse le temps de prendre de
## l'altitude avant que la meute ne double.
const MOON_WARN_TIME := 2.0
const MOON_NEXT_RANGE := Vector2(20.0, 30.0)
## Délai avant la toute première lune d'une partie.
const MOON_FIRST := 15.0

const STORM_DURATION := 20.0
const STORM_NEXT_RANGE := Vector2(30.0, 60.0)
const STORM_FIRST_RANGE := Vector2(20.0, 30.0)

const RAIN_DURATION := Vector2(18.0, 32.0)
const RAIN_NEXT := Vector2(25.0, 50.0)

const LIGHTNING_NEXT := Vector2(2.5, 7.0)
## Vitesse d'extinction du flash d'éclair, en unités d'intensité par seconde.
const LIGHTNING_FADE := 3.2

# ── Lune ─────────────────────────────────────────────────────────────────
var moon_state: Moon = Moon.NONE
## 0 → 1 pendant les [constant MOON_WARN_TIME] secondes de préavis, puis maintenu
## à 1 tant que la lune dure. Pilote l'échelle et la teinte de l'astre, et
## l'intensité de la lumière nocturne (`SkySystem.moon_fill_progress`).
var moon_fill_progress := 0.0
var _moon_timer := 0.0
var _moon_next := MOON_FIRST

# ── Tempête ──────────────────────────────────────────────────────────────
var storm_active := false
var wind_angle := 0.0
var wind_force := 0.0
var _gust_phase := 0.0
var _storm_timer := 0.0
var _storm_next := 0.0

# ── Météo ────────────────────────────────────────────────────────────────
var weather_mode: Weather = Weather.CLEAR
var _weather_timer := 0.0
var _weather_next := 0.0
## Flash d'éclair, 1 au coup de foudre puis retour à 0. Lu par `SkySystem`.
var lightning_flash := 0.0
var _lightning_timer := 0.0

## Facteur jour/nuit courant, injecté par `main.gd` depuis `SkySystem` : aucune
## lune ne se déclenche **naturellement** en plein jour (les raccourcis de debug,
## eux, marchent toujours).
var day_factor := 0.0


func _ready() -> void:
	reset()


## Remet les trois horloges à leur état de début de partie — la part
## `moon = {...}; storm = {...}; weather.mode = 'clear'` de `beginGame()`.
func reset() -> void:
	moon_state = Moon.NONE
	moon_fill_progress = 0.0
	_moon_timer = 0.0
	_moon_next = MOON_FIRST

	storm_active = false
	wind_angle = 0.0
	wind_force = 0.0
	_gust_phase = 0.0
	_storm_timer = 0.0
	_storm_next = randf_range(STORM_FIRST_RANGE.x, STORM_FIRST_RANGE.y)

	weather_mode = Weather.CLEAR
	_weather_timer = 0.0
	_weather_next = randf_range(RAIN_NEXT.x, RAIN_NEXT.y)
	lightning_flash = 0.0
	_lightning_timer = randf_range(3.0, 7.0)


## Un pas des trois horloges. Appelé par `main.gd` **uniquement en jeu** : les
## événements ne courent pas derrière un menu.
func step(delta: float) -> void:
	_step_moon(delta)
	_step_storm(delta)
	_step_weather(delta)


## Niveau de mauvais temps visé, dans [0, 1] : la tempête sature, la pluie
## s'arrête aux deux tiers. `SkySystem` s'en approche progressivement plutôt que
## d'y sauter — un ciel ne se plombe pas d'une frame à l'autre.
func weather_target() -> float:
	if storm_active:
		return 1.0
	return 0.7 if weather_mode == Weather.RAIN else 0.0


func is_moon_active() -> bool:
	return moon_state != Moon.NONE


# ══════════════════════════════════════════════════════════════════════════
#  Lune
# ══════════════════════════════════════════════════════════════════════════

func _step_moon(delta: float) -> void:
	if storm_active:
		return  # exclusion mutuelle avec la tempête, comme dans le jeu 2D

	# Debug : L force une pleine lune, K une lune de sang, tant que la touche est
	# tenue. Le minuteur est rechargé à chaque frame, donc l'événement ne s'arrête
	# qu'au relâchement.
	var force_full := Input.is_action_pressed("debug_full_moon")
	var force_blood := Input.is_action_pressed("debug_blood_moon")
	if force_full or force_blood:
		var wanted: Moon = Moon.BLOOD if force_blood else Moon.FULL
		if moon_state != wanted:
			_activate_moon(force_blood)
		_moon_timer = BLOOD_MOON_DURATION if moon_state == Moon.BLOOD else MOON_DURATION
		moon_fill_progress = 1.0
		return

	if moon_state == Moon.NONE:
		if day_factor > 0.5:
			return  # pas de lune en plein jour
		_moon_next -= delta
		# Préavis : la lune se « remplit » sur les dernières secondes.
		if _moon_next <= MOON_WARN_TIME and moon_fill_progress < 1.0:
			moon_fill_progress = minf(1.0, moon_fill_progress + delta / MOON_WARN_TIME)
		if _moon_next <= 0.0:
			_activate_moon()
	else:
		_moon_timer -= delta
		if _moon_timer <= 0.0:
			_deactivate_moon()


## [param force_blood] : `true`/`false` pour forcer le type, `-1` pour tirer au sort
## (GDScript n'a pas d'`undefined` : le tirage passe par un paramètre nullable).
func _activate_moon(force_blood: Variant = null) -> void:
	var is_blood: bool = force_blood if force_blood != null else randf() < BLOOD_MOON_CHANCE
	moon_state = Moon.BLOOD if is_blood else Moon.FULL
	moon_fill_progress = 1.0
	_moon_timer = BLOOD_MOON_DURATION if is_blood else MOON_DURATION
	moon_started.emit(is_blood)


func _deactivate_moon() -> void:
	moon_state = Moon.NONE
	moon_fill_progress = 0.0
	_moon_next = randf_range(MOON_NEXT_RANGE.x, MOON_NEXT_RANGE.y)
	moon_ended.emit()


# ══════════════════════════════════════════════════════════════════════════
#  Tempête
# ══════════════════════════════════════════════════════════════════════════

func _step_storm(delta: float) -> void:
	var forced := Input.is_action_pressed("debug_storm")
	if forced:
		if is_moon_active():
			return  # jamais en même temps qu'une lune
		if not storm_active:
			_activate_storm()
		_storm_timer = STORM_DURATION
	elif not storm_active:
		if not is_moon_active():
			_storm_next -= delta
			if _storm_next <= 0.0:
				_activate_storm()
		return

	# Rafales : force pulsée et direction qui dérive lentement. Les `× 60 × delta`
	# convertissent les incréments par frame du jeu 2D en incréments par seconde.
	_gust_phase += 0.045 * 60.0 * delta
	var gust := 0.5 + 0.5 * sin(_gust_phase)
	wind_force = 0.6 + gust * 1.8
	wind_angle += sin(_gust_phase * 0.3) * 0.01 * 60.0 * delta

	if not forced:
		_storm_timer -= delta
		if _storm_timer <= 0.0:
			_deactivate_storm()


func _activate_storm() -> void:
	storm_active = true
	_storm_timer = STORM_DURATION
	wind_angle = randf_range(0.0, TAU)
	_gust_phase = 0.0
	wind_force = 0.6
	storm_started.emit()


func _deactivate_storm() -> void:
	storm_active = false
	wind_force = 0.0
	_storm_next = randf_range(STORM_NEXT_RANGE.x, STORM_NEXT_RANGE.y)
	storm_ended.emit()


# ══════════════════════════════════════════════════════════════════════════
#  Météo
# ══════════════════════════════════════════════════════════════════════════

func _step_weather(delta: float) -> void:
	# La tempête suspend le cycle : elle **est** le mauvais temps tant qu'elle dure.
	if not storm_active:
		if weather_mode == Weather.CLEAR:
			# Les lunes gardent leur ciel dégagé : pas de pluie par-dessus.
			if not is_moon_active():
				_weather_next -= delta
				if _weather_next <= 0.0:
					weather_mode = Weather.RAIN
					_weather_timer = randf_range(RAIN_DURATION.x, RAIN_DURATION.y)
		else:
			_weather_timer -= delta
			if _weather_timer <= 0.0:
				weather_mode = Weather.CLEAR
				_weather_next = randf_range(RAIN_NEXT.x, RAIN_NEXT.y)

	# Les éclairs n'existent que pendant la tempête.
	if storm_active:
		_lightning_timer -= delta
		if _lightning_timer <= 0.0:
			_lightning_timer = randf_range(LIGHTNING_NEXT.x, LIGHTNING_NEXT.y)
			lightning_flash = 1.0


## L'extinction du flash, séparée du reste : elle tourne **toujours**, même en
## pause, sinon un éclair déclenché juste avant un menu resterait figé à l'écran.
func fade_lightning(delta: float) -> void:
	lightning_flash = maxf(0.0, lightning_flash - LIGHTNING_FADE * delta)
