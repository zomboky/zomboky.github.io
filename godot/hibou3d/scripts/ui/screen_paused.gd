class_name ScreenPaused
extends Control
## Écran de pause — port de `drawPaused()` (docs/hibou-3d.html lignes 5784-5802).
##
## Pas de bouton : la reprise se fait en cliquant ou en appuyant sur une touche
## n'importe où, gérée par `screens.gd` (catch-all commun, comme dans le JS où
## `else if (state === S.PAUSED) requestFlightPointerLock();` conclut le handler
## clavier/souris). `mouse_filter = IGNORE` laisse ce clic passer jusque-là.
##
## Le multijoueur/la campagne (ligne d'aide « [Retour arrière] = quitter la
## partie ») n'existent pas encore (lots 10-11) : seule la ligne solo est portée.

const FONT_VT323 := preload("res://assets/fonts/VT323-Regular.ttf")
const FONT_PRESS_START := preload("res://assets/fonts/PressStart2P-Regular.ttf")


func _draw() -> void:
	var w := size.x
	var h := size.y
	draw_rect(Rect2(0, 0, w, h), Color(4.0 / 255.0, 4.0 / 255.0, 18.0 / 255.0, 0.72), true)
	var cx := w / 2.0
	var cy := h / 2.0
	HudDraw.rrect(self, cx - 170, cy - 90, 340, 180, 24, Color(12.0 / 255.0, 12.0 / 255.0, 48.0 / 255.0, 0.96), Color(110.0 / 255.0, 90.0 / 255.0, 255.0 / 255.0, 0.45))

	HudDraw.text(self, FONT_PRESS_START, cx + 2, cy - 28, "PAUSE", 18, Color(255.0 / 255.0, 60.0 / 255.0, 200.0 / 255.0, 0.9), HORIZONTAL_ALIGNMENT_CENTER)
	HudDraw.text(self, FONT_PRESS_START, cx, cy - 30, "PAUSE", 18, Color("#8be9ff"), HORIZONTAL_ALIGNMENT_CENTER)

	HudDraw.text(self, FONT_VT323, cx, cy + 10, "Clique ou appuie sur une touche", 16, Color.WHITE, HORIZONTAL_ALIGNMENT_CENTER)
	HudDraw.text(self, FONT_VT323, cx, cy + 32, "pour reprendre le pilotage", 16, Color.WHITE, HORIZONTAL_ALIGNMENT_CENTER)
	HudDraw.text(self, FONT_VT323, cx, cy + 58, "(verrouillage souris relâché)", 13, Color("#cbc3dd"), HORIZONTAL_ALIGNMENT_CENTER)
