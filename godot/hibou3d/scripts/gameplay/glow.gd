class_name Glow
extends MeshInstance3D
## Halo radial doux, teinté à l'usage — port de `makeGlowTexture()` et des
## `THREE.Sprite` additifs qui l'utilisent (docs/hibou-3d.html lignes 2828-2841).
## PLAN_GODOT.md §9 lot 7.
##
## Sert de lueur aux branches (vert tendre / brun terne si pourries), de phare au
## cadeau (doré pulsé) et de télégraphe de charge aux ours (rouge de menace) :
## trois usages, une seule texture partagée entre toutes les instances.
##
## Un `Sprite3D` aurait été le pendant direct de `THREE.Sprite`, mais il n'expose
## pas de mode de fusion : ces halos sont **additifs**, ce qui est ici l'essentiel
## du rendu (une lueur, pas un autocollant). D'où un quad + `StandardMaterial3D`
## en `BILLBOARD_ENABLED`, qui donne les deux — face caméra et addition.

## Diamètre du halo, en unités monde. Dans le jeu d'origine, l'échelle du halo est
## exprimée **relativement** au sprite parent (2,3 pour une branche à l'échelle 2,
## soit 4,6 u) ; ici elle est absolue, sauf pour les ours où le nœud parent porte
## déjà l'échelle de menace et de spawn.
@export var glow_size := 4.6:
	set(value):
		glow_size = value
		if _quad != null:
			_quad.size = Vector2(value, value)

@export var glow_color := Color.WHITE:
	set(value):
		glow_color = value
		_refresh_albedo()

## Opacité de repos. Les appelants la modulent ensuite par [method set_opacity].
@export var glow_opacity := 0.5:
	set(value):
		glow_opacity = value
		_refresh_albedo()

## Côté de la texture, en pixels. 64 comme en JS : c'est un dégradé lisse, aucun
## détail à préserver, et la mise à l'échelle du GPU fait le reste.
const TEXTURE_SIZE := 64

## Construite une seule fois pour tout le jeu : identique partout, seule la teinte
## du matériau change d'un halo à l'autre.
static var _shared_texture: ImageTexture

var _quad: QuadMesh
var _material: StandardMaterial3D


func _ready() -> void:
	_quad = QuadMesh.new()
	_quad.size = Vector2(glow_size, glow_size)
	mesh = _quad

	_material = StandardMaterial3D.new()
	_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_material.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	_material.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	# Sans cela, le mode panneau d'affichage de Godot **écrase** l'échelle héritée
	# du parent. Le halo de menace des ours vit sous un nœud dont l'échelle porte
	# la pulsation d'apparition et le gonflement d'avant-charge : il doit la suivre.
	_material.billboard_keep_scale = true
	# `depthWrite: false` du JS : un halo ne doit pas masquer ce qui est derrière.
	_material.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	# Le brouillard et l'addition ne se combinent pas de la même façon dans les deux
	# moteurs : Three.js mélange VERS la couleur de brouillard (le halo s'éteint au
	# loin), Godot l'ajoute (le halo grossit en un pâté clair). On le coupe donc,
	# c'est le comportement le plus proche de l'original.
	_material.disable_fog = true
	_material.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR
	_material.albedo_texture = shared_texture()
	material_override = _material
	_refresh_albedo()
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF


## Module l'opacité du halo — appelée à chaque frame par les entités qui « respirent »
## (branches), pulsent (cadeau) ou s'allument avant de charger (ours).
func set_opacity(alpha: float) -> void:
	if _material == null:
		return
	_material.albedo_color = Color(glow_color.r, glow_color.g, glow_color.b, alpha)


func _refresh_albedo() -> void:
	set_opacity(glow_opacity)


## Dégradé radial blanc → transparent : opaque au centre, 45 % à mi-rayon, nul au
## bord. Les trois arrêts sont ceux de `createRadialGradient` du JS ; c'est leur
## non-linéarité qui donne le cœur brillant plutôt qu'une tache uniforme.
static func shared_texture() -> ImageTexture:
	if _shared_texture != null:
		return _shared_texture
	var image := Image.create_empty(TEXTURE_SIZE, TEXTURE_SIZE, false, Image.FORMAT_RGBA8)
	var half := TEXTURE_SIZE / 2.0
	for y in TEXTURE_SIZE:
		for x in TEXTURE_SIZE:
			var t := Vector2(x + 0.5 - half, y + 0.5 - half).length() / half
			var alpha := 0.0
			if t < 0.4:
				alpha = lerpf(1.0, 0.45, t / 0.4)
			elif t < 1.0:
				alpha = lerpf(0.45, 0.0, (t - 0.4) / 0.6)
			image.set_pixel(x, y, Color(1, 1, 1, alpha))
	_shared_texture = ImageTexture.create_from_image(image)
	return _shared_texture
