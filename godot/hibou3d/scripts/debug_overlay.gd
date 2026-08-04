extends Label
## Compteur de FPS + informations de build.
##
## Sert de témoin de recette pour le lot 0 (PLAN_GODOT.md §9) : il prouve que le
## rendu tourne bien en Compatibility et donne le framerate mesuré dans le navigateur.

var _accum := 0.0

func _process(delta: float) -> void:
	_accum += delta
	if _accum < 0.25:
		return
	_accum = 0.0
	var lines := [
		"%d FPS" % Engine.get_frames_per_second(),
		"%s | %s" % [
			RenderingServer.get_video_adapter_api_version(),
			ProjectSettings.get_setting("rendering/renderer/rendering_method"),
		],
		"Godot %s" % Engine.get_version_info().string,
	]
	text = "\n".join(lines)
