class_name Branch
extends Node3D
## Une branche à ramasser — port de `newBranch()` / `updateBranches()`
## (docs/hibou-3d.html lignes 3040-3115). PLAN_GODOT.md §9 lot 7.
##
## Les branches sont la boucle de jeu principale : elles montent le score, le
## combo et le nid. Une sur douze est **pourrie** (halo brun terne au lieu du vert
## tendre) et casse le combo au contact — c'est le piège qui rend la récolte à
## l'aveugle coûteuse.
##
## Le champ de branches est un **pool fixe** de `BranchField.COUNT` nœuds recyclés
## sur place ([method reroll]), là où le JS détruisait puis reconstruisait le
## sprite et ses matériaux. Le résultat est le même — nouvelle essence, nouveau
## tirage de pourriture, nouvelle position — sans allouer ni libérer un nœud à
## chaque ramassage.

## Les quatre essences tirées au sort, `BRANCH_EMOJI` en JS.
const EMOJIS: Array[String] = ["🪵", "🌿", "🍃", "🍂"]

const ROTTEN_CHANCE := 0.08
## Durée de vie d'une branche pourrie, **en frames** comme en JS (600 → 10 s à
## 60 Hz). Le pas de physique de Godot est fixé à 60 Hz : l'unité est donc la même.
const ROTTEN_LIFE := 600
## Distance de ramassage. Portée par l'`Area3D` de la branche, que sonde le
## `PickupArea` ponctuel du hibou (décision B, §4.2).
const COLLECT_RADIUS := 3.0
## Une branche laissée trop loin derrière revient près du hibou plutôt que de
## rester perdue à l'autre bout d'une arène de 1 400 u de rayon.
const RECYCLE_DIST := 420.0

const HEALTHY_GLOW := Color(0x66 / 255.0, 0xff / 255.0, 0x66 / 255.0)
const ROTTEN_GLOW := Color(0x8a / 255.0, 0x6a / 255.0, 0x20 / 255.0)
const HEALTHY_OPACITY := 0.5
const ROTTEN_OPACITY := 0.28
## Teinte appliquée à l'emoji lui-même quand la branche est pourrie (`mat.color.set`).
const ROTTEN_TINT := Color(0x99 / 255.0, 0x77 / 255.0, 0x5a / 255.0)

## Amplitude du ballotement vertical, en unités monde.
const BOB_AMPLITUDE := 0.4
## Respiration du halo, autour de son opacité de repos.
const GLOW_BREATH := 0.14

const FONT_EMOJI := preload("res://assets/fonts/NotoEmoji-Regular.ttf")
const LABEL_FONT_SIZE := 64
## `2 u` de sprite dans le JS, dont l'emoji occupe ~70 % (le canvas source est
## dessiné à `size × 0.7`) : on vise donc un glyphe d'environ 1,4 u de haut.
const LABEL_PIXEL_SIZE := 0.03

var rotten := false

var _w := 0.0
var _ws := 0.0
var _age := 0
var _base_y := 0.0

@onready var _label: Label3D = %Label
@onready var _glow: Glow = %Glow


func _ready() -> void:
	_label.font = FONT_EMOJI
	_label.font_size = LABEL_FONT_SIZE
	_label.pixel_size = LABEL_PIXEL_SIZE
	_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_label.shaded = false
	_label.double_sided = true


## Nouvelle essence, nouveau tirage de pourriture, nouvelle position — l'équivalent
## du `newBranch()` du JS, appliqué au nœud existant.
func reroll(owl_pos: Vector3, velocity: Vector3, ground_y: Callable) -> void:
	rotten = randf() < ROTTEN_CHANCE
	_label.text = EMOJIS[randi() % EMOJIS.size()]
	_label.modulate = ROTTEN_TINT if rotten else Color.WHITE
	_glow.glow_color = ROTTEN_GLOW if rotten else HEALTHY_GLOW
	_glow.glow_opacity = ROTTEN_OPACITY if rotten else HEALTHY_OPACITY
	_w = randf_range(0.0, TAU)
	# Les pourries frémissent plus vite : le mouvement fait partie du signal.
	_ws = randf_range(0.06, 0.11) if rotten else randf_range(0.03, 0.07)
	_age = 0
	move_to(CollectibleSpawn.pick(owl_pos, velocity, 35.0, 210.0, ground_y))


## Repositionne sans rien retirer au tirage courant (recyclage à distance).
func move_to(spawn_position: Vector3) -> void:
	position = spawn_position
	_base_y = spawn_position.y


## Un pas de vie. Rend `true` si la branche est arrivée en fin de pourrissement et
## doit être renouvelée — le pendant du `removeBranch(i); branches.push(newBranch())`
## du JS, décidé par l'appelant plutôt qu'exécuté ici.
func step(owl_pos: Vector3, velocity: Vector3, ground_y: Callable) -> bool:
	_w += _ws
	position.y = _base_y + sin(_w) * BOB_AMPLITUDE
	var rest: float = ROTTEN_OPACITY if rotten else HEALTHY_OPACITY
	_glow.set_opacity(rest + sin(_w * 2.0) * GLOW_BREATH)

	if position.distance_to(owl_pos) > RECYCLE_DIST:
		move_to(CollectibleSpawn.pick(owl_pos, velocity, 60.0, 230.0, ground_y))

	if rotten:
		_age += 1
		if _age >= ROTTEN_LIFE:
			return true
	return false
