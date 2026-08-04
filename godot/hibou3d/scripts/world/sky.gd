class_name SkySystem
extends Node3D
## Nommée `SkySystem` et non `Sky` : ce dernier nom est déjà pris par la ressource
## native de Godot (`Environment.sky`), utilisée juste en dessous.
## Cycle jour/nuit, lumière céleste unique, soleil, lune — port de `updateDayNightCycle()`
## et `makeSky()` (docs/hibou-3d.html).
##
## `moonLight` du jeu d'origine joue les deux rôles : soleil le jour, lune la nuit, jamais
## les deux à la fois. On garde la même unique `DirectionalLight3D` ici plutôt que d'en
## animer deux, pour la même raison que le jeu original — en rendu Compatibility, additionner
## deux lumières directionnelles à pleine intensité écraserait l'exposition.
##
## Le calcul de phase (`Sky.compute`) est **pur** et ne lit que l'horloge murale
## (`Time.get_unix_time_from_system()`), jamais un temps de session : c'est ce qui garantit
## que deux instances du jeu, lancées à des moments différents, affichent la même heure du
## jour sans échanger la moindre donnée réseau (voir tests/test_sky.gd).

const DAY_NIGHT_CYCLE_SECONDS := 480.0 ## 8 minutes, boucle continue

const SUN_COLOR := Color("fff4d6")
const SUN_BASE_LIGHT := 1.8
const SUN_PEAK_LIGHT := 3.4
const AMBIENT_NIGHT_INTENSITY := 0.9
const AMBIENT_DAY_INTENSITY := 1.3
const AMBIENT_NIGHT_COLOR := Color("8899ff")
const AMBIENT_DAY_COLOR := Color("bfe0ff")
const FOG_CLEAR_NIGHT := Color("0c1030")
const FOG_CLEAR_DAY := Color("9cc7e8")

const MOON_DISTANCE := 2400.0 ## distance au centre de l'arène, bien au-delà de l'arène jouable
const SUN_RADIUS := 210.0
const MOON_RADIUS := 225.0
const MOON_BASE_LIGHT := 2.2
const MOON_FULL_LIGHT := 3.6 ## lu via `moon_fill_progress`, câblé par l'événement du lot 8
const MOON_COLOR_NORMAL := Color("fff2d0")

## Lumière projetée près du joueur (§5, comme `moonLight.position` dans le jeu d'origine) :
## garde le frustum de la caméra d'ombre petit et net, même si Godot centre en pratique ses
## PSSM sur la caméra de rendu plutôt que sur la position du nœud lumière.
const LIGHT_PLAYER_OFFSET := 150.0

## État de la pleine lune (lot 8) : 0 hors de tout événement, comme `moon.fillProgress`.
## Câblé mais non piloté avant que l'événement existe — `night_intensity` reste alors égal
## à `MOON_BASE_LIGHT`, exactement comme `lerp(base, full, 0)`.
var moon_fill_progress := 0.0

## Le hibou, pour centrer la lumière céleste. Renseigné par la scène principale.
var player: Node3D = null

## Dernière fraction jour/nuit calculée (0 = nuit pleine, 1 = jour plein), lue par le HUD
## (lot 6) et les futurs événements météo (lot 8).
var day_factor := 0.0

@onready var _environment: Environment = $WorldEnvironment.environment
@onready var _sky_material: ShaderMaterial = _environment.sky.sky_material
@onready var _light: DirectionalLight3D = $CelestialLight
@onready var _sun_mesh: MeshInstance3D = $SunMesh
@onready var _moon_mesh: MeshInstance3D = $MoonMesh


## Position du soleil et de la lune à un instant donné — pur, sans effet de bord, pour que
## deux appels au même `unix_time` donnent bit-à-bit le même résultat (voir tests/test_sky.gd).
class Ephemeris:
	var sun_dir: Vector3
	var moon_dir: Vector3
	var elevation: float
	var day_factor: float


static func compute(unix_time: float) -> Ephemeris:
	var e := Ephemeris.new()
	var phase := fmod(unix_time, DAY_NIGHT_CYCLE_SECONDS) / DAY_NIGHT_CYCLE_SECONDS
	var angle := phase * TAU
	e.sun_dir = Vector3(cos(angle), sin(angle), 0.35).normalized()
	e.moon_dir = -e.sun_dir
	e.elevation = e.sun_dir.y
	# `smoothstep(from, to, x)` en GDScript, `smoothstep(x, min, max)` en Three.js : mêmes
	# bornes -0.05/0.05, ordre des arguments inversé entre les deux langages.
	e.day_factor = smoothstep(-0.05, 0.05, e.elevation)
	return e


func _ready() -> void:
	var sun_material := StandardMaterial3D.new()
	sun_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	sun_material.albedo_color = SUN_COLOR
	sun_material.disable_fog = true
	_sun_mesh.mesh = SphereMesh.new()
	(_sun_mesh.mesh as SphereMesh).radius = SUN_RADIUS
	(_sun_mesh.mesh as SphereMesh).height = SUN_RADIUS * 2.0
	_sun_mesh.mesh.surface_set_material(0, sun_material)
	_sun_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

	# Pas de `moon.glb` livré avec ce projet (voir AVANCEMENT.md, Écarts) : comme le jeu
	# d'origine sans `models.moon`, on retombe sur une sphère à texture de cratères générée
	# une fois au démarrage, jamais recalculée en boucle.
	var moon_material := StandardMaterial3D.new()
	moon_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	moon_material.albedo_texture = _make_moon_texture()
	moon_material.albedo_color = MOON_COLOR_NORMAL
	moon_material.disable_fog = true
	_moon_mesh.mesh = SphereMesh.new()
	(_moon_mesh.mesh as SphereMesh).radius = MOON_RADIUS
	(_moon_mesh.mesh as SphereMesh).height = MOON_RADIUS * 2.0
	(_moon_mesh.mesh as SphereMesh).radial_segments = 48
	(_moon_mesh.mesh as SphereMesh).rings = 32
	_moon_mesh.mesh.surface_set_material(0, moon_material)
	_moon_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF


func _process(_delta: float) -> void:
	var e := compute(Time.get_unix_time_from_system())
	day_factor = e.day_factor

	_sun_mesh.position = e.sun_dir * MOON_DISTANCE
	_sun_mesh.visible = e.sun_dir.y > -0.05
	_moon_mesh.position = e.moon_dir * MOON_DISTANCE
	_moon_mesh.visible = e.moon_dir.y > -0.05

	var active_dir := e.sun_dir if e.day_factor > 0.5 else e.moon_dir
	var origin := player.global_position if player else Vector3.ZERO
	_light.global_position = origin + active_dir * LIGHT_PLAYER_OFFSET
	_orient_light(active_dir)
	_light.shadow_enabled = e.day_factor > 0.15

	var night_intensity := lerpf(MOON_BASE_LIGHT, MOON_FULL_LIGHT, moon_fill_progress)
	var day_intensity := lerpf(SUN_BASE_LIGHT, SUN_PEAK_LIGHT, clampf(e.elevation, 0.0, 1.0))
	_light.light_energy = lerpf(night_intensity, day_intensity, e.day_factor)
	_light.light_color = MOON_COLOR_NORMAL.lerp(SUN_COLOR, e.day_factor)

	_environment.ambient_light_color = AMBIENT_NIGHT_COLOR.lerp(AMBIENT_DAY_COLOR, e.day_factor)
	_environment.ambient_light_energy = lerpf(AMBIENT_NIGHT_INTENSITY, AMBIENT_DAY_INTENSITY, e.day_factor)
	_environment.fog_light_color = FOG_CLEAR_NIGHT.lerp(FOG_CLEAR_DAY, e.day_factor)

	_sky_material.set_shader_parameter("day_factor", e.day_factor)


## Oriente la lumière vers le joueur. `Basis.looking_at` dégénère si la direction demandée
## est colinéaire au vecteur "haut" : bascule sur un repère de secours dans ce cas, comme le
## ferait n'importe quelle caméra regardant le zénith ou le nadir.
func _orient_light(active_dir: Vector3) -> void:
	var forward := -active_dir
	var up := Vector3.UP
	if absf(forward.dot(up)) > 0.999:
		up = Vector3.FORWARD
	_light.global_basis = Basis.looking_at(forward, up)


## Port de `makeMoonSurfaceTexture()` : 55 taches radiales gris-brun sur fond crème, mêmes
## rayons (8-46 px) et mêmes bornes d'opacité (0.38 au centre, 0 au bord).
static func _make_moon_texture() -> ImageTexture:
	const SIZE := 512
	const BASE := Color("e9e3cf")
	const CRATER := Color(55.0 / 255.0, 45.0 / 255.0, 35.0 / 255.0)
	var image := Image.create(SIZE, SIZE, false, Image.FORMAT_RGB8)
	image.fill(BASE)
	var rng := Rng.new(20260718)
	for _i in 55:
		var cx := rng.range_f(0.0, SIZE)
		var cy := rng.range_f(0.0, SIZE)
		var r := rng.range_f(8.0, 46.0)
		var min_x := maxi(0, int(cx - r))
		var max_x := mini(SIZE - 1, int(cx + r))
		var min_y := maxi(0, int(cy - r))
		var max_y := mini(SIZE - 1, int(cy + r))
		for y in range(min_y, max_y + 1):
			for x in range(min_x, max_x + 1):
				var d := Vector2(x - cx, y - cy).length()
				if d > r:
					continue
				var a := 0.38 * (1.0 - d / r)
				image.set_pixel(x, y, image.get_pixel(x, y).lerp(CRATER, a))
	return ImageTexture.create_from_image(image)
