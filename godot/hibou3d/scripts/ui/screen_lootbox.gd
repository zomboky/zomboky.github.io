class_name ScreenLootbox
extends Control
## La roulette de révélation du cadeau — port de `initLootboxScroll()`,
## `updateLootbox()` et `drawLootbox()` (docs/hibou-3d.html lignes 2963-3001,
## 5876-5940). PLAN_GODOT.md §9 lot 6 (écran) et lot 7 (déclencheur).
##
## Le lot est **déjà tiré** quand cet écran s'ouvre : la bande de 28 cases est
## construite autour de lui, posé d'avance à l'index [constant TARGET_IDX], et le
## défilement freine jusqu'à l'amener sous le curseur. La roulette ne décide de
## rien — elle met en scène un résultat connu, comme dans le jeu d'origine.
##
## Report du lot 6 : sans système de cadeau, cet écran n'avait aucun déclencheur
## et n'aurait pas pu être recetté. Il arrive donc avec le cadeau qui l'ouvre.

## Émis quand le bonus doit prendre effet — au bout des 2 s d'atterrissage, pas à
## la fermeture : le joueur voit son lot s'appliquer avant de reprendre la main.
signal loot_granted(loot: Dictionary)
## Émis quand l'écran a fini son numéro et rend la main au vol.
signal finished

const ITEM_COUNT := 28
## L'index gagnant, quatre cases avant la fin : il reste de la bande derrière lui
## pour que l'arrêt ne se fasse pas sur un bord vide.
const TARGET_IDX := ITEM_COUNT - 4
const CASE_W := 90.0
const CASE_GAP := 8.0
const CASE_STRIDE := CASE_W + CASE_GAP
## La fenêtre montre cinq cases (le dernier écart ne compte pas).
const BAR_W := CASE_STRIDE * 5.0 - CASE_GAP
const BAR_H := CASE_W

## Durées de la phase d'atterrissage, **en frames de 60 Hz** comme en JS : 2 s de
## présentation du lot, puis 0,5 s de pause avant de rendre la main.
const LAND_APPLY_FRAMES := 120.0
const LAND_PAUSE_FRAMES := 30.0

const FONT_VT323 := preload("res://assets/fonts/VT323-Regular.ttf")
const FONT_PRESS_START := preload("res://assets/fonts/PressStart2P-Regular.ttf")
const FONT_EMOJI := preload("res://assets/fonts/NotoEmoji-Regular.ttf")

enum Phase { SCROLL, LAND }

var _items: Array[Dictionary] = []
var _result: Dictionary = {}
var _scroll := 0.0
var _final_scroll := 0.0
var _phase: Phase = Phase.SCROLL
var _land_timer := 0.0
var _pause_timer := 0.0
var _applied := false

@onready var _strip: Control = %Strip


func _ready() -> void:
	# Les cases défilent DERRIÈRE une fenêtre : celles qui dépassent doivent être
	# coupées net, pas dessinées par-dessus le décor. `clip_contents` est le seul
	# découpage dont dispose un `CanvasItem`, et il s'applique au nœud entier — d'où
	# ce `Control` dédié, dont on remplit le `_draw()` depuis ici via son signal
	# `draw` plutôt que d'écrire un second script pour trois rectangles.
	_strip.draw.connect(_draw_strip)
	# La roulette ne tourne qu'entre `open()` et `finished` : sans cela, elle
	# continuerait de faire défiler une bande vide sous tous les autres écrans.
	set_process(false)


## Ouvre la roulette sur un lot déjà tiré — `initLootboxScroll(result)`.
func open(result: Dictionary) -> void:
	_result = result
	_items.clear()
	for i in ITEM_COUNT:
		_items.append(result if i == TARGET_IDX else Loot.roll())

	# Le défilement s'exprime en pixels : la bande part largement à droite de la
	# fenêtre et s'arrête quand la case gagnante est centrée sous le curseur.
	_final_scroll = BAR_W / 2.0 - CASE_W / 2.0 - TARGET_IDX * CASE_STRIDE
	_scroll = BAR_W + CASE_STRIDE * 4.0
	_phase = Phase.SCROLL
	_land_timer = 0.0
	_pause_timer = 0.0
	_applied = false
	set_process(true)


func _process(delta: float) -> void:
	# Les constantes de temps du jeu 2D sont exprimées en nombre d'images à 60 fps ;
	# `frames` convertit le pas de temps réel pour les réutiliser telles quelles.
	var frames := 60.0 * delta
	match _phase:
		Phase.SCROLL:
			_step_scroll(frames)
		Phase.LAND:
			_step_land(frames)
	queue_redraw()
	_strip.queue_redraw()


## Freinage exponentiel, mais jamais plus lent que 8 px/frame tant qu'il reste
## plus de deux cases à parcourir : sans ce plancher, la fin traînerait
## indéfiniment au lieu de claquer sur la case gagnante.
func _step_scroll(frames: float) -> void:
	var remaining := _final_scroll - _scroll
	var speed := remaining * 0.06 * frames
	var min_speed := -8.0 * frames if absf(remaining) > CASE_STRIDE * 2.0 else 0.0
	_scroll += minf(speed, min_speed)
	if absf(remaining) < 1.0:
		_scroll = _final_scroll
		_phase = Phase.LAND


func _step_land(frames: float) -> void:
	_land_timer += frames
	if _land_timer < LAND_APPLY_FRAMES:
		return
	if not _applied:
		_applied = true
		loot_granted.emit(_result)
	_pause_timer += frames
	if _pause_timer >= LAND_PAUSE_FRAMES:
		set_process(false)
		finished.emit()


func _draw() -> void:
	var w := size.x
	var h := size.y
	draw_rect(Rect2(0, 0, w, h), Color(0, 0, 0, 0.88), true)
	var cx := w / 2.0
	var cy := h / 2.0

	HudDraw.text(self, FONT_PRESS_START, cx + 2, cy - 118, "CADEAU !", 16,
		Color(0, 0, 0, 0.9), HORIZONTAL_ALIGNMENT_CENTER)
	HudDraw.text(self, FONT_PRESS_START, cx, cy - 120, "CADEAU !", 16,
		Color("#ffd23f"), HORIZONTAL_ALIGNMENT_CENTER)

	var bar_left := cx - BAR_W / 2.0
	var bar_top := cy - BAR_H / 2.0 - 10.0
	HudDraw.rrect(self, bar_left - 4, bar_top - 4, BAR_W + 8, BAR_H + 8, 10,
		Color("#0a0a2a"), Color("#444466"))

	# La fenêtre de défilement est un nœud enfant : on la recale sur le cadre à
	# chaque frame, la taille de l'écran pouvant changer.
	_strip.position = Vector2(bar_left, bar_top)
	_strip.size = Vector2(BAR_W, BAR_H)

	_draw_marker(cx, bar_top)
	if _phase == Phase.LAND:
		_draw_result(cx, cy)


## Le curseur rouge : un trait vertical au centre, flanqué de deux pointes qui
## désignent la case sous laquelle la bande doit s'arrêter.
func _draw_marker(cx: float, bar_top: float) -> void:
	var red := Color("#ff4444")
	draw_line(Vector2(cx, bar_top - 12), Vector2(cx, bar_top + BAR_H + 12), red, 2.0)
	draw_colored_polygon(PackedVector2Array([
		Vector2(cx - 8, bar_top - 14), Vector2(cx + 8, bar_top - 14), Vector2(cx, bar_top - 2),
	]), red)
	draw_colored_polygon(PackedVector2Array([
		Vector2(cx - 8, bar_top + BAR_H + 14), Vector2(cx + 8, bar_top + BAR_H + 14),
		Vector2(cx, bar_top + BAR_H + 2),
	]), red)


## Le nom du lot, en fondu sur les vingt premières frames de l'atterrissage.
func _draw_result(cx: float, cy: float) -> void:
	var alpha: float = minf(1.0, _land_timer / 20.0)
	var is_invincible: bool = _result.get("id", "") == "invincible"
	var color := Color("#ffd700") if is_invincible else Color("#00ffff")
	color.a = alpha
	HudDraw.text(self, FONT_VT323, cx, cy + 80, _result.get("text", ""), 26, color,
		HORIZONTAL_ALIGNMENT_CENTER)
	HudDraw.text(self, FONT_VT323, cx, cy + 110, "Un instant...", 14,
		Color(200.0 / 255.0, 200.0 / 255.0, 255.0 / 255.0, 0.7 * alpha),
		HORIZONTAL_ALIGNMENT_CENTER)


## Dessiné dans le repère de la fenêtre découpée : l'origine est le coin haut
## gauche de la bande, et tout ce qui en sort est coupé par `clip_contents`.
func _draw_strip() -> void:
	for i in _items.size():
		var case_x := _scroll + i * CASE_STRIDE
		if case_x + CASE_W < 0.0 or case_x > BAR_W:
			continue
		var is_winner := i == TARGET_IDX and _phase == Phase.LAND
		HudDraw.rrect(_strip, case_x, 0, CASE_W, BAR_H, 8,
			Color("#2a1f00") if is_winner else Color("#111128"),
			Color("#ffd700") if is_winner else Color("#2a2a55"),
			3.0 if is_winner else 1.0)
		HudDraw.text(_strip, FONT_EMOJI, case_x + CASE_W / 2.0, BAR_H / 2.0,
			_items[i].get("emoji", ""), 36, Color.WHITE, HORIZONTAL_ALIGNMENT_CENTER)
