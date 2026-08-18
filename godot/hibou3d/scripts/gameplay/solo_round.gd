class_name SoloRound
extends Node3D
## Les règles de la partie solo : ce que rapporte une branche, ce que coûte un
## ours, quand une vie se gagne. Port de la branche solo de `update()` et des
## fonctions de score `updateBranches()`, `updateSkim()`, `bearContactCheck()`
## (docs/hibou-3d.html lignes 3086-3115, 3126-3145, 3364-3388, 6081-6134).
## PLAN_GODOT.md §9 lot 7.
##
## Les entités (branches, ours, cadeau) savent se déplacer et s'animer, pas ce
## qu'elles valent : c'est ici, et seulement ici, qu'on compte les points, qu'on
## casse un combo et qu'on décide d'une fin de partie. La contrepartie est que ce
## nœud est le **seul** à connaître à la fois `GameState` et les trois familles
## d'entités.
##
## Tout tourne en `_physics_process` (§5.5) : le vol y intègre déjà sa trajectoire,
## et les compteurs hérités du JS — combo, invulnérabilité, âge des branches,
## durée de vie des ours — y sont exprimés **en frames de 60 Hz**, comme dans le
## jeu d'origine. Les lire depuis `_process`, dont la cadence varie, les fausserait.

## Émis quand le hibou meurt. La conséquence — meilleur score, écran de fin,
## curseur — appartient à `main.gd`, comme pour `crashed_into_ground` au lot 6.
signal owl_died(reason: String)
## Émis au ramassage du cadeau, avec le lot tiré : l'écran de roulette et la
## bascule vers `S.LOOT` sont orchestrés par `main.gd`.
signal gift_opened(loot: Dictionary)

## Rase-mottes : voler **bas** et **vite** rapporte en continu. C'est la carotte
## qui attire le joueur au sol, entre les arbres et le relief — du risque contre
## des points. Le gain reste volontairement maigre devant les 10 points d'une
## branche : la récolte doit rester la voie rentable.
const SKIM_ALT := 8.0
const SKIM_MIN_SPEED := 13.0
const SKIM_SCORE := 1

## Invulnérabilité, **en frames** : au décollage, après une vie perdue, et à la
## sortie de la roulette de cadeau (où l'on réapparaît sans rien voir venir).
const INVUL_START := 60
const INVUL_HIT := 120
const INVUL_AFTER_LOOT := 90
## Demi-période du clignotement d'invulnérabilité, en millisecondes.
const BLINK_PERIOD_MS := 80

## Injectés par `main.gd` : le hibou piloté, sa couche de vol (position et vitesse
## font autorité côté modèle), sa sonde de ramassage, et les événements du monde
## (lot 8) — sous une lune la collecte s'arrête (survie pure) et le combo gèle ;
## sous une lune ou une tempête, aucun cadeau n'apparaît.
var owl: Owl
var owl_flight: OwlFlight
var pickup_area: Area3D
var world_events: WorldEvents

@onready var branches: BranchField = %Branches
@onready var bears: BearPack = %Bears
@onready var gift: Gift = %Gift
@onready var rocks: RockStorm = %Rocks

## Secondes écoulées dans la manche — pilote la rampe de difficulté des ours.
var round_time := 0.0
var _owl_invul := 0
var _skim_timer := 0.0
var _skim_active := false


func _ready() -> void:
	branches.ground_y = Terrain.effective_ground_y
	bears.ground_y = Terrain.effective_ground_y
	gift.ground_y = Terrain.effective_ground_y
	rocks.ground_y = Terrain.effective_ground_y


## Remet la manche à neuf et repeuple le monde autour du hibou — la part
## « entités et compteurs » de `beginGame()` (ligne 6014).
func begin() -> void:
	round_time = 0.0
	_owl_invul = INVUL_START
	_skim_timer = 0.0
	_skim_active = false
	var owl_pos := _owl_position()
	var velocity := _velocity()
	branches.reset(owl_pos, velocity)
	bears.reset(owl_pos, velocity)
	gift.reset()
	rocks.owl_collide_radius = owl.collide_radius
	rocks.clear_all()


## Applique le lot tiré — port de `applyGiftLoot()` (ligne 2939). Vit ici et non
## dans `Loot`, qui doit rester sans la moindre mention de `GameState` pour rester
## compilable en test headless (les autoloads n'existent pas en mode `--script`).
func apply_loot(loot_id: String) -> void:
	match loot_id:
		"life":
			GameState.lives += 1
		"speed":
			GameState.buffs.speed = Loot.BUFF_DURATION
		"multi":
			GameState.buffs.multi = Loot.BUFF_DURATION
		"slow":
			GameState.buffs.slow = Loot.BUFF_DURATION
		"invincible":
			GameState.buffs.invincible = Loot.INVINCIBLE_DURATION


## Rend la main au vol après la roulette de cadeau — `state = S.PLAY; owlInvul = 90`.
func resume_after_loot() -> void:
	_owl_invul = INVUL_AFTER_LOOT


func _physics_process(delta: float) -> void:
	if GameState.state != GameState.State.PLAY or owl_flight == null:
		return

	round_time += delta
	if _owl_invul > 0:
		_owl_invul -= 1
	_decay_buffs(delta)

	var owl_pos := _owl_position()
	var velocity := _velocity()
	# Interrogé une seule fois, puis relu à trois endroits : l'ordre de traitement
	# est celui du jeu d'origine (`updateSkim`, `updateBranches`, `updateBears`,
	# `updateGift`), et c'est lui qui décide de ce qui l'emporte quand une branche
	# et un ours sont touchés dans la même frame.
	var touched := _touched_entities()

	var moon_active := world_events != null and world_events.is_moon_active()
	var storm_active := world_events != null and world_events.storm_active
	bears.moon_state = world_events.moon_state if world_events != null else WorldEvents.Moon.NONE

	_update_skim(delta, owl_pos)

	# Sous une lune, la collecte s'arrête net : plus de ballotement, plus de
	# recyclage, et le combo se fige au lieu de s'écouler.
	if not moon_active:
		branches.step(owl_pos, velocity)
		for entity in touched:
			if entity is Branch:
				_collect_branch(entity as Branch, owl_pos, velocity)
		_tick_combo()

	bears.step(delta, owl_pos, velocity, 0.3 if GameState.buffs.slow > 0.0 else 1.0,
		round_time, GameState.score)
	for entity in touched:
		if entity is Bear and _bear_contact(entity as Bear):
			return  # partie terminée : plus rien à faire cette frame

	gift.step(delta, owl_pos, velocity, moon_active or storm_active)
	for entity in touched:
		if entity is Gift:
			_open_gift()
			break

	_step_rocks(delta, owl_pos, velocity)
	for entity in touched:
		if entity is Rock and (entity as Rock).active:
			_rock_contact(entity as Rock)
			return  # partie terminée : plus rien à faire cette frame

	_blink_owl()


## Les rochers de tempête tombent et finissent leur course. Ils ne sont pilotés
## que par le vent : c'est le seul système du lot 8 qui vit dans les entités,
## parce que c'est le seul qui touche le hibou.
func _step_rocks(delta: float, owl_pos: Vector3, velocity: Vector3) -> void:
	if world_events == null:
		return
	rocks.step(delta, owl_pos, velocity, world_events.storm_active,
		world_events.wind_angle, world_events.wind_force)


## Contact avec un rocher — port du bloc de punition de `updateRocks()` (ligne
## 1436). Contrairement à l'ours, le rocher ne retire pas une vie : il **tue net**,
## comme le sol.
##
## Le `rockInvul` du jeu d'origine n'est pas porté : il y est déclaré, remis à
## zéro et décrémenté, mais **jamais** mis à une valeur positive — le test
## `rockInvul <= 0` est donc toujours vrai. Porter un compteur mort aurait fait
## croire à une protection qui n'existe pas ; le bonus 🦉, lui, protège bien.
func _rock_contact(rock: Rock) -> void:
	if GameState.buffs.invincible > 0.0:
		return
	rock.set_active(false)
	owl_died.emit("rock")


## Décroissance des bonus, en secondes — `buffs.x = Math.max(0, buffs.x - dt)`.
func _decay_buffs(delta: float) -> void:
	var buffs := GameState.buffs
	buffs.speed = maxf(0.0, buffs.speed - delta)
	buffs.multi = maxf(0.0, buffs.multi - delta)
	buffs.slow = maxf(0.0, buffs.slow - delta)
	buffs.invincible = maxf(0.0, buffs.invincible - delta)
	# Le modèle de vol ne connaît pas `GameState` : c'est ici qu'on lui répercute
	# le bonus ⚡, qui relève sa poussée et son plafond de vitesse.
	owl_flight.model.speed_buff = buffs.speed > 0.0


## Le combo s'écoule en frames (`MAX_COMBO_TIME = 120` → 2 s), et retombe à 1 dès
## qu'il est vide : c'est ce qui force à enchaîner les branches sans traîner.
func _tick_combo() -> void:
	if GameState.combo_timer > 0.0:
		GameState.combo_timer -= 1.0
	else:
		GameState.combo = 1


## Rase-mottes : +1 point par seconde passée sous 8 u de sol à plus de 13 u/s.
func _update_skim(delta: float, owl_pos: Vector3) -> void:
	var altitude := owl_pos.y - Terrain.effective_ground_y(owl_pos.x, owl_pos.z)
	_skim_active = altitude < SKIM_ALT and owl_flight.model.speed > SKIM_MIN_SPEED
	if not _skim_active:
		_skim_timer = 0.0
		return
	_skim_timer += delta
	if _skim_timer < 1.0:
		return
	_skim_timer -= 1.0
	GameState.score += SKIM_SCORE * _multi_factor()
	_add_nest(1)


## Sonde de ramassage du hibou contre les `Area3D` des entités (décision B, §4.2).
##
## Le jeu d'origine compare `owlGroup.position.distanceTo(item) < R`, un test
## POINT/sphère où **chaque entité porte son propre rayon** (3 u pour une branche,
## 3,5 pour le cadeau, 4 pour un ours). Ce partage est conservé tel quel : les
## constantes de chaque entité se lisent comme en JS, et la sonde du hibou n'est
## qu'un point. Godot n'ayant pas de forme ponctuelle, c'est une sphère de 0,05 —
## une branche se ramasse donc à 3,05 u au lieu de 3,00, invisible pour un hibou
## large de 2,6.
##
## On interroge le recouvrement à chaque pas plutôt que d'écouter `area_entered` :
## un ours n'est pas un ramassable — il doit pouvoir mordre à une frame ultérieure
## si le hibou était invulnérable au moment où le contact a commencé. Le signal, qui
## ne se déclenche qu'à l'entrée, laisserait passer ce cas.
func _touched_entities() -> Array[Node]:
	var out: Array[Node] = []
	if pickup_area == null:
		return out
	for area in pickup_area.get_overlapping_areas():
		out.append(area.get_parent())
	return out


func _collect_branch(branch: Branch, owl_pos: Vector3, velocity: Vector3) -> void:
	if branch.rotten:
		# Le piège : la série tombe, et il faut la reconstruire de zéro.
		GameState.combo = 0
		GameState.combo_timer = 0.0
	else:
		# Le combo multiplie chaque branche : c'est lui, et non le nombre de
		# branches, qui fait les gros scores.
		GameState.score += maxi(1, GameState.combo) * BranchField.SCORE_MULT * _multi_factor()
		_add_nest(1)
		GameState.combo = maxi(1, GameState.combo) + 1
		GameState.combo_timer = GameState.MAX_COMBO_TIME
		# Récolter attire les ours : l'effectif visé est rattrapé sur-le-champ.
		bears.top_up(owl_pos, velocity, round_time, GameState.score)
	branches.recycle(branch, owl_pos, velocity)


## Le nid se remplit branche après branche ; à 100 %, il rend une vie et repart —
## `nest %= 100`, et non `nest = 0` : le trop-plein est reporté.
func _add_nest(amount: int) -> void:
	GameState.nest += amount
	if GameState.nest >= 100:
		GameState.nest %= 100
		GameState.lives += 1


func _open_gift() -> void:
	if not gift.active:
		return
	gift.consume()
	gift_opened.emit(Loot.roll())


## Contact « mangé ». Rend `true` si la partie s'arrête ici.
func _bear_contact(bear: Bear) -> bool:
	if _owl_invul > 0 or GameState.buffs.invincible > 0.0 or bear.spawn_grace > 0:
		return false
	GameState.lives -= 1
	if GameState.lives <= 0:
		owl_died.emit("eaten")
		return true
	_owl_invul = INVUL_HIT
	return false


## Le hibou clignote tant qu'il est invulnérable — le retour visuel qui dit
## pourquoi les ours le traversent sans dommage.
func _blink_owl() -> void:
	if owl == null:
		return
	owl.visible = not (_owl_invul > 0 and int(Time.get_ticks_msec() / BLINK_PERIOD_MS) % 2 != 0)


## Le multiplicateur ✨ : ×5 sur tout ce qui rapporte, branches comme rase-mottes.
func _multi_factor() -> int:
	return 5 if GameState.buffs.multi > 0.0 else 1


func _owl_position() -> Vector3:
	return owl_flight.model.position


func _velocity() -> Vector3:
	return owl_flight.model.velocity
