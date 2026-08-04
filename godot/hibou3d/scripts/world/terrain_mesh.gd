class_name TerrainMesh
extends MeshInstance3D
## Maillage du terrain — port de `makeTerrain()` (docs/hibou-3d.html).
##
## Le maillage n'est qu'un **affichage** de `Terrain.terrain_height()` : rien ici
## ne fait autorité. Les collisions, le placement des arbres, des ours et de la
## caméra interrogent directement la fonction, jamais ce mesh (décision A, §4.2).
## Conséquence pratique : le nombre de segments peut être baissé pour les
## performances sans jamais changer le gameplay d'un pouce.
##
## Le maillage est **non indexé** avec une **couleur par facette** : c'est ce qui
## donne le rendu low-poly assumé du jeu, à facettes franches. Chaque triangle a
## ses trois sommets à la même couleur et à la même normale, donc rien ne peut être
## partagé entre triangles voisins.

## Émis pendant une construction découpée, entre 0 et 1. Le lot 6 y branchera
## l'écran de chargement.
signal build_progress(fraction: float)
## Émis quand le maillage est prêt, quel que soit le mode de construction.
signal build_finished()

## Palette, recopiée de `makeTerrain()`. Chaque bande hauteur/pente mélange deux
## variantes via un second canal de bruit — « l'humidité », décorrélée du relief —
## pour casser le banding et varier les teintes.
const GRASS_A := Color("16321f")
const GRASS_B := Color("1e422a")
const GRASS_C := Color("2a4a1e")  ## mousse sombre
const GRASS_D := Color("3d5c28")  ## herbe sèche claire
const SAND := Color("4a4632")
const MUD := Color("3a3020")
const RIVER_BED := Color("1c2822")
const ROCK_DARK := Color("2e333a")
const ROCK_LIGHT := Color("4a5058")
const SNOW := Color("9aa4b8")
const SNOW_BLUE := Color("7f92b8")

## Tramage par facette. Le jeu Three.js tire ce jitter avec `Math.random()` ; ici
## il passe par un générateur semé, pour qu'une même graine de terrain redonne
## exactement le même rendu. Aucune différence visible, mais un bug de relief
## devient reproductible.
const DITHER_SEED := 918273645
const DITHER_MIN := 0.92
const DITHER_MAX := 1.08

## Nombre de segments par côté. Baissable sans conséquence sur le jeu (voir plus haut).
@export var segments := 240
## Nombre de rangées traitées entre deux rendus de frame en mode découpé.
@export var rows_per_frame := 24

var _dither := Rng.new(DITHER_SEED)
var _building := false


func _ready() -> void:
	# Construction découpée par défaut : à 240 segments, la version bloquante fige
	# le thread principal ~2 s en natif, donc bien davantage en WebAssembly. Le
	# lot 6 mettra l'écran de chargement devant ; d'ici là le relief apparaît en
	# quelques frames, ce qui vaut mieux qu'un onglet gelé.
	rebuild_async()


## (Re)construit le maillage, **en bloquant**. Réservé aux tests headless et aux
## petits maillages : à 240 segments, cela fige le thread principal plusieurs
## secondes en WebAssembly.
func rebuild() -> void:
	var started := Time.get_ticks_usec()
	_build_mesh(_sample_heights())
	_report(started, "d'un bloc")
	build_finished.emit()


## (Re)construit le maillage **en le répartissant sur plusieurs frames**, pour ne
## pas figer l'onglet. À `await` derrière l'écran de chargement (§9 lot 3).
##
## Seul l'échantillonnage des hauteurs est découpé : c'est lui qui domine le coût
## (`terrain_height()` fait des dizaines de `sin` par appel, et il y en a 58 000).
func rebuild_async() -> void:
	if _building:
		return
	_building = true
	var started := Time.get_ticks_usec()
	_build_mesh(await _sample_heights_async())
	_building = false
	_report(started, "réparti sur plusieurs frames")
	build_finished.emit()


func _report(started_usec: int, mode: String) -> void:
	print("Terrain : %d segments, %d sommets, construit en %.0f ms (%s)" %
		[segments, segments * segments * 6, (Time.get_ticks_usec() - started_usec) / 1000.0, mode])


## Grille des hauteurs aux sommets. Elle est calculée une fois et non à la volée :
## `terrain_height()` est chère, et chaque sommet est touché par jusqu'à six
## triangles.
func _sample_heights() -> PackedFloat64Array:
	var side := segments + 1
	var step := Terrain.TERRAIN_SIZE / segments
	var origin := -Terrain.TERRAIN_SIZE / 2.0
	var height := PackedFloat64Array()
	height.resize(side * side)
	for gz in side:
		_sample_row(height, gz, side, origin, step)
	return height


func _sample_heights_async() -> PackedFloat64Array:
	var side := segments + 1
	var step := Terrain.TERRAIN_SIZE / segments
	var origin := -Terrain.TERRAIN_SIZE / 2.0
	var height := PackedFloat64Array()
	height.resize(side * side)
	for gz in side:
		_sample_row(height, gz, side, origin, step)
		if gz % rows_per_frame == 0:
			build_progress.emit(float(gz) / side)
			await get_tree().process_frame
	build_progress.emit(1.0)
	return height


func _sample_row(height: PackedFloat64Array, gz: int, side: int,
		origin: float, step: float) -> void:
	var z := origin + gz * step
	for gx in side:
		height[gz * side + gx] = Terrain.terrain_height(origin + gx * step, z)


func _build_mesh(height: PackedFloat64Array) -> void:
	_dither.seed(DITHER_SEED)
	var side := segments + 1
	var step := Terrain.TERRAIN_SIZE / segments
	var origin := -Terrain.TERRAIN_SIZE / 2.0

	var vertex_count := segments * segments * 6
	var vertices := PackedVector3Array()
	var normals := PackedVector3Array()
	var colors := PackedColorArray()
	vertices.resize(vertex_count)
	normals.resize(vertex_count)
	colors.resize(vertex_count)

	var v := 0
	# Canaux de bruit de teinte, échantillonnés une fois par sommet de la rangée
	# courante. Le jeu Three.js les évalue au PREMIER sommet de chaque triangle ;
	# comme les deux triangles d'une cellule commencent en (x0, z0) et (x1, z0),
	# ce cache par rangée donne exactement les mêmes valeurs, en les calculant une
	# fois au lieu de deux.
	var tints: Array[Vector3] = []
	tints.resize(side)
	for gz in segments:
		var z0 := origin + gz * step
		var z1 := z0 + step
		for gx in side:
			tints[gx] = _cell_tint(origin + gx * step, z0)
		for gx in segments:
			var x0 := origin + gx * step
			var x1 := x0 + step
			var a := Vector3(x0, height[gz * side + gx], z0)
			var b := Vector3(x1, height[gz * side + gx + 1], z0)
			var c := Vector3(x1, height[(gz + 1) * side + gx + 1], z1)
			var d := Vector3(x0, height[(gz + 1) * side + gx], z1)
			# Découpe (a, b, d) / (b, c, d) : c'est la diagonale de `PlaneGeometry`
			# en Three.js. L'autre diagonale donnerait un relief low-poly
			# visiblement différent à facettes égales.
			v = _emit_face(vertices, normals, colors, v, a, b, d, tints[gx])
			v = _emit_face(vertices, normals, colors, v, b, c, d, tints[gx + 1])

	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_COLOR] = colors

	var array_mesh := ArrayMesh.new()
	array_mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	mesh = array_mesh

	if material_override == null:
		var material := StandardMaterial3D.new()
		material.vertex_color_use_as_albedo = true
		material.roughness = 1.0
		material.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
		material_override = material

	# Le terrain reçoit les ombres mais n'en projette pas : un relief de 4 500 u de
	# côté dans la carte d'ombre ne ferait qu'en gaspiller la résolution.
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF


## Les trois canaux de bruit qui ne dépendent que de la cellule : humidité, et les
## deux mélanges de teinte.
func _cell_tint(x: float, z: float) -> Vector3:
	return Vector3(
		Terrain.value_noise(x * 0.018 + 91.3, z * 0.018 - 41.7),
		Terrain.value_noise(x * 0.05, z * 0.05),
		Terrain.value_noise(x * 0.05 + 200.0, z * 0.05 + 200.0),
	)


## Écrit un triangle à plat : même normale et même couleur sur les trois sommets.
func _emit_face(vertices: PackedVector3Array, normals: PackedVector3Array,
		colors: PackedColorArray, v: int, p0: Vector3, p1: Vector3, p2: Vector3,
		tint: Vector3) -> int:
	var normal := (p1 - p0).cross(p2 - p0).normalized()
	if normal.y < 0.0:
		normal = -normal  # le terrain est un relief : sa normale regarde vers le haut
	var color := _face_color((p0.y + p1.y + p2.y) / 3.0, normal.y, tint)
	for p in [p0, p1, p2]:
		vertices[v] = p
		normals[v] = normal
		colors[v] = color
		v += 1
	return v


## Couleur d'une facette selon son altitude moyenne, sa pente et l'humidité locale.
func _face_color(h_avg: float, normal_y: float, tint: Vector3) -> Color:
	var moisture := tint.x
	var color: Color
	if h_avg < Terrain.WATER_Y - 0.5:
		color = RIVER_BED
	elif h_avg < Terrain.WATER_Y + 1.2:
		color = MUD.lerp(SAND, tint.y)
	elif h_avg > Terrain.SNOW_LINE:
		color = SNOW_BLUE.lerp(SNOW, moisture)
	elif normal_y < 0.62 or h_avg > Terrain.TREE_LINE:
		color = ROCK_DARK.lerp(ROCK_LIGHT, clampf((normal_y - 0.3) / 0.5, 0.0, 1.0))
	else:
		color = GRASS_A.lerp(GRASS_B, tint.y).lerp(GRASS_C.lerp(GRASS_D, tint.z), moisture)

	var jitter := _dither.range_f(DITHER_MIN, DITHER_MAX)
	return Color(color.r * jitter, color.g * jitter, color.b * jitter)
