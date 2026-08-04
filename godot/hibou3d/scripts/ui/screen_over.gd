class_name ScreenOver
extends Control
## Écran de fin de partie — port de `drawOver()` (docs/hibou-3d.html lignes
## 5693-5721).
##
## Pas de bouton « rejouer » dans le jeu d'origine : un clic ou une touche
## n'importe où relance (`else if (state === S.OVER) beginGame();`), géré par le
## repli commun de `screens.gd` (même mécanisme que l'écran Start, voir son
## commentaire). Le raccourci `[M] = Multijoueur` n'est pas porté : le lot 11
## n'existe pas encore, l'afficher serait un mensonge.

const FONT_VT323 := preload("res://assets/fonts/VT323-Regular.ttf")
const FONT_PRESS_START := preload("res://assets/fonts/PressStart2P-Regular.ttf")


func _draw() -> void:
	var w := size.x
	var h := size.y
	draw_rect(Rect2(0, 0, w, h), Color(1, 0, 0, 0.28), true)
	var cx := w / 2.0
	var cy := h / 2.0
	HudDraw.rrect(self, cx - 150, cy - 180, 300, 360, 28, Color(22.0 / 255.0, 8.0 / 255.0, 30.0 / 255.0, 0.97), Color(255.0 / 255.0, 70.0 / 255.0, 70.0 / 255.0, 0.8))

	var reason_txt := "MANGÉ !"
	if GameState.over_reason == "crash":
		reason_txt = "CRASHÉ !"
	elif GameState.over_reason == "rock":
		reason_txt = "ÉCRASÉ !"
	HudDraw.text(self, FONT_PRESS_START, cx + 3, cy - 97, reason_txt, 22, Color(0, 0, 0, 0.9), HORIZONTAL_ALIGNMENT_CENTER)
	HudDraw.text(self, FONT_PRESS_START, cx, cy - 100, reason_txt, 22, Color("#ff6b6b"), HORIZONTAL_ALIGNMENT_CENTER)

	HudDraw.text(self, FONT_VT323, cx, cy - 30, "Score final : %d" % GameState.score, 18, Color("#e8e5ff"), HORIZONTAL_ALIGNMENT_CENTER)
	if GameState.best > 0:
		var record_color := Color("#ffaa00") if (GameState.score >= GameState.best and GameState.score > 0) else Color("#c0b0ff")
		HudDraw.text(self, FONT_VT323, cx, cy, "Record : %d" % GameState.best, 16, record_color, HORIZONTAL_ALIGNMENT_CENTER)

	var medal := "🪺"
	if GameState.score >= 100:
		medal = "👑"
	elif GameState.score >= 50:
		medal = "🥇"
	elif GameState.score >= 20:
		medal = "🥈"
	HudDraw.text(self, FONT_VT323, cx, cy + 50, medal, 45, Color.WHITE, HORIZONTAL_ALIGNMENT_CENTER)

	HudDraw.text(self, FONT_VT323, cx, cy + 135, "Clique ou appuie pour rejouer", 18, Color.WHITE, HORIZONTAL_ALIGNMENT_CENTER)
