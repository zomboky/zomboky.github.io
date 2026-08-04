extends SceneTree
## Génère la section [input] de project.godot (PLAN_GODOT.md §6.4).
##
## Lancer : godot --headless --path godot/hibou3d --script res://tools/gen_input_map.gd
##
## Pourquoi un script plutôt que l'édition à la main : la sérialisation des
## InputEvent dans project.godot est verbeuse et fragile ; on la laisse produire
## par le moteur lui-même.
##
## Choix : on utilise le SCANCODE PHYSIQUE, pas le caractère. Le jeu Three.js est
## codé en dur en AZERTY (`keys['z']`, `keys['q']`, `keys['a']`) ; en physique,
## ces touches sont W / A / Q. Un joueur QWERTY retrouve donc naturellement
## WASD + QE là où il devait taper ZQSD + AE — c'est le correctif annoncé au §6.4,
## sans changer une seule position de doigt pour un joueur AZERTY.

const ACTIONS := {
	# Vol — trois axes en commande de VITESSE angulaire (aucun ne recentre seul).
	"flight_pitch_up":    { "keys": [KEY_W], "special": [KEY_UP] },
	"flight_pitch_down":  { "keys": [KEY_S], "special": [KEY_DOWN] },
	"flight_yaw_left":    { "keys": [KEY_A], "special": [KEY_LEFT] },
	"flight_yaw_right":   { "keys": [KEY_D], "special": [KEY_RIGHT] },
	"flight_roll_left":   { "keys": [KEY_Q], "special": [] },
	"flight_roll_right":  { "keys": [KEY_E], "special": [] },
	# Moteur
	"thrust":             { "keys": [], "special": [KEY_SPACE] },
	"brake":              { "keys": [], "special": [KEY_SHIFT] },
	# Combat / caméra / système
	"fire":               { "keys": [], "special": [], "mouse": [MOUSE_BUTTON_LEFT] },
	"look_back":          { "keys": [], "special": [], "mouse": [MOUSE_BUTTON_RIGHT] },
	"pause":              { "keys": [], "special": [KEY_ESCAPE] },
	"use_slot_1":         { "keys": [], "special": [KEY_1] },
	"use_slot_2":         { "keys": [], "special": [KEY_2] },
	"use_slot_3":         { "keys": [], "special": [KEY_3] },
	# Raccourcis de debug (lot 8 : lunes / tempête)
	"debug_full_moon":    { "keys": [KEY_L], "special": [] },
	"debug_blood_moon":   { "keys": [KEY_K], "special": [] },
	"debug_storm":        { "keys": [KEY_T], "special": [] },
	"dev_esp":            { "keys": [], "special": [KEY_F3] },
}


func _init() -> void:
	for action_name in ACTIONS:
		var spec: Dictionary = ACTIONS[action_name]
		var events: Array[InputEvent] = []

		# Touches de caractère : repérées par leur POSITION physique.
		for keycode in spec.get("keys", []):
			var ev := InputEventKey.new()
			ev.physical_keycode = keycode
			events.append(ev)

		# Touches non alphabétiques (flèches, espace, modificateurs) : le keycode
		# logique est déjà indépendant de la disposition.
		for keycode in spec.get("special", []):
			var ev := InputEventKey.new()
			ev.keycode = keycode
			events.append(ev)

		for button in spec.get("mouse", []):
			var ev := InputEventMouseButton.new()
			ev.button_index = button
			events.append(ev)

		ProjectSettings.set_setting("input/" + action_name, {
			"deadzone": 0.2,
			"events": events,
		})

	var err := ProjectSettings.save()
	if err != OK:
		push_error("Échec de l'écriture de project.godot : %d" % err)
	else:
		print("InputMap écrit : %d actions." % ACTIONS.size())
	quit(0 if err == OK else 1)
