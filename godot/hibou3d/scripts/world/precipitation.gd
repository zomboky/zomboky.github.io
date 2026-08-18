class_name Precipitation
extends MultiMeshInstance3D
## Pluie et neige — port de `makeWeather()`, `anchorDrop()` et de la partie
## « gouttes » de `updateWeatherFX()` (docs/hibou-3d.html lignes 1464-1502,
## 1552-1581). PLAN_GODOT.md §9 lot 8.
##
## 900 gouttes qui **suivent le hibou** dans un volume de ±95 u : chacune retombe,
## et dès qu'elle passe sous le sol ou sort du volume elle est réancrée en haut.
## On ne simule donc jamais la pluie de toute l'arène, seulement celle qu'on voit.
##
## Au-dessus de la ligne de neige, les gouttes deviennent des flocons : plus gros,
## huit fois plus lents, et ils voltigent au lieu de tomber droit.
##
## Trois choix de portage :
## - `THREE.Points` n'a pas d'équivalent direct ; un `MultiMesh` de quads en mode
##   panneau d'affichage donne le même rendu et réutilise la texture de halo déjà
##   partagée par les branches, le cadeau et les ours (lot 7).
## - Les transformations partent au GPU **en un seul appel** (`MultiMesh.buffer`)
##   plutôt qu'en 900 `set_instance_transform()` : à cette cadence, c'est le coût
##   des appels qui domine, pas le calcul.
## - La hauteur du sol de chaque goutte est **mémorisée à l'ancrage** (comme les
##   lucioles du jeu d'origine) : zéro interrogation du terrain par frame, là où
##   900 appels à `effective_ground_y()` coûteraient bien plus que la pluie.

const DROPS := 900
## Demi-côté du volume de pluie suivant le hibou, en unités monde.
const SPREAD := 95.0
## Au-delà de cette distance horizontale, la goutte est réancrée.
const RECYCLE_DIST := 120.0
## Marge sous le hibou en dessous de laquelle une goutte disparaît, même si le sol
## est plus bas encore : inutile de simuler la pluie d'un canyon qu'on survole.
const BELOW_OWL := 30.0

const RAIN_COLOR := Color(0x9f / 255.0, 0xc0 / 255.0, 0xe8 / 255.0)
const SNOW_COLOR := Color(0xf4 / 255.0, 0xf8 / 255.0, 0xff / 255.0)
const RAIN_SIZE := 0.55
const SNOW_SIZE := 0.95
## Le hibou doit voler franchement au-dessus de la ligne de neige pour qu'il neige.
const SNOW_MARGIN := 12.0
## Conversion force du vent → dérive des gouttes. Bien plus fort que pour les
## rochers : une goutte n'a aucune inertie.
const WIND_DRIFT := 8.0

## Hauteur de sol effective, `func(x, z) -> float`.
var ground_y: Callable

var _pos := PackedVector3Array()
var _speed := PackedFloat32Array()
var _sway := PackedFloat32Array()
var _ground := PackedFloat32Array()
var _buffer := PackedFloat32Array()
var _material: StandardMaterial3D
var _size := RAIN_SIZE
var _color := RAIN_COLOR


func _ready() -> void:
	var quad := QuadMesh.new()
	quad.size = Vector2.ONE

	_material = StandardMaterial3D.new()
	_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_material.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	# Sans cela, le mode panneau d'affichage écrase l'échelle portée par chaque
	# instance — or c'est elle qui distingue une goutte d'un flocon.
	_material.billboard_keep_scale = true
	_material.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	_material.albedo_texture = Glow.shared_texture()
	_material.albedo_color = Color(RAIN_COLOR, 0.0)
	material_override = _material
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

	multimesh = MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	multimesh.mesh = quad
	multimesh.instance_count = DROPS

	_pos.resize(DROPS)
	_speed.resize(DROPS)
	_sway.resize(DROPS)
	_ground.resize(DROPS)
	_buffer.resize(DROPS * 12)
	visible = false


## Réancre toutes les gouttes autour du hibou — `for (const d of precipData)
## anchorDrop(d, false)` en fin de `beginGame()`.
func reset(owl_pos: Vector3) -> void:
	for i in DROPS:
		_anchor(i, owl_pos, false)
	visible = false


## Un pas de pluie. [param level] est le niveau de mauvais temps déjà lissé
## (0 = ciel clair, 1 = tempête) : c'est lui qui décide de l'opacité et de la
## visibilité, pas l'événement brut.
func step(delta: float, owl_pos: Vector3, level: float,
		storm_active: bool, wind_angle: float, wind_force: float) -> void:
	visible = level > 0.02
	if not visible:
		return

	# Flocons dès que le hibou passe franchement au-dessus de la ligne de neige.
	# La transition est progressive : la couleur et la taille rejoignent leur
	# cible en quelques frames, sans basculement net à la traversée.
	var snowing := owl_pos.y > Terrain.SNOW_LINE + SNOW_MARGIN
	_color = _color.lerp(SNOW_COLOR if snowing else RAIN_COLOR, 0.08)
	_size = lerpf(_size, SNOW_SIZE if snowing else RAIN_SIZE, 0.08)
	_material.albedo_color = Color(_color, 0.8 * level)

	var wind := Vector2.ZERO
	if storm_active:
		wind = Vector2(cos(wind_angle), sin(wind_angle)) * wind_force * WIND_DRIFT

	var floor_y := owl_pos.y - BELOW_OWL
	for i in DROPS:
		var p := _pos[i]
		if snowing:
			# Les flocons tombent lentement… et voltigent.
			var sway := _sway[i] + delta * 1.6
			_sway[i] = sway
			p.y -= _speed[i] * 0.12 * delta
			p.x += (wind.x + cos(sway) * 2.5) * delta
			p.z += (wind.y + sin(sway * 0.8) * 2.5) * delta
		else:
			p.y -= _speed[i] * delta  # la pluie tombe dru
			p.x += wind.x * delta
			p.z += wind.y * delta
		_pos[i] = p

		var flat := Vector2(p.x - owl_pos.x, p.z - owl_pos.z)
		if p.y < maxf(_ground[i], floor_y) or flat.length_squared() > RECYCLE_DIST * RECYCLE_DIST:
			_anchor(i, owl_pos, true)
			p = _pos[i]
		_write_instance(i, p)
	multimesh.buffer = _buffer


## [param from_top] : au réancrage en cours de pluie, la goutte réapparaît
## au-dessus du hibou ; à l'initialisation, elle est semée tout autour de lui pour
## que la pluie soit déjà en place et non en train de tomber d'un seul bloc.
func _anchor(index: int, owl_pos: Vector3, from_top: bool) -> void:
	var x := owl_pos.x + randf_range(-SPREAD, SPREAD)
	var z := owl_pos.z + randf_range(-SPREAD, SPREAD)
	var y := owl_pos.y + (randf_range(25.0, 60.0) if from_top else randf_range(-25.0, 60.0))
	_pos[index] = Vector3(x, y, z)
	_speed[index] = randf_range(55.0, 85.0)
	_sway[index] = randf_range(0.0, TAU)
	_ground[index] = ground_y.call(x, z)


## Une transformation 3×4 à plat dans le tampon du `MultiMesh` : trois lignes de
## quatre flottants, les trois premières colonnes portant la base (ici une simple
## échelle uniforme, l'orientation étant assurée par le panneau d'affichage) et la
## quatrième l'origine.
func _write_instance(index: int, p: Vector3) -> void:
	var o := index * 12
	_buffer[o] = _size;  _buffer[o + 1] = 0.0;   _buffer[o + 2] = 0.0;   _buffer[o + 3] = p.x
	_buffer[o + 4] = 0.0; _buffer[o + 5] = _size; _buffer[o + 6] = 0.0;  _buffer[o + 7] = p.y
	_buffer[o + 8] = 0.0; _buffer[o + 9] = 0.0;  _buffer[o + 10] = _size; _buffer[o + 11] = p.z
