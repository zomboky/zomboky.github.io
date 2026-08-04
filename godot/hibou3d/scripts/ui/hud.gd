class_name Hud
extends Control
## Instruments de vol superposés à l'écran — port 1:1 de `drawHUD()` et
## `drawSpeedFX()` (docs/hibou-3d.html lignes 5036-5151). PLAN_GODOT.md §9 lot 6.
##
## Le canvas 2D d'origine lit directement ~15 globales de la closure ; ici, tout
## vient de deux sources injectées par `main.gd` : `GameState` (score/vies/bonus/
## combo/nid) et `OwlFlight` (vitesse, instruments, décrochage) — le HUD ne
## connaît ni la forêt, ni le ciel, ni les règles de jeu.
##
## Écran multijoueur (`drawMPStatusBox`/`drawScoreboard`/`drawCrosshair`/
## `drawInventoryBar`), boussole d'objectifs (`drawTargetIndicator`, cadeau/
## branches) et bannières lune/tempête/pluie : **hors périmètre du lot 6**, elles
## lisent un état qui n'existe pas encore (combat lot 10a/11, gameplay solo lot 7,
## événements du monde lot 8). Rien n'est câblé en dur : `main.gd` les activera en
## branchant les données correspondantes, sans retoucher ce fichier.

const FONT_VT323 := preload("res://assets/fonts/VT323-Regular.ttf")

const PANEL_FILL := Color(8.0 / 255.0, 8.0 / 255.0, 35.0 / 255.0, 0.82)
const PANEL_STROKE := Color(100.0 / 255.0, 90.0 / 255.0, 220.0 / 255.0, 0.4)

## Hibou piloté (position, pour l'altimètre) et couche de vol (instruments,
## décrochage, vitesse) — câblés par `main.gd`, comme `sky.player` au lot 5.
var owl: Owl
var owl_flight: OwlFlight


func _process(_delta: float) -> void:
	queue_redraw()


func _draw() -> void:
	_draw_status_panel()
	_draw_sensitivity_hint()
	_draw_flight_instruments()
	_draw_stall_alert()
	if GameState.state == GameState.State.PLAY and owl_flight != null:
		HudDraw.speed_fx(self, size, owl_flight.model.speed / FlightModel.MAX_SPEED, owl_flight.model.speed_buff)


## Panneau haut-gauche : score, vies, bonus actifs, combo, barre de nid.
## Port de la branche solo de `drawHUD()` (le multijoueur — `drawMPStatusBox`,
## `drawInventoryBar` — est hors périmètre, voir le commentaire d'en-tête).
func _draw_status_panel() -> void:
	HudDraw.rrect(self, 12, 12, 230, 100, 14, PANEL_FILL, PANEL_STROKE)
	HudDraw.text(self, FONT_VT323, 24, 32, "Score : %d" % GameState.score, 16, Color("#ddddee"))

	var lives_str := "❤️".repeat(GameState.lives)
	HudDraw.text(self, FONT_VT323, 140, 32, lives_str, 12, Color("#ddddee"))

	var buff_y := 50.0
	var buffs := GameState.buffs
	if buffs.multi > 0.0:
		HudDraw.text(self, FONT_VT323, 24, buff_y, "✨ SCORE x5", 13, Color("#00ffff"))
		buff_y += 16.0
	if buffs.speed > 0.0:
		HudDraw.text(self, FONT_VT323, 24, buff_y, "⚡ VITESSE", 13, Color("#00ffff"))
		buff_y += 16.0
	if buffs.slow > 0.0:
		HudDraw.text(self, FONT_VT323, 24, buff_y, "❄️ GELÉS", 13, Color("#00ffff"))
		buff_y += 16.0
	if buffs.invincible > 0.0:
		HudDraw.text(self, FONT_VT323, 24, buff_y, "🦉 INVINCIBLE !", 13, Color("#ffd700"))
		buff_y += 16.0

	if GameState.combo > 1 and GameState.combo_timer > 0.0 and buffs.multi == 0.0:
		# Le compteur de combo enfle avec la série (et pulse au-delà de x5).
		var combo_size := minf(13.0 + GameState.combo, 24.0)
		if GameState.combo >= 5:
			combo_size += sin(Time.get_ticks_msec() / 90.0) * 1.5
		HudDraw.text(self, FONT_VT323, 24, buff_y, "🔥 Combo x%d" % GameState.combo, roundi(combo_size), Color("#ffaa00"))
		var combo_bar_w := 80.0 * (GameState.combo_timer / GameState.MAX_COMBO_TIME)
		HudDraw.rrect(self, 120, buff_y - 4, 80, 6, 3, Color(1, 1, 1, 0.1))
		HudDraw.rrect(self, 120, buff_y - 4, maxf(0.0, combo_bar_w), 6, 3, Color("#ffaa00"))
		buff_y += 16.0

	var bar_y := 82.0
	HudDraw.rrect(self, 22, bar_y, 190, 10, 5, Color(1, 1, 1, 0.1))
	var bar_w := maxf(10.0, 190.0 * GameState.nest / 100.0)
	HudDraw.rrect_gradient_h(self, 22, bar_y, bar_w, 10, Color("#5cc83a"), Color("#d4a800"))
	HudDraw.text(self, FONT_VT323, 117, bar_y + 5, "NID %d%% ➔ +1 ❤️" % GameState.nest, 9, Color.WHITE, HORIZONTAL_ALIGNMENT_CENTER)


func _draw_sensitivity_hint() -> void:
	HudDraw.text(self, FONT_VT323, 22, 130, "[O] Sensibilité souris", 11, Color(150.0 / 255.0, 140.0 / 255.0, 220.0 / 255.0, 0.55))


## Panneau haut-droite : vitesse air, altitude, poussée, vario — port de la
## section « Instruments de vol » de `drawHUD()`.
func _draw_flight_instruments() -> void:
	if owl_flight == null or owl == null:
		return
	var pw := 146.0
	var ph := 96.0
	var px := size.x - pw - 12.0
	var py := 12.0
	HudDraw.rrect(self, px, py, pw, ph, 12, PANEL_FILL, PANEL_STROKE)

	var label_color := Color("#9fb0d8")
	HudDraw.text(self, FONT_VT323, px + 12, py + 18, "Vitesse", 11, label_color)
	HudDraw.text(self, FONT_VT323, px + 12, py + 38, "Altitude", 11, label_color)
	HudDraw.text(self, FONT_VT323, px + 12, py + 58, "Poussée", 11, label_color)
	HudDraw.text(self, FONT_VT323, px + 12, py + 78, "Vario", 11, label_color)

	var value_color := Color("#e8ecff")
	var model := owl_flight.model
	HudDraw.text(self, FONT_VT323, px + pw - 12, py + 18, "%d u/s" % roundi(model.speed), 12, value_color, HORIZONTAL_ALIGNMENT_RIGHT)
	var altitude := maxf(0.0, owl.global_position.y - Terrain.effective_ground_y(owl.global_position.x, owl.global_position.z))
	HudDraw.text(self, FONT_VT323, px + pw - 12, py + 38, "%d m" % roundi(altitude), 12, value_color, HORIZONTAL_ALIGNMENT_RIGHT)
	HudDraw.text(self, FONT_VT323, px + pw - 12, py + 58, "%d %%" % roundi(model.readout.throttle * 100.0), 12, value_color, HORIZONTAL_ALIGNMENT_RIGHT)

	var climb := model.readout.climb
	var climb_color := value_color
	if climb > 0.3:
		climb_color = Color("#8fe06a")
	elif climb < -0.3:
		climb_color = Color("#ff9a6a")
	# "^"/"v" et non "▲"/"▼" (glyphes JS d'origine, bloc Unicode Formes
	# géométriques) : hors de la couverture de VT323 comme de Noto Emoji.
	var arrow := "^ " if climb >= 0.0 else "v "
	HudDraw.text(self, FONT_VT323, px + pw - 12, py + 78, arrow + "%.1f" % absf(climb), 12, climb_color, HORIZONTAL_ALIGNMENT_RIGHT)


## Bandeau clignotant bas-centre pendant un décrochage — port de l'alerte
## `⚠ DÉCROCHAGE`, clignotement toutes les ~220 ms comme `Date.now() / 220`.
func _draw_stall_alert() -> void:
	if owl_flight == null or not owl_flight.model.readout.stall or GameState.state != GameState.State.PLAY:
		return
	if int(Time.get_ticks_msec() / 220) % 2 != 0:
		return
	var w := size.x
	var h := size.y
	HudDraw.rrect(self, w / 2.0 - 110, h - 92, 220, 40, 12, Color(60.0 / 255.0, 10.0 / 255.0, 10.0 / 255.0, 0.9), Color(255.0 / 255.0, 90.0 / 255.0, 60.0 / 255.0, 0.95))
	HudDraw.text(self, FONT_VT323, w / 2.0, h - 72, "⚠ DÉCROCHAGE", 18, Color("#ffd0c0"), HORIZONTAL_ALIGNMENT_CENTER)
