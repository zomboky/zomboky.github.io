class_name Rng
extends RefCounted
## Générateur `mulberry32`, porté à l'identique depuis docs/hibou-3d.html.
##
## Pourquoi ne pas utiliser `RandomNumberGenerator` de Godot (PCG32) : le jeu
## Three.js sème le terrain, la forêt, les hameaux et les pics de montagne avec
## `mulberry32`, et le multijoueur exige que tous les clients tirent **exactement**
## la même suite (PLAN_GODOT.md §5.4). Un autre générateur donnerait un autre monde.
##
## Le portage est exact, et c'est démontrable : `mulberry32` n'utilise que de
## l'arithmétique entière 32 bits. Contrairement au hash `sin()` du terrain (§5.4),
## il n'y a ici **aucun risque de divergence** entre JavaScript, GDScript natif et
## WebAssembly.
##
## Détail d'implémentation : l'état est tenu en 32 bits **non signés** (0 … 2³²-1).
## JavaScript manipule des int32 signés, mais toutes les opérations utilisées
## (`+`, `^`, `|`, `Math.imul`) ne dépendent que du motif de bits, et `>>>` sur un
## motif non signé est un simple décalage à droite. Il faut en revanche rester en
## non signé de bout en bout : `>>` sur un entier négatif serait un décalage
## *arithmétique* en GDScript, et propagerait le bit de signe.

const MASK := 0xFFFFFFFF
const INV_2POW32 := 1.0 / 4294967296.0

var _state: int


func _init(seed_value: int = 0) -> void:
	_state = seed_value & MASK


## Réamorce le générateur. Équivaut à recréer `mulberry32(seed)` en JS.
func seed(seed_value: int) -> void:
	_state = seed_value & MASK


## Prochain flottant dans [0, 1[ — équivalent de l'appel à la fonction rendue par
## `mulberry32()` en JavaScript.
func next() -> float:
	_state = (_state + 0x6D2B79F5) & MASK
	var t := _imul(_state ^ (_state >> 15), 1 | _state)
	t = ((t + _imul(t ^ (t >> 7), 61 | t)) & MASK) ^ t
	return float((t ^ (t >> 14)) & MASK) * INV_2POW32


## Équivalent de `rnd(a, b)` : flottant dans [a, b[.
func range_f(a: float, b: float) -> float:
	return a + next() * (b - a)


## Équivalent de `Math.imul(a, b)` : les 32 bits de poids faible du produit.
##
## Les entiers de GDScript étant des int64 en complément à deux, le débordement
## enroule — les bits de poids faible, seuls conservés, restent donc exacts.
static func _imul(a: int, b: int) -> int:
	return (a * b) & MASK
