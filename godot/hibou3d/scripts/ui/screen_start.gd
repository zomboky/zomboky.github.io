class_name ScreenStart
extends Control
## Écran d'accueil — port de `drawStart()` (docs/hibou-3d.html lignes 5438-5503).
## PLAN_GODOT.md §4.2 décision C : les quatre modes deviennent de vrais `Button`
## plutôt que des rectangles hit-testés à la main (`startSoloBtnRect`…).
##
## Seul **SOLO** est câblé : Multijoueur (lot 11), Campagne et Combat vs IA
## (lot 10) n'ont encore ni écran ni système derrière eux. Les trois boutons
## restent visibles — la mise en page à 4 boutons du jeu d'origine est conservée
## intacte pour ne pas la refondre au lot 11 — mais désactivés (`disabled = true`),
## ce qui a aussi pour effet d'empêcher leur zone d'écran de déclencher `beginGame()`
## par le repli « clique n'importe où » (`ScreenStart` ne gère que SOLO ; le repli
## lui-même vit dans `screens.gd`, commun à Start ET Over).
##
## Version mobile hors périmètre (consigne explicite) : le texte d'aide n'affiche
## que les commandes clavier/souris, jamais la branche tactile du JS.

const FONT_VT323 := preload("res://assets/fonts/VT323-Regular.ttf")
const FONT_PRESS_START := preload("res://assets/fonts/PressStart2P-Regular.ttf")

## Émis quand le joueur choisit SOLO — `main.gd` décide de la suite (reset de
## l'état de manche, respawn du hibou) : cet écran ne connaît ni `GameState` ni
## `OwlFlight`, comme `SkySystem` ne connaît pas le hibou (même séparation).
signal solo_pressed

@onready var _solo_btn: Button = %SoloButton


func _ready() -> void:
	var buttons: Array[Button] = [_solo_btn, %MultiButton, %CampaignButton, %QuickIaButton]
	var colors: Array[Color] = [Color("#5b52d6"), Color("#1f8fd6"), Color("#a23bd6"), Color("#d64b3b")]
	for i in buttons.size():
		HudDraw.style_button(buttons[i], colors[i])
		buttons[i].add_theme_font_override("font", FONT_VT323)
		buttons[i].add_theme_font_size_override("font_size", 16)
	%MultiButton.disabled = true
	%CampaignButton.disabled = true
	%QuickIaButton.disabled = true
	_solo_btn.pressed.connect(func() -> void: solo_pressed.emit())


func _draw() -> void:
	var w := size.x
	var h := size.y
	draw_rect(Rect2(0, 0, w, h), Color(4.0 / 255.0, 4.0 / 255.0, 18.0 / 255.0, 0.75), true)
	var cx := w / 2.0
	var cy := h / 2.0
	HudDraw.rrect(self, cx - 190, cy - 220, 380, 420, 28, Color(12.0 / 255.0, 12.0 / 255.0, 48.0 / 255.0, 0.96), Color(110.0 / 255.0, 90.0 / 255.0, 255.0 / 255.0, 0.45))

	HudDraw.text(self, FONT_VT323, cx, cy - 160, "🦉", 60, Color.WHITE, HORIZONTAL_ALIGNMENT_CENTER)
	HudDraw.text(self, FONT_PRESS_START, cx + 3, cy - 99, "HIBOU 3D", 20, Color(255.0 / 255.0, 60.0 / 255.0, 200.0 / 255.0, 0.95), HORIZONTAL_ALIGNMENT_CENTER)
	HudDraw.text(self, FONT_PRESS_START, cx, cy - 102, "HIBOU 3D", 20, Color("#8be9ff"), HORIZONTAL_ALIGNMENT_CENTER)

	var help_color := Color("#cbc3dd")
	# "<-"/"->" et non "←"/"→" (le glyphe JS d'origine) : ni VT323 ni le filet de
	# secours Noto Emoji ne couvrent le bloc Unicode Flèches, seulement Emoji —
	# ASCII rend à coup sûr, sans dépendre d'une troisième police pour deux caractères.
	HudDraw.text(self, FONT_VT323, cx, cy - 54, "Q / D ou <- / -> = lacet   A / E = incliner (virer)", 14, help_color, HORIZONTAL_ALIGNMENT_CENTER)
	HudDraw.text(self, FONT_VT323, cx, cy - 32, "S / Z = cabrer / piquer   (on tire pour monter)", 14, help_color, HORIZONTAL_ALIGNMENT_CENTER)
	HudDraw.text(self, FONT_VT323, cx, cy - 10, "Espace = accélérer   Shift = freiner (progressif)", 14, help_color, HORIZONTAL_ALIGNMENT_CENTER)
	HudDraw.text(self, FONT_VT323, cx, cy + 12, "Souris (verrouillée) = pilotage fin   [O] = sensibilité", 14, help_color, HORIZONTAL_ALIGNMENT_CENTER)
	HudDraw.text(self, FONT_VT323, cx, cy + 40, "Monter trop raide tue ta vitesse : DÉCROCHAGE —", 12, Color("#ffb0a0"), HORIZONTAL_ALIGNMENT_CENTER)
	HudDraw.text(self, FONT_VT323, cx, cy + 58, "le nez tombe, pique pour raccrocher l'aile.", 12, Color("#ffb0a0"), HORIZONTAL_ALIGNMENT_CENTER)
	HudDraw.text(self, FONT_VT323, cx, cy + 78, "Rase le sol parmi les lucioles : +1/s. Suis les flèches 🎁 🌿", 12, Color("#ffe08a"), HORIZONTAL_ALIGNMENT_CENTER)

	HudDraw.text(self, FONT_VT323, cx, cy + 102, "Choisis un mode", 15, Color.WHITE, HORIZONTAL_ALIGNMENT_CENTER)
