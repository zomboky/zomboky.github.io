extends Node
## Terrain procédural analytique — port de docs/hibou-3d.html (lignes 749-1017).
## PLAN_GODOT.md §5.4 et §9 lot 3.
##
## **On ne porte pas un terrain, on porte une fonction.** `terrain_height(x, z)` est
## fermée : bruit de valeur fBm + crêtes « ridged » + pics gaussiens + creusement de
## rivières + muraille annulaire. La même fonction sert au maillage, aux collisions,
## au placement des arbres, des ours et de la caméra. Aucun échantillonnage de grille,
## aucune heightmap sur disque, et une hauteur de sol exacte en O(1) sans raycast —
## c'est ce qui rend inutile tout `HeightMapShape3D` (décision A, §4.2).
##
## ⚠️ **Tout est en `float` scalaire, jamais en `Vector3`.** Dans une compilation
## standard de Godot, `Vector3` stocke des flottants **32 bits**, alors que le `float`
## de GDScript — comme le `number` de JavaScript — est un **64 bits**. Faire transiter
## une coordonnée par un `Vector3` tronquerait le relief et le ferait diverger de la
## version JavaScript. Constat mesuré au lot 2, voir `tools/flight-parity/README.md`.

const TERRAIN_SIZE := 4500.0  ## couvre toute la zone de jeu élargie
const TERRAIN_SEGS := 240
const WATER_Y := -3.0         ## niveau des lacs
const HILL_AMP := 24.0        ## amplitude des collines fBm (±)
const GROUND_DETAIL_AMP := 5.5  ## bosses fines superposées, visibles loin des montagnes
const SNOW_LINE := 46.0       ## altitude d'enneigement
const TREE_LINE := 38.0       ## au-dessus : plus d'arbres

const ARENA_RADIUS_XZ := 1400.0

# ── Muraille de montagnes ────────────────────────────────────────────────
# L'arène est cernée d'une vraie chaîne de sommets : le terrain se soulève à
# l'approche du bord et culmine au-delà du mur invisible. La limite de jeu n'est
# pas une grille abstraite, c'est la montagne elle-même — et comme `terrain_height`
# est aussi la fonction de collision, ces pentes sont de VRAIS obstacles.
const RING_START := ARENA_RADIUS_XZ * 0.86  ## le sol commence à se soulever ici
const RING_FULL := ARENA_RADIUS_XZ * 1.18   ## altitude de crête atteinte ici
const RING_BASE := 240.0                    ## hauteur minimale de la muraille
const RING_VAR := 260.0                     ## relief supplémentaire des sommets

## Graine canonique du bruit de terrain. **Ne jamais changer** sans repasser le
## harnais de parité : c'est elle qui garantit que tous les clients d'une manche
## multijoueur voient le même sol. Un client qui verrait un relief différent
## placerait les hiboux distants selon SON sol : ils apparaîtraient enterrés.
const CANONICAL_TERRAIN_SEED := 483.271
## Graines canoniques des semis dédiés. Chacun a son propre générateur : régénérer
## la forêt ne doit pas décaler les rivières.
const PEAK_SEED := 73939133
const RIVER_SEED := 20260716
const TREE_SEED := 20260715
const BUILDING_SEED := 20260717

var terrain_seed := CANONICAL_TERRAIN_SEED
var peak_seed := PEAK_SEED
## Vrai dès qu'une partie solo a re-tiré le terrain.
var world_regenerated := false

## Pics de montagne : `{ x, z, h, r }`, semés à l'intérieur de l'arène.
var mountain_peaks: Array[Dictionary] = []
## Les mêmes pics, à plat (x, z, h, r entrelacés). `terrain_height()` est appelée
## des dizaines de milliers de fois par construction de maillage : y traverser un
## `Array[Dictionary]` coûte quatre recherches par pic et par appel.
var _peaks_flat := PackedFloat64Array()
## Rivières : `{ points: PackedFloat64Array (x, z entrelacés), width, depth }`.
##
## Les points sont en **64 bits entrelacés** et non en `PackedVector2Array` : ce
## dernier stockerait du 32 bits et tronquerait le tracé, donc le creusement des
## chenaux — et donc `terrain_height()` elle-même.
var river_paths: Array[Dictionary] = []

## Générateurs consommés par le décor du lot 4. Exposés ici parce que
## `restore_canonical()` doit pouvoir les réamorcer d'un bloc.
var tree_rng := Rng.new(TREE_SEED)
var building_rng := Rng.new(BUILDING_SEED)

var _peak_rng := Rng.new(PEAK_SEED)
var _river_rng := Rng.new(RIVER_SEED)
## Snapshot canonique des pics, restauré avant chaque manche multijoueur.
var _canonical_peaks: Array[Dictionary] = []


func _ready() -> void:
	fill_mountain_peaks()
	_canonical_peaks = mountain_peaks.duplicate(true)
	fill_river_paths()


# ══════════════════════════════════════════════════════════════════════════
#  Bruits
# ══════════════════════════════════════════════════════════════════════════

## Hash pseudo-aléatoire d'une case entière de la grille de bruit.
##
## ⚠️ Point le plus délicat du portage (§5.4). L'amplification par 43758,5453 est
## le principe même de ce hash : elle transforme quelques ULP d'écart sur `sin()`
## en une valeur complètement différente. Le harnais `tools/terrain-parity/`
## vérifie que GDScript et JavaScript retournent bien la même chose.
func hash_noise(ix: float, iz: float) -> float:
	var n := sin(ix * 127.1 + iz * 311.7 + terrain_seed * 17.3) * 43758.5453
	return n - floorf(n)


## Bruit de valeur : hash aux quatre coins, interpolation lissée (smoothstep).
func value_noise(x: float, z: float) -> float:
	var ix := floorf(x)
	var iz := floorf(z)
	var fx := x - ix
	var fz := z - iz
	var sx := fx * fx * (3.0 - 2.0 * fx)
	var sz := fz * fz * (3.0 - 2.0 * fz)
	var a := hash_noise(ix, iz)
	var b := hash_noise(ix + 1.0, iz)
	var c := hash_noise(ix, iz + 1.0)
	var d := hash_noise(ix + 1.0, iz + 1.0)
	return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz


## Somme d'octaves de bruit de valeur. Résultat dans ~[0, 1].
func fbm(x: float, z: float, octaves: int = 5) -> float:
	var total := 0.0
	var amp := 0.5
	var freq := 1.0
	for _o in octaves:
		total += amp * value_noise(x * freq, z * freq)
		amp *= 0.5
		freq *= 2.03
	return total


## Bruit « ridged » : crêtes franches, vallées larges. Mêmes octaves que `fbm`,
## mais la valeur est repliée autour de 0,5 puis mise au carré — davantage de
## relief et de détail sans changer la forme macro (montagnes, muraille, lacs).
func ridged(x: float, z: float, octaves: int = 3) -> float:
	var total := 0.0
	var amp := 0.5
	var freq := 1.0
	for _o in octaves:
		var n := 1.0 - absf(value_noise(x * freq, z * freq) * 2.0 - 1.0)
		total += amp * n * n
		amp *= 0.5
		freq *= 2.03
	return total


# ══════════════════════════════════════════════════════════════════════════
#  Semis : pics de montagne et rivières
# ══════════════════════════════════════════════════════════════════════════

## Sème les pics gaussiens à l'intérieur de l'arène, jamais au centre.
##
## Le générateur est dédié et semé explicitement — surtout pas `randf()`. Ces pics
## entrent dans `terrain_height()`, donc dans la COLLISION : ils doivent être
## identiques sur tous les clients multijoueur.
func fill_mountain_peaks() -> void:
	_peak_rng.seed(peak_seed)
	mountain_peaks.clear()
	var peak_count := int(floorf(_peak_rng.range_f(10.0, 15.0)))
	for i in peak_count:
		# L'ordre des tirages fait partie du résultat : angle, distance, hauteur, rayon.
		var angle := (float(i) / peak_count) * TAU + _peak_rng.range_f(-0.5, 0.5)
		var dist := _peak_rng.range_f(140.0, ARENA_RADIUS_XZ * 0.72)
		mountain_peaks.append({
			"x": cos(angle) * dist,
			"z": sin(angle) * dist,
			# Pics volontairement adoucis (moins hauts, plus larges) : `terrain_height`
			# servant aussi de collision, des pentes trop raides deviennent des
			# obstacles sur lesquels on crashe en croyant pouvoir passer.
			"h": _peak_rng.range_f(22.0, 70.0),
			"r": _peak_rng.range_f(80.0, 200.0),
		})
	_cache_peaks()


## Reconstruit le cache plat à partir de `mountain_peaks`.
func _cache_peaks() -> void:
	_peaks_flat.resize(mountain_peaks.size() * 4)
	for i in mountain_peaks.size():
		var p := mountain_peaks[i]
		_peaks_flat[i * 4] = p["x"]
		_peaks_flat[i * 4 + 1] = p["z"]
		_peaks_flat[i * 4 + 2] = p["h"]
		_peaks_flat[i * 4 + 3] = p["r"]


## Trace les rivières : elles naissent près de la muraille et serpentent vers le centre.
func fill_river_paths() -> void:
	river_paths.clear()
	var river_count := 2 + int(floorf(_river_rng.next() * 2.0))
	for i in river_count:
		var start_angle := (float(i) / river_count) * TAU + (_river_rng.next() - 0.5)
		var x := cos(start_angle) * ARENA_RADIUS_XZ * 0.9  # source près de la muraille
		var z := sin(start_angle) * ARENA_RADIUS_XZ * 0.9
		var dir_angle := start_angle + PI + (_river_rng.next() - 0.5) * 0.6
		var points := PackedFloat64Array([x, z])
		var steps := 14 + int(floorf(_river_rng.next() * 6.0))
		var step_len := (ARENA_RADIUS_XZ * 0.78) / steps
		for _s in steps:
			dir_angle += (_river_rng.next() - 0.5) * 0.7  # méandres
			x += cos(dir_angle) * step_len
			z += sin(dir_angle) * step_len
			points.append(x)
			points.append(z)
		# La largeur est tirée avant la profondeur : l'ordre compte.
		var width := 10.0 + _river_rng.next() * 8.0
		var depth := 6.0 + _river_rng.next() * 5.0
		# Boîte englobante du tracé, élargie de la portée maximale du creusement
		# (la largeur atteint `width × 2.8` à l'embouchure). Au-delà, `smoothstep`
		# vaut exactement 1 et la contribution est exactement nulle : sauter ces
		# points n'est pas une approximation, c'est un calcul évité.
		var reach := width * 2.8
		var min_x := INF
		var max_x := -INF
		var min_z := INF
		var max_z := -INF
		for i_pt in points.size() / 2:
			min_x = minf(min_x, points[i_pt * 2])
			max_x = maxf(max_x, points[i_pt * 2])
			min_z = minf(min_z, points[i_pt * 2 + 1])
			max_z = maxf(max_z, points[i_pt * 2 + 1])
		river_paths.append({
			"points": points, "width": width, "depth": depth,
			"min_x": min_x - reach, "max_x": max_x + reach,
			"min_z": min_z - reach, "max_z": max_z + reach,
		})


## Profondeur du chenal creusé par la rivière la plus proche de (x, z).
## Le chenal s'élargit et s'approfondit vers l'embouchure.
func river_carve(x: float, z: float) -> float:
	var carve := 0.0
	for river in river_paths:
		# Hors de la portée du chenal, la contribution est nulle par construction.
		if x < river["min_x"] or x > river["max_x"] or z < river["min_z"] or z > river["max_z"]:
			continue
		var pts: PackedFloat64Array = river["points"]
		var segment_count := pts.size() / 2 - 1
		var min_dist_sq := INF
		var t_along := 0.0
		for i in segment_count:
			var ax := pts[i * 2]
			var az := pts[i * 2 + 1]
			var abx := pts[i * 2 + 2] - ax
			var abz := pts[i * 2 + 3] - az
			var ab_len_sq := abx * abx + abz * abz
			if ab_len_sq == 0.0:
				ab_len_sq = 1.0
			var t := clampf(((x - ax) * abx + (z - az) * abz) / ab_len_sq, 0.0, 1.0)
			var dx := x - (ax + abx * t)
			var dz := z - (az + abz * t)
			var d_sq := dx * dx + dz * dz
			if d_sq < min_dist_sq:
				min_dist_sq = d_sq
				t_along = (i + t) / float(segment_count)
		var dist := sqrt(min_dist_sq)
		var w: float = river["width"] * (1.0 + t_along * 1.8)
		var depth_here: float = river["depth"] * (0.6 + t_along * 0.8)
		carve += depth_here * (1.0 - smoothstep(0.0, w, dist))
	return carve


# ══════════════════════════════════════════════════════════════════════════
#  La fonction de terrain
# ══════════════════════════════════════════════════════════════════════════

## Hauteur du sol en (x, z). Fonction fermée, exacte, en O(1).
func terrain_height(x: float, z: float) -> float:
	# Collines fBm recentrées sur ±HILL_AMP : les creux sous WATER_Y deviennent des lacs.
	var h := (fbm(x * 0.008, z * 0.008) * 2.0 - 1.0) * HILL_AMP
	# Relief fin superposé : des bosses au sol même loin des montagnes et des lacs.
	h += (fbm(x * 0.035, z * 0.035, 3) * 2.0 - 1.0) * GROUND_DETAIL_AMP
	# Crêtes plus franches : casse la régularité du fBm, plus de polygones utiles.
	h += (ridged(x * 0.05, z * 0.05, 3) - 0.35) * (GROUND_DETAIL_AMP * 1.6)
	# Montagnes gaussiennes.
	for i in _peaks_flat.size() / 4:
		var dx := x - _peaks_flat[i * 4]
		var dz := z - _peaks_flat[i * 4 + 1]
		var r := _peaks_flat[i * 4 + 3]
		h += _peaks_flat[i * 4 + 2] * exp(-(dx * dx + dz * dz) / (r * r))

	var d := sqrt(x * x + z * z)
	# Muraille fermant l'arène : grands cols et sommets (bruit basse fréquence)
	# + arêtes déchiquetées (bruit haute fréquence).
	var ring_t := smoothstep(RING_START, RING_FULL, d)
	if ring_t > 0.0:
		var ridge := fbm(x * 0.0016 + 31.4, z * 0.0016 - 12.9, 3)
		var crag := fbm(x * 0.008 - 5.1, z * 0.008 + 44.2, 3)
		h += ring_t * (RING_BASE + ridge * RING_VAR + crag * 90.0)

	h -= river_carve(x, z)  # chenaux creusés ; sous WATER_Y, l'eau devient visible
	# Zone de départ aplanie : rayon ~25 autour du centre, fondu jusqu'à 80.
	return h * smoothstep(25.0, 80.0, d)


## Sol « effectif » pour les collisions et les apparitions : le terrain, ou la
## surface de l'eau — on ne tombe pas au fond d'un lac.
func effective_ground_y(x: float, z: float) -> float:
	return maxf(terrain_height(x, z), WATER_Y)


## Masque de forêt : bruit séparé, décalé pour être indépendant du relief (lot 4).
func forest_density(x: float, z: float) -> float:
	return fbm(x * 0.006 + 57.3, z * 0.006 - 91.7, 3)


# ══════════════════════════════════════════════════════════════════════════
#  Régénération
# ══════════════════════════════════════════════════════════════════════════

## Nouvelle carte pour une partie SOLO : nouveau bruit, nouveaux pics, nouvelles
## rivières, nouvelle forêt.
func regenerate_seed() -> void:
	terrain_seed = randf() * 1000.0
	peak_seed = randi_range(0, 999999999)
	fill_mountain_peaks()
	_river_rng.seed(randi_range(0, 999999999))
	fill_river_paths()
	tree_rng.seed(randi_range(0, 999999999))
	building_rng.seed(randi_range(0, 999999999))
	world_regenerated = true


## Restaure le terrain canonique avant une manche multijoueur, que le client ait
## joué des parties solo entre-temps ou non.
func restore_canonical() -> void:
	terrain_seed = CANONICAL_TERRAIN_SEED
	peak_seed = PEAK_SEED
	mountain_peaks = _canonical_peaks.duplicate(true)
	_cache_peaks()
	_river_rng.seed(RIVER_SEED)
	fill_river_paths()
	tree_rng.seed(TREE_SEED)
	building_rng.seed(BUILDING_SEED)
	world_regenerated = false
