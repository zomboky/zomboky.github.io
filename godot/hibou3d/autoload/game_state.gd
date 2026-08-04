extends Node
## Machine à états du jeu et état de manche solo — port de `S` et des variables
## globales `score`/`nest`/`combo`/`lives`/`buffs` (docs/hibou-3d.html lignes 92-103).
## PLAN_GODOT.md §4.4, §9 lot 6.
##
## Remplace les ~80 globales de la closure JS par un autoload unique : Godot n'a
## pas de module fermé équivalent, et le HUD (`Control._draw()`) doit pouvoir lire
## cet état depuis un nœud complètement différent de celui qui le modifie.

## Copie exacte de `const S = { START: 0, PLAY: 1, OVER: 2, PAUSED: 3, LOOT: 4,
## MP_LOBBY: 5, MP_DEAD: 6, CAMPAIGN_SELECT: 7, LEVEL_END: 8, CUTSCENE: 9,
## CAMPAIGN_LOCK: 10, QUICK_SELECT: 11 }`. L'ordre fait partie du contrat : un futur
## harnais de synchro multijoueur pourrait sérialiser cette valeur telle quelle.
enum State {
	START,
	PLAY,
	OVER,
	PAUSED,
	LOOT,
	MP_LOBBY,
	MP_DEAD,
	CAMPAIGN_SELECT,
	LEVEL_END,
	CUTSCENE,
	CAMPAIGN_LOCK,
	QUICK_SELECT,
}

## Minuteries des bonus actifs, en secondes restantes. 0 = inactif.
## Port de `let buffs = { speed: 0, multi: 0, slow: 0, invincible: 0 }`.
class Buffs extends RefCounted:
	var speed := 0.0
	var multi := 0.0
	var slow := 0.0
	var invincible := 0.0

	func is_any_active() -> bool:
		return speed > 0.0 or multi > 0.0 or slow > 0.0 or invincible > 0.0


## Durée de vie du combo, en secondes — `const MAX_COMBO_TIME = 120` en JS.
const MAX_COMBO_TIME := 120.0

signal state_changed(previous: State, current: State)
signal score_changed(new_score: int)

var state: State = State.START

var score := 0:
	set(value):
		score = value
		score_changed.emit(score)
var nest := 0
var combo := 1
var combo_timer := 0.0
var lives := 1
## Meilleur score de la session. Comme en JS (`best = Math.max(best, score)`),
## purement en mémoire — aucune persistance `localStorage` n'existe côté original.
var best := 0
var buffs := Buffs.new()

## Raison de la fin de partie affichée par l'écran Over : 'crash' | 'rock' | 'eaten'.
var over_reason := "eaten"

## Sensibilité de la souris, 0.05..1.0 — réglée par l'écran Réglages ([O]),
## 0.5 = valeur par défaut d'origine. Voir `FlightInput.from_player()`.
var mouse_sensitivity := 0.5


## Change d'état et prévient les écouteurs (HUD, écrans, `OwlFlight`). Rejoue même
## une transition vers le même état : les appelants n'ont pas à s'en soucier.
func change_state(new_state: State) -> void:
	var previous := state
	state = new_state
	state_changed.emit(previous, new_state)


## Remet l'état de manche à zéro pour une nouvelle partie solo — le sous-ensemble
## de `beginGame()` (ligne 6034) qui concerne le score, pas le monde (régénération
## du terrain/forêt/ours : lot 7, ni le vol : `OwlFlight` se réinitialise seul).
func reset_round() -> void:
	score = 0
	nest = 0
	combo = 1
	combo_timer = 0.0
	lives = 1
	over_reason = "eaten"
	buffs = Buffs.new()
