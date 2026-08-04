class_name FlightInput
extends RefCounted
## Commandes de vol, découplées de leur source.
##
## Portage de l'étape 1 de `updateFlight()` (PLAN_GODOT.md §5.3). Le jeu Three.js
## lit directement `keys['z']` au milieu du modèle de vol ; on isole la lecture ici
## parce que trois pilotes différents produisent les mêmes commandes :
##   - le joueur (clavier + souris, via l'InputMap du §6.4) ;
##   - le bot de campagne (lot 10b : `updateBotFlight` a le même squelette que
##     `updateFlight`, mais lit un `input` calculé par l'IA) ;
##   - un harnais de test rejouant une séquence scriptée (recette du lot 2, §9.2).
##
## Les trois axes sont des commandes en VITESSE angulaire, dans [-1, 1]. Aucun ne
## revient au neutre tout seul quand on relâche : comme sur un vrai avion, il faut
## contre-braquer pour revenir à plat.

## Tangage : +1 = piquer (touche S / flèche bas), -1 = cabrer.
var pitch := 0.0
## Lacet : +1 = vers la gauche (touche A physique, Q en AZERTY), -1 = vers la droite.
var yaw := 0.0
## Roulis : +1 = vers la gauche (touche Q physique, A en AZERTY), -1 = vers la droite.
var roll := 0.0
## Poussée maintenue (Espace).
var thrust_held := false
## Aérofrein maintenu (Maj).
var brake_held := false
## Pilotage fin à la souris, en radians, déjà mis à l'échelle et écrêté.
var mouse_dx := 0.0
var mouse_dy := 0.0

## Sensibilité de base de la souris, reprise telle quelle du jeu Three.js.
const MOUSE_SENS_BASE := 0.0016
## Écrêtage du pilotage souris : borne le débattement appliqué en une seule frame,
## sinon un mouvement brusque fait faire un tonneau instantané au hibou.
const MOUSE_MAX_DELTA := 0.05


## Lit les commandes du joueur depuis l'InputMap.
##
## [param mouse_motion] est le cumul des `InputEventMouseMotion` depuis le dernier
## appel : Godot délivre la souris par évènements, alors que le modèle de vol la
## consomme une fois par pas de physique.
static func from_player(mouse_motion: Vector2, mouse_sensitivity: float) -> FlightInput:
	var input := FlightInput.new()
	input.pitch = Input.get_axis("flight_pitch_up", "flight_pitch_down")
	input.yaw = Input.get_axis("flight_yaw_right", "flight_yaw_left")
	input.roll = Input.get_axis("flight_roll_right", "flight_roll_left")
	input.thrust_held = Input.is_action_pressed("thrust")
	input.brake_held = Input.is_action_pressed("brake")

	# Le réglage joueur est centré sur 0.5 dans le jeu JS : `MOUSE_SENS_BASE * (sens / 0.5)`.
	var sens := MOUSE_SENS_BASE * (mouse_sensitivity / 0.5)
	input.mouse_dx = clampf(-mouse_motion.x * sens, -MOUSE_MAX_DELTA, MOUSE_MAX_DELTA)
	# Tangage inversé : souris vers le bas = cabrer, comme un manche.
	input.mouse_dy = clampf(-mouse_motion.y * sens, -MOUSE_MAX_DELTA, MOUSE_MAX_DELTA)
	return input
