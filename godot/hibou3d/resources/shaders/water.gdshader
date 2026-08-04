shader_type spatial;
// Surface des lacs et des rivières.
//
// Remplace `updateWater()` (docs/hibou-3d.html), qui recalculait des milliers de
// sommets **sur le CPU à chaque frame**, puis rappelait `computeVertexNormals()`.
// C'est l'exemple type de traduction conceptuelle CPU → GPU annoncée au
// PLAN_GODOT.md §6.3 : l'ondulation devient trois lignes dans `vertex()`, et le
// coût par frame côté CPU tombe à zéro — un gain net et mesurable en WebAssembly.
//
// Contraintes du rendu Compatibility (§6.3) : ni compute shader, ni
// `SCREEN_TEXTURE` gratuit, pas de branche lourde en `fragment()`. Ce shader
// n'utilise rien de tout cela.

render_mode blend_mix, depth_draw_opaque, cull_back, diffuse_burley, specular_schlick_ggx;

uniform vec3 water_color : source_color = vec3(0.086, 0.188, 0.353);
uniform float water_alpha : hint_range(0.0, 1.0) = 0.92;
uniform float water_roughness : hint_range(0.0, 1.0) = 0.15;
uniform float water_metallic : hint_range(0.0, 1.0) = 0.25;

// Amplitude et fréquences reprises telles quelles de `updateWater()`.
uniform float ripple_amplitude = 0.18;
uniform float ripple_freq_x = 0.06;
uniform float ripple_freq_z = 0.05;
uniform float ripple_speed_x = 0.6;
uniform float ripple_speed_z = 0.45;

// Hauteur de la surface au-dessus du plan, en coordonnées locales du maillage.
float ripple(vec2 p, float t) {
	return sin(p.x * ripple_freq_x + t * ripple_speed_x) * ripple_amplitude
		 + cos(p.y * ripple_freq_z + t * ripple_speed_z) * ripple_amplitude;
}

void vertex() {
	VERTEX.y += ripple(VERTEX.xz, TIME);

	// Normale analytique : la dérivée de l'ondulation est connue en forme fermée,
	// donc inutile de reconstruire les normales par différences finies comme le
	// faisait `computeVertexNormals()` côté CPU.
	float dx = cos(VERTEX.x * ripple_freq_x + TIME * ripple_speed_x)
		* ripple_amplitude * ripple_freq_x;
	float dz = -sin(VERTEX.z * ripple_freq_z + TIME * ripple_speed_z)
		* ripple_amplitude * ripple_freq_z;
	NORMAL = normalize(vec3(-dx, 1.0, -dz));
}

void fragment() {
	ALBEDO = water_color;
	ALPHA = water_alpha;
	ROUGHNESS = water_roughness;
	METALLIC = water_metallic;
}
