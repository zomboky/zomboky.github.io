class_name FlightModel
extends RefCounted
## Modèle de vol aérodynamique du hibou — port 1:1 de `updateFlight()`
## (docs/hibou-3d.html, lignes 2531–2748). PLAN_GODOT.md §5.3.
##
## **C'est le cœur du jeu.** Le hibou n'est pas « poussé tout droit » : on intègre
## un vrai vecteur vitesse soumis à quatre forces (poussée, portance, traînée,
## pesanteur), avec incidence, décrochage et inertie de rotation. Les virages,
## montées, piqués et décrochages émergent de la physique, pas de règles ad hoc.
##
## Le modèle est **pur** : ni nœud, ni scène, ni serveur physique. Il tient son
## propre état (position, orientation, vitesse) et l'appelant le recopie sur le
## nœud `Owl`. Trois raisons :
##   1. il se teste hors jeu, à pas fixe, contre la version JavaScript
##      (`tools/flight-parity/`) — c'est la recette bloquante du lot 2 ;
##   2. l'IA du bot (lot 10b) fait tourner le même modèle sur une autre entité ;
##   3. rien ne dépend du serveur physique, donc rien ne dérive entre desktop et
##      WebAssembly (décision A, §4.2).
##
## Conventions : Y en haut, main droite, **nez = -Z**. Identiques à Three.js, donc
## aucune conversion de repère (§5.1).

# ── Vitesses angulaires maximales commandées (rad/s) ─────────────────────
# La « barre », pas l'inertie. Les 3 axes sont des commandes en VITESSE : aucun
# ne revient au neutre tout seul quand on relâche — comme un vrai avion, il faut
# contre-braquer pour revenir à plat.
const YAW_RATE := deg_to_rad(70.0)
const PITCH_RATE := deg_to_rad(55.0)
const ROLL_RATE := deg_to_rad(200.0)  ## roulis vif, façon chasse

# ── Moteur ───────────────────────────────────────────────────────────────
const THRUST_ACCEL := 28.0     ## poussée max (u/s²) le long du nez, rapportée à OWL_MASS
const MAX_SPEED := 34.0        ## repère HUD + amplitude du battement d'ailes
const CRUISE_THROTTLE := 0.6   ## consigne fixée d'un simple appui sur ⚡
const THROTTLE_RAMP := 0.8     ## montée de la consigne tant que ⚡ est tenu (throttle/s)
const BRAKE_RATE := 0.55       ## baisse de la consigne tant que Maj est tenu — décélération PROGRESSIVE
const BRAKE_DRAG := 0.9        ## traînée supplémentaire d'aérofrein pendant le freinage

# ── Masse & aérodynamique ────────────────────────────────────────────────
# Toutes les forces ci-dessous sont en newtons, converties en accélération par
# a = ΣF / OWL_MASS (2ᵉ loi de Newton, étape 7). Seule la pesanteur fait exception :
# son accélération ne dépend PAS de la masse — un corps lourd et un corps léger
# tombent à la même vitesse. C'est le POIDS (P = m·g) qui dépend de la masse.
const OWL_MASS := 1.6          ## kg
const GRAVITY := 9.8           ## u/s²
const AIR_LIFT := 0.05         ## portance dynamique de l'aile ∝ v²·CL
const AIR_DRAG := 0.02         ## traînée parasite ∝ v² — cale la croisière vers MAX_SPEED
const INDUCED_DRAG := 0.03     ## traînée induite (prix de l'incidence/des virages) ∝ CL²·v
const FLAP_LIFT := 13.0        ## portance de battement d'ailes (basse vitesse, ∝ poussée)
const FLAP_FADE := 17.0        ## vitesse air au-delà de laquelle le battement ne porte plus
const SIDE_GRIP := 0.6         ## amortissement du dérapage (ne doit pas tuer le virage)
const STALL_AOA := deg_to_rad(18.0)  ## incidence critique de décrochage
const CL_MAX := 1.5            ## portance dynamique max juste avant le décrochage
const CTRL_MIN_SPEED := 7.0    ## sous cette vitesse air : gouvernes molles
const CTRL_FULL_SPEED := 18.0  ## au-dessus : pleine autorité des gouvernes
const ANG_RESPONSE := 7.0      ## inertie de rotation (convergence vers la consigne)
const WIND_ACCEL := 3.1        ## conversion windForce (tempête) → accélération

# ── Décrochage « en cloche » ─────────────────────────────────────────────
# Une chandelle verticale n'est pas tenable indéfiniment : la poussée s'essouffle
# nez au zénith, la vitesse s'évanouit, l'aile lâche, le nez tombe.
const STALL_SPEED := 9.5       ## vitesse air sous laquelle une montée cabrée décroche
const STALL_RECOVER := 13.0    ## vitesse à retrouver, nez baissé, pour raccrocher l'aile
const STALL_HOLD := 0.8        ## durée minimale d'un décrochage, en secondes

# ── Dégâts (multijoueur, lot 10a) ────────────────────────────────────────
const DRIFT_ACCEL := 6.0       ## u/s² de dérive latérale à perte de gouverne maximale

# ── Volume de jeu ────────────────────────────────────────────────────────
const ARENA_CENTER := Vector3(0, 35, 0)
const ARENA_RADIUS_XZ := 1400.0
const ARENA_RADIUS_Y := 630.0
const BOUNDARY_FADE_DIST := 22.0

const SPEED_BUFF_FACTOR := 1.4  ## multiplicateur de poussée et de plafond sous bonus de vitesse


## État de vol exposé aux instruments du HUD (lot 6).
class Readout extends RefCounted:
	var aoa := 0.0        ## incidence, en radians
	var stall := false    ## décrochage en cours (aérodynamique ou « en cloche »)
	var climb := 0.0      ## vitesse verticale, u/s
	var throttle := 0.0   ## consigne moteur, 0..1


## Perte d'autorité par gouverne touchée : 0 = intacte, 1 = 100 % de perte.
## En solo, tout reste à zéro et les termes correspondants sont neutres.
class GovernEff extends RefCounted:
	var left_wing := 0.0
	var right_wing := 0.0
	var tail := 0.0


## Bourrasques de tempête (lot 8). Inactive, elle n'ajoute aucune force.
class Storm extends RefCounted:
	var active := false
	var wind_angle := 0.0
	var wind_force := 0.0
	var gust_phase := 0.0


# ── État intégré ─────────────────────────────────────────────────────────
var position := Vector3.ZERO
var orientation := Quaternion.IDENTITY
var velocity := Vector3.ZERO
## Vitesses angulaires courantes (x = tangage, y = lacet, z = roulis), rad/s.
var ang_rate := Vector3.ZERO
## Module du vecteur vitesse. Sert au battement d'ailes et au HUD.
var speed := 0.0
## Consigne moteur, 0..1.
var throttle := 0.0

var stall_mode := false
var stall_timer := 0.0
var _prev_thrust_held := false

# ── Environnement injecté ────────────────────────────────────────────────
## Hauteur de sol effective en (x, z) : `max(terrain, niveau de l'eau)`. Branchée
## sur l'autoload `Terrain` au lot 3 ; d'ici là, un plancher plat.
var ground_height: Callable = func(_x: float, _z: float) -> float: return -3.0
## Garde au sol : sous `sol + garde`, c'est le crash. Mesurée sur le modèle réel.
var ground_clear := 1.2
## Générateur du tremblement de décrochage. Semé explicitement dans les tests pour
## que la trajectoire soit reproductible.
var rng := Rng.new(1)
var govern_eff := GovernEff.new()
var storm := Storm.new()
## Bonus de vitesse actif (lot 7).
var speed_buff := false

# ── Sorties ──────────────────────────────────────────────────────────────
var readout := Readout.new()
## Secousse d'écran demandée par le buffeting de décrochage. L'appelant la consomme.
var requested_screen_shake := 0.0
## Vrai le pas où le hibou a touché le sol. L'appelant décide de la conséquence
## (game over en solo, respawn en multijoueur) : le modèle ne connaît pas les règles.
var ground_crash := false
## Dernière sévérité de dérive, pour le retour visuel du HUD (lot 10a).
var last_drift_severity := 0.0


## Remet le hibou dans l'état de début de partie : lancé vers l'avant (-Z),
## moteur en croisière, rotations à plat, à 16 u d'altitude au centre de l'arène.
func reset(start_position: Vector3 = Vector3(ARENA_CENTER.x, 16.0, ARENA_CENTER.z)) -> void:
	position = start_position
	orientation = Quaternion.IDENTITY
	speed = MAX_SPEED * 0.55  # décolle déjà lancé
	velocity = Vector3(0, 0, -speed)
	ang_rate = Vector3.ZERO
	throttle = CRUISE_THROTTLE
	stall_mode = false
	stall_timer = 0.0
	_prev_thrust_held = false
	ground_crash = false
	requested_screen_shake = 0.0
	readout = Readout.new()
	readout.throttle = throttle


## Avance le modèle d'un pas. Retourne la vitesse rapportée à `MAX_SPEED`, dans [0, 1]
## — c'est elle qui pilote le battement d'ailes et le champ de la caméra.
##
## Les onze étapes numérotées ci-dessous sont celles du jeu Three.js, dans le même
## ordre : leur enchaînement fait partie du résultat, le réordonner change le vol.
func step(input: FlightInput, delta: float) -> float:
	ground_crash = false

	# ── 2. Dynamique de rotation : inertie + autorité selon la vitesse air ──
	# Gouvernes molles à basse vitesse : un aéronef lent ne répond plus.
	# (L'étape 1, la lecture des commandes, est faite en amont par `FlightInput`.)
	var authority := clampf(
		(speed - CTRL_MIN_SPEED) / (CTRL_FULL_SPEED - CTRL_MIN_SPEED), 0.2, 1.0)
	if stall_mode:
		authority *= 0.3  # aile décrochée : les gouvernes ne mordent presque plus

	# Une gouverne touchée réduit l'autorité des axes qu'elle contrôle : aile =
	# roulis + lacet, queue = tangage + lacet (multijoueur, lot 10a).
	var roll_mult := 1.0 - maxf(govern_eff.left_wing, govern_eff.right_wing)
	var pitch_mult := 1.0 - govern_eff.tail
	var yaw_mult := 1.0 - maxf(maxf(govern_eff.left_wing, govern_eff.right_wing), govern_eff.tail)

	var target_ang := Vector3(
		input.pitch * PITCH_RATE * pitch_mult,
		input.yaw * YAW_RATE * yaw_mult,
		input.roll * ROLL_RATE * roll_mult) * authority
	# Lissage exponentiel : stable quel que soit le pas de temps.
	var k_ang := 1.0 - exp(-ANG_RESPONSE * delta)
	ang_rate = ang_rate.lerp(target_ang, k_ang)

	# Rotations dans le repère LOCAL du hibou : post-multiplication du quaternion,
	# exactement ce que fait `Object3D.rotateX/Y/Z` en Three.js (§5.2).
	orientation *= Quaternion(Vector3.RIGHT, ang_rate.x * delta)
	orientation *= Quaternion(Vector3.UP, ang_rate.y * delta)
	orientation *= Quaternion(Vector3.BACK, ang_rate.z * delta)
	# La souris est un pilotage fin, appliqué directement (crisp), sans inertie.
	orientation *= Quaternion(Vector3.UP, input.mouse_dx)
	orientation *= Quaternion(Vector3.RIGHT, -input.mouse_dy)

	# ── 3. Repère local du hibou (nez / haut / droite) ──
	var fwd := orientation * Vector3.FORWARD
	var up := orientation * Vector3.UP
	var right := orientation * Vector3.RIGHT
	# Inclinaison réelle, lue depuis l'orientation et non depuis une variable tenue
	# à part : c'est elle qui pilote le virage coordonné de l'étape 9.
	var cur_bank := asin(clampf(right.y, -1.0, 1.0))

	# ── 4. Poussée moteur : ⚡ fixe la consigne, Maj la réduit PROGRESSIVEMENT ──
	if input.thrust_held and not _prev_thrust_held:
		throttle = maxf(throttle, CRUISE_THROTTLE)
	if input.thrust_held:
		throttle = minf(1.0, throttle + THROTTLE_RAMP * delta)
	if input.brake_held:
		throttle = maxf(0.0, throttle - BRAKE_RATE * delta)
	_prev_thrust_held = input.thrust_held

	var speed_boost := SPEED_BUFF_FACTOR if speed_buff else 1.0
	# La poussée s'essouffle quand le nez pointe vers le zénith : un hibou n'est pas
	# une fusée — c'est ce qui rend la chandelle intenable et amène le décrochage.
	var climb_fade := 1.0 - 0.85 * smoothstep(0.35, 0.9, fwd.y)
	var thrust := throttle * THRUST_ACCEL * speed_boost * climb_fade

	# ── 5. Vitesse air & incidence (angle d'attaque) ──
	var v := velocity.length()
	var v_up := velocity.dot(up)
	var v_fwd := velocity.dot(fwd)
	var v_right := velocity.dot(right)
	# Angle entre la trajectoire et l'axe du nez, dans le plan de tangage.
	# > 0 = le hibou « cabre » (nez au-dessus du flux) → génère de la portance.
	var aoa := atan2(-v_up, absf(v_fwd) + 1e-3) if v > 0.6 else 0.0

	# ── 6. Coefficient de portance : linéaire avec l'incidence, puis effondrement ──
	var abs_aoa := absf(aoa)
	var stalling := abs_aoa > STALL_AOA
	var cl := 0.0
	if not stalling:
		cl = CL_MAX * (aoa / STALL_AOA)  # régime linéaire
	else:
		var over := minf(1.0, (abs_aoa - STALL_AOA) / STALL_AOA)
		cl = signf(aoa) * CL_MAX * (1.0 - 0.75 * over)  # aile décrochée : la portance chute

	# ── 6bis. Décrochage « en cloche » ──
	# Montée trop raide + vitesse évanouie → l'aile lâche : abattée automatique,
	# buffeting, gouvernes molles le temps de reprendre de la vitesse en piqué.
	# On ne peut donc PLUS monter à la verticale en continu.
	var climb_stall := fwd.y > 0.45 and v < STALL_SPEED
	if not stall_mode and (stalling or climb_stall):
		stall_mode = true
		stall_timer = STALL_HOLD
	if stall_mode:
		stall_timer -= delta
		ang_rate.x = lerpf(ang_rate.x, -1.5, 1.0 - exp(-3.5 * delta))  # abattée : le nez plonge
		ang_rate.z += rng.range_f(-1.0, 1.0) * 2.4 * delta             # tremblement de buffeting
		requested_screen_shake = maxf(requested_screen_shake, 2.5)
		if stall_timer <= 0.0 and v > STALL_RECOVER and fwd.y < 0.25 and abs_aoa < STALL_AOA * 0.8:
			stall_mode = false

	# ── 7. Bilan des forces, en newtons (a = ΣF / m) ──
	var acc := Vector3(0, -OWL_MASS * GRAVITY, 0)  # poids P = m·g
	acc += fwd * (thrust * OWL_MASS)               # poussée le long du nez

	# Effet de sol : au ras du terrain (moins d'une envergure et demie), le coussin
	# d'air comprimé sous l'aile augmente la portance et réduit la traînée induite —
	# le rase-mottes « porte » réellement, comme pour un vrai rapace.
	var alt_agl: float = position.y - float(ground_height.call(position.x, position.z))
	var ground_effect := clampf(1.0 - alt_agl / 6.0, 0.0, 1.0)

	# Portance : dynamique (aile, ∝ v²·CL) + battement (basse vitesse, ∝ poussée).
	# Le battement ne porte plus nez au zénith : plus d'ascenseur vertical gratuit.
	var dyn_lift := AIR_LIFT * v * v * cl * (1.0 + 0.3 * ground_effect)
	var flap_lift := FLAP_LIFT * (0.35 + 0.65 * throttle) * maxf(0.0, 1.0 - v / FLAP_FADE) \
		* (1.0 - smoothstep(0.35, 0.8, fwd.y))
	# Portance amputée si les ailes sont touchées (multijoueur).
	var wing_lift_mult := 1.0 - (govern_eff.left_wing + govern_eff.right_wing) / 2.0
	acc += up * ((dyn_lift + flap_lift) * wing_lift_mult * OWL_MASS)

	# Traînée : parasite (∝ v²) + induite (∝ CL²), opposée à la vitesse. L'aérofrein
	# déploie de la traînée supplémentaire pour décélérer en douceur.
	if v > 1e-3:
		var drag := AIR_DRAG * ((1.0 + BRAKE_DRAG) if input.brake_held else 1.0) * v * v \
			+ INDUCED_DRAG * cl * cl * v * (1.0 - 0.35 * ground_effect)
		acc += velocity * (-drag / v * OWL_MASS)

	# Anti-dérapage : on gomme la glisse latérale → sensation « je vole », pas « je glisse ».
	acc += right * (-v_right * SIDE_GRIP * OWL_MASS)

	# ── 8. Vent de tempête : bourrasques latérales + rabattant qui plaque au sol ──
	if storm.active:
		var w := storm.wind_force * WIND_ACCEL * OWL_MASS
		acc.x += cos(storm.wind_angle) * w
		acc.z += sin(storm.wind_angle) * w
		# Toujours vers le bas, pulsé par les rafales.
		acc.y -= w * (0.55 + 0.35 * sin(storm.gust_phase * 0.5))
		# Turbulence chaotique : secousses qui dévient RÉELLEMENT la trajectoire.
		acc.x += rng.range_f(-1.0, 1.0) * w * 0.5
		acc.y += rng.range_f(-1.0, 1.0) * w * 0.35
		acc.z += rng.range_f(-1.0, 1.0) * w * 0.5

	acc /= OWL_MASS  # c'est ici que la masse intervient réellement

	# ── 9. Intégration semi-implicite : vitesse, puis position ──
	velocity += acc * delta
	# Dérive latérale : une gouverne endommagée tire le hibou vers le côté touché
	# (translation, distincte du couple de roulis déjà traité par `roll_mult`).
	var drift_severity := maxf(maxf(govern_eff.left_wing, govern_eff.right_wing), govern_eff.tail)
	last_drift_severity = drift_severity
	if drift_severity > 0.0:
		var drift_sign := -1.0 if govern_eff.left_wing > govern_eff.right_wing else 1.0
		velocity += right * (drift_sign * DRIFT_ACCEL * drift_severity * delta)
	var vmax := MAX_SPEED * speed_boost * 1.2
	if velocity.length_squared() > vmax * vmax:
		velocity = velocity.normalized() * vmax
	position += velocity * delta
	speed = velocity.length()

	# Virage coordonné : une aile inclinée courbe la trajectoire au taux réel
	# ω = g·tan(inclinaison)/v. On fait pivoter ENSEMBLE la composante horizontale
	# de la vitesse et le nez (autour de la verticale monde) → virage sans dérapage,
	# franc et lisible. Le plafond sur tan() est à 83° (et non 71,6°) pour qu'un
	# virage « sur la tranche » reste de plus en plus serré à mesure qu'on incline.
	#
	# Ce modèle n'a de sens qu'en vol à peu près horizontal : dès que le nez pointe
	# vers la verticale (chandelle, décrochage), l'inclinaison lue depuis
	# l'orientation devient dégénérée (gimbal lock) et se met à osciller. On atténue
	# donc la correction à mesure que le nez approche de la verticale.
	var levelness := 1.0 - clampf(absf(fwd.y) / 0.85, 0.0, 1.0)
	if speed > 3.0 and levelness > 0.0:
		var turn_rate := GRAVITY * tan(clampf(cur_bank, -1.45, 1.45)) / speed
		var a := turn_rate * delta * levelness
		var ca := cos(a)
		var sa := sin(a)
		var vx := velocity.x
		var vz := velocity.z
		velocity.x = vx * ca + vz * sa
		velocity.z = -vx * sa + vz * ca
		# Rotation autour d'un axe MONDE : pré-multiplication du quaternion
		# (`rotateOnWorldAxis` en Three.js), et non post- comme à l'étape 2.
		orientation = Quaternion(Vector3.UP, a) * orientation

	# ── 10. Bordure ellipsoïde : résistance progressive, pas de téléportation ──
	# On freine la composante « sortante » de la vitesse de plus en plus fort à
	# l'approche du bord, comme un vent de face croissant, au lieu de clamper
	# brutalement la position — ce qui donnait l'impression que la caméra se
	# recentrait toute seule d'un coup en approchant de la limite.
	var offset := position - ARENA_CENTER
	var f := ellipsoid_factor(position)
	var push_start := 1.0 - BOUNDARY_FADE_DIST / ARENA_RADIUS_XZ
	if f > push_start:
		var dir := offset.normalized()
		var v_out := velocity.dot(dir)
		if v_out > 0.0:
			var strength := clampf((f - push_start) / (1.0 - push_start), 0.0, 1.0)
			velocity += dir * (-v_out * strength * minf(1.0, 6.0 * delta))
		if f > 1.0:
			position = ARENA_CENTER + offset * (1.0 / f)  # garde-fou dur, en dernier recours

	var ground_y := float(ground_height.call(position.x, position.z)) + ground_clear
	if position.y < ground_y:
		position.y = ground_y
		ground_crash = true

	# ── 11. État de vol pour les instruments du HUD ──
	readout.aoa = aoa
	readout.stall = stalling or stall_mode
	readout.climb = velocity.y
	readout.throttle = throttle

	return clampf(speed / MAX_SPEED, 0.0, 1.0)


## Facteur radial normalisé dans l'ellipsoïde de jeu : 0 au centre, 1 sur la
## bordure, > 1 en dehors.
static func ellipsoid_factor(pos: Vector3) -> float:
	var dx := (pos.x - ARENA_CENTER.x) / ARENA_RADIUS_XZ
	var dy := (pos.y - ARENA_CENTER.y) / ARENA_RADIUS_Y
	var dz := (pos.z - ARENA_CENTER.z) / ARENA_RADIUS_XZ
	return sqrt(dx * dx + dy * dy + dz * dz)
