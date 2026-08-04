class_name ScreenSettings
extends Control
## Réglage de sensibilité souris — port de `drawSettings()`/`getSliderHitArea()`/
## `handleSliderDrag()` (docs/hibou-3d.html lignes 2119-2127, 5804-5844).
##
## Décision C (§4.2) : un vrai `HSlider` remplace le curseur dessiné à la main et
## son hit-testing (`getSliderHitArea`, le drag suivi via `sliderDrag`/
## `pointermove`) — ~10 lignes de JS de calcul de coordonnées disparaissent.
##
## `screens.gd` pilote la visibilité (`settingsOpen` du JS) et ferme le panneau
## sur un clic extérieur ; ce script ne fait que la vue + la valeur.

const FONT_VT323 := preload("res://assets/fonts/VT323-Regular.ttf")

## Réplique de `getSettingsPanelRect()` : indépendante de la taille réelle du
## panneau à l'écran puisque le canevas de référence est fixe (1280×720, §0).
const PANEL_W := 280.0
const PANEL_H := 110.0

## Couche de vol dont la sensibilité doit suivre le curseur en direct — câblée
## par `main.gd`, comme `hud.owl_flight`.
var owl_flight: OwlFlight

## Demande de fermeture par clic extérieur — port du dernier bloc de
## `pointerdown` : « en dehors du panneau → `settingsOpen = false` ».
signal close_requested

@onready var _slider: HSlider = %SensitivitySlider


static func get_panel_rect(viewport_size: Vector2) -> Rect2:
	return Rect2(viewport_size.x / 2.0 - PANEL_W / 2.0, viewport_size.y / 2.0 - PANEL_H / 2.0, PANEL_W, PANEL_H)


func _ready() -> void:
	_slider.min_value = 0.05
	_slider.max_value = 1.0
	_slider.step = 0.01
	_slider.value = GameState.mouse_sensitivity
	_slider.value_changed.connect(_on_value_changed)


func _on_value_changed(value: float) -> void:
	GameState.mouse_sensitivity = value
	if owl_flight != null:
		owl_flight.mouse_sensitivity = value
	queue_redraw()


## Resynchronise le curseur si la sensibilité a changé pendant que ce panneau
## était fermé (par exemple restaurée par une future sauvegarde de réglages).
func sync_from_state() -> void:
	_slider.set_value_no_signal(GameState.mouse_sensitivity)


## Reçoit tous les clics tant que ce panneau est visible (`mouse_filter =
## STOP` sur la racine, plein écran) : un clic hors du cadre du panneau ferme
## les réglages, comme le `pointerdown` global du JS.
func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if not get_panel_rect(size).has_point(event.position):
			close_requested.emit()
			accept_event()


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0, 0, 0, 0.55), true)

	var p := get_panel_rect(size)
	HudDraw.rrect(self, p.position.x, p.position.y, p.size.x, p.size.y, 16, Color(8.0 / 255.0, 8.0 / 255.0, 40.0 / 255.0, 0.97), Color(110.0 / 255.0, 90.0 / 255.0, 255.0 / 255.0, 0.7))

	var cx := p.position.x + p.size.x / 2.0
	HudDraw.text(self, FONT_VT323, cx, p.position.y + 22, "🖱️  Sensibilité souris", 15, Color("#cbc3ff"), HORIZONTAL_ALIGNMENT_CENTER)

	var pct := roundi(GameState.mouse_sensitivity * 100.0)
	HudDraw.text(self, FONT_VT323, cx, p.position.y + 44, "%d%%" % pct, 13, Color.WHITE, HORIZONTAL_ALIGNMENT_CENTER)

	var hit := _slider.get_rect()
	HudDraw.text(self, FONT_VT323, hit.position.x, hit.position.y + hit.size.y + 12, "Lent", 10, Color(180.0 / 255.0, 170.0 / 255.0, 240.0 / 255.0, 0.6))
	HudDraw.text(self, FONT_VT323, hit.position.x + hit.size.x, hit.position.y + hit.size.y + 12, "Rapide", 10, Color(180.0 / 255.0, 170.0 / 255.0, 240.0 / 255.0, 0.6), HORIZONTAL_ALIGNMENT_RIGHT)

	HudDraw.text(self, FONT_VT323, cx, p.position.y + p.size.y - 10, "[O] ou clic extérieur pour fermer", 10, Color(150.0 / 255.0, 140.0 / 255.0, 220.0 / 255.0, 0.5), HORIZONTAL_ALIGNMENT_CENTER)
