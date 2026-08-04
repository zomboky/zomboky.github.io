class_name HudDraw
extends RefCounted
## Primitives de dessin rétro arcade — port de `rrect`/`retroBtn`/`scanlines`/
## `drawSpeedFX` (docs/hibou-3d.html lignes 4996-5060). PLAN_GODOT.md §9 lot 6.
##
## Fonctions **statiques**, chacune prenant le `CanvasItem` receveur en premier
## paramètre : contrairement au canvas 2D (`hctx` global, état de style mutable),
## Godot n'a de méthode `draw_*()` que sur le nœud qui les appelle depuis son
## propre `_draw()`. On retrouve ainsi la signature `rrect(x, y, w, h, …)` du jeu
## d'origine en ajoutant seulement ce récepteur.
##
## Convention pour « pas de remplissage »/« pas de trait » (l'`if (fill)` du JS,
## où `fill`/`stroke` sont parfois `undefined`) : une `Color` d'alpha nul.

const NONE := Color(0, 0, 0, 0)

## `hud.gd` et chaque écran préchargent aussi ces deux polices sous les mêmes
## noms — `preload()` d'un même chemin renvoie partout la **même** ressource
## (cache de Godot), donc le filet de secours posé une fois ci-dessous
## (`_static_init()`) s'applique de fait à tous ces préchargements séparés,
## sans qu'ils aient besoin de connaître `HudDraw`.
const FONT_VT323 := preload("res://assets/fonts/VT323-Regular.ttf")
const FONT_PRESS_START := preload("res://assets/fonts/PressStart2P-Regular.ttf")

## VT323 et Press Start 2P ne couvrent aucun émoji (🦉 ❤️ ⚡ ❄️ ✨ 🔥 🎁 🌿…, utilisés
## partout dans le HUD porté du JS). Un `<canvas>` de navigateur bascule tout
## seul sur une police système pour un glyphe manquant ; un `Font` Godot ne le
## fait jamais sans qu'on le lui dise — sans filet, chaque émoji s'affiche en
## « tofu » (case avec le point de code, repéré à l'écran lot 6). Noto Emoji est
## un tracé **monochrome** (contrairement à Noto Color Emoji, ~15× plus lourd
## pour des bitmaps couleur) : les icônes perdent leur couleur d'origine mais
## restent reconnaissables, et se marient mieux avec le reste de l'interface
## rétro qu'un emoji couleur ne l'aurait fait.
const FONT_EMOJI := preload("res://assets/fonts/NotoEmoji-Regular.ttf")


## Appelé une fois au chargement du script (Godot 4.4+, PLAN_GODOT.md exige 4.5) :
## pas besoin d'un autoload dédié juste pour ce câblage.
##
## Passe par des variables locales : GDScript refuse `CONSTANTE.propriété = …`
## (« Cannot assign a new value to a constant ») même quand ce n'est pas la
## constante elle-même qu'on réaffecte mais une propriété de l'objet qu'elle
## désigne — une variable ordinaire référençant le même objet contourne cette
## restriction du parseur sans rien dupliquer.
static func _static_init() -> void:
	var vt323: Font = FONT_VT323
	var press_start: Font = FONT_PRESS_START
	vt323.fallbacks = [FONT_EMOJI]
	press_start.fallbacks = [FONT_EMOJI]


## Style de `Button` façon arcade colorée, pour les écrans en `Control`/`Button`
## réels (décision C, PLAN_GODOT.md §4.2) : fond plein saturé + liseré noir,
## comme `retroBtn`, mais bâti en `StyleBoxFlat` puisque ces boutons ne passent
## pas par `_draw()` — c'est `Button` qui gère son propre hit-testing.
## Simplification assumée par rapport à `retroBtn` : pas de relief biseauté
## clair/sombre (une seule couleur de bordure par `StyleBoxFlat`), l'essentiel —
## code couleur par mode, lisibilité, retour visuel pressé/survolé — est conservé.
static func make_button_style(fill: Color, border: Color = Color(0, 0, 0, 0.9)) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = fill
	sb.set_border_width_all(2)
	sb.border_color = border
	return sb


## Applique le style ci-dessus aux quatre états d'un bouton (normal/survol/
## pressé/désactivé), avec la légère variation de luminosité qu'on attend d'un
## bouton réactif — `retroBtn` n'avait pas cette distinction (canvas 2D redessiné
## à la main à chaque frame avec un seul état `pressed` booléen).
static func style_button(btn: Button, fill: Color) -> void:
	btn.add_theme_stylebox_override("normal", make_button_style(fill))
	btn.add_theme_stylebox_override("hover", make_button_style(fill.lightened(0.15)))
	btn.add_theme_stylebox_override("pressed", make_button_style(fill.darkened(0.2)))
	btn.add_theme_stylebox_override("disabled", make_button_style(fill.darkened(0.5).lerp(Color(0.15, 0.15, 0.2), 0.5)))
	btn.add_theme_color_override("font_color", Color.WHITE)
	btn.add_theme_color_override("font_disabled_color", Color(1, 1, 1, 0.35))


## Panneau à cadre double : liseré noir extérieur + trait néon intérieur. Le rayon
## `r` de l'original est ignoré — coins nets façon borne d'arcade (commentaire JS
## ligne 4992) — mais gardé en paramètre pour que les appels se lisent pareil.
static func rrect(ci: CanvasItem, x: float, y: float, w: float, h: float, _r: float,
		fill: Color = NONE, stroke: Color = NONE, lw: float = 2.0) -> void:
	x = roundf(x); y = roundf(y); w = roundf(w); h = roundf(h)
	if fill.a > 0.0:
		ci.draw_rect(Rect2(x, y, w, h), fill, true)
	if stroke.a > 0.0:
		ci.draw_rect(Rect2(x + 0.5, y + 0.5, w - 1, h - 1), Color(0, 0, 0, 0.85), false, 1.0)
		ci.draw_rect(Rect2(x + 2.5, y + 2.5, w - 5, h - 5), stroke, false, lw)


## Bouton biseauté façon borne d'arcade : fond plein saturé + relief (clair en
## haut/gauche, sombre en bas/droite), inversé quand `pressed`.
static func retro_btn(ci: CanvasItem, x: float, y: float, w: float, h: float,
		fill: Color, pressed: bool = false) -> void:
	x = roundf(x); y = roundf(y); w = roundf(w); h = roundf(h)
	ci.draw_rect(Rect2(x, y, w, h), fill, true)
	var lite := Color(1, 1, 1, 0.6)
	var dark := Color(0, 0, 0, 0.55)
	var top_left := PackedVector2Array([
		Vector2(x + 1, y + h - 1), Vector2(x + 1, y + 1), Vector2(x + w - 1, y + 1),
	])
	var bottom_right := PackedVector2Array([
		Vector2(x + w - 1, y + 1), Vector2(x + w - 1, y + h - 1), Vector2(x + 1, y + h - 1),
	])
	ci.draw_polyline(top_left, dark if pressed else lite, 2.0)
	ci.draw_polyline(bottom_right, lite if pressed else dark, 2.0)
	ci.draw_rect(Rect2(x + 0.5, y + 0.5, w - 1, h - 1), Color(0, 0, 0, 0.9), false, 1.0)


## Texte à ligne de base **centrée verticalement** sur `y_mid`, comme
## `hctx.textBaseline = 'middle'` — Godot ne connaît que la ligne de base typo.
## `0.35 × taille` est une approximation d'usage (la moitié de la hauteur de x
## typique) : suffisante pour un HUD, pas une exigence de rendu pixel-exact.
static func text(ci: CanvasItem, font: Font, x: float, y_mid: float, s: String, size: int,
		color: Color, align: HorizontalAlignment = HORIZONTAL_ALIGNMENT_LEFT) -> void:
	var draw_x := x
	if align != HORIZONTAL_ALIGNMENT_LEFT:
		var measured := font.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
		draw_x = x - measured if align == HORIZONTAL_ALIGNMENT_RIGHT else x - measured / 2.0
	ci.draw_string(font, Vector2(draw_x, y_mid + size * 0.35), s, HORIZONTAL_ALIGNMENT_LEFT, -1, size, color)


## Barre horizontale à dégradé linéaire gauche→droite (`createLinearGradient` n'a
## pas d'équivalent direct sur `CanvasItem` : approximé par des bandes verticales
## interpolées, assez fines pour paraître continues à la taille d'une jauge de HUD).
static func rrect_gradient_h(ci: CanvasItem, x: float, y: float, w: float, h: float,
		color_a: Color, color_b: Color) -> void:
	if w <= 0.0:
		return
	const STRIPS := 24
	var strip_w := w / float(STRIPS)
	for i in range(STRIPS):
		var t := float(i) / float(maxi(1, STRIPS - 1))
		ci.draw_rect(Rect2(x + i * strip_w, y, strip_w + 0.5, h), color_a.lerp(color_b, t), true)


## Voile de scanlines CRT sur une zone (menus plein écran). Les lignes sont déjà
## bornées à `[x, x+w) × [y, y+h)` par la boucle : pas besoin du `clip()` du JS.
static func scanlines(ci: CanvasItem, x: float, y: float, w: float, h: float, alpha: float = 0.16) -> void:
	var color := Color(0, 0, 0, alpha)
	var sy := roundf(y)
	while sy < y + h:
		ci.draw_rect(Rect2(x, sy, w, 1), color, true)
		sy += 3.0


## Vignette dynamique + lignes de vitesse radiales : l'écran « se resserre » et
## file à haute vitesse ou sous buff ⚡. Port de `drawSpeedFX()` — approximé en
## anneaux concentriques (pas de dégradé radial natif sur un `CanvasItem` non
## carré sans le déformer, voir commentaire dans `hud.gd`), le résultat visuel
## est équivalent, pas pixel-identique — non pertinent pour un effet de juice.
##
## [param speed_ratio] est `speed / MAX_SPEED`, **non borné à 1** (contrairement à
## celui retourné par `FlightModel.step()`) : c'est ce qui laisse l'effet monter
## au-delà de la vitesse de croisière maximale, comme `THREE.MathUtils.clamp(
## speed / MAX_SPEED, 0, 1.3)` dans le jeu d'origine.
static func speed_fx(ci: CanvasItem, viewport_size: Vector2, speed_ratio: float, speed_buff_active: bool) -> void:
	var sr := clampf(speed_ratio, 0.0, 1.3)
	var k := maxf(0.0, (sr - 0.8) * 2.0) + (0.4 if speed_buff_active else 0.0)
	if k <= 0.03:
		return
	var w := viewport_size.x
	var h := viewport_size.y
	var center := Vector2(w, h) * 0.5
	var r0 := minf(w, h) * 0.32
	var r1 := center.length()
	var target_alpha := minf(0.55, 0.5 * k)
	var vignette_color := Color(6.0 / 255.0, 8.0 / 255.0, 26.0 / 255.0)

	const RING_COUNT := 16
	var band := (r1 - r0) / float(RING_COUNT)
	for i in range(RING_COUNT):
		var t := (float(i) + 0.5) / float(RING_COUNT)
		var c := vignette_color
		c.a = target_alpha * t
		ci.draw_arc(center, r0 + (float(i) + 0.5) * band, 0.0, TAU, 48, c, band + 1.0)

	var line_color := Color(210.0 / 255.0, 230.0 / 255.0, 255.0 / 255.0, minf(0.4, 0.3 * k))
	var n := int(8 + 14 * k)
	for _i in range(n):
		var a := randf_range(0.0, TAU)
		var lr0 := minf(w, h) * randf_range(0.38, 0.5)
		var lr1 := lr0 + randf_range(60.0, 190.0) * k
		var dir := Vector2(cos(a), sin(a))
		ci.draw_line(center + dir * lr0, center + dir * lr1, line_color, 2.0)
