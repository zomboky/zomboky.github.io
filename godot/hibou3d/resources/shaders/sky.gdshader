shader_type sky;
// Port de `updateSkyGradient()` + `makeSky()` (docs/hibou-3d.html) : dégradé nuit↔jour et
// étoiles, tous deux pilotés par `day_factor` (voir scripts/world/sky.gd::_process, qui
// reproduit exactement `updateDayNightCycle()`).
//
// Le jeu d'origine peint le dégradé sur une texture canvas 2D (un simple lerp vertical
// d'écran) et sème 1600 étoiles individuelles en `THREE.Points`, chacune avec sa propre
// phase de scintillement. Un vrai dôme céleste Godot n'a pas d'équivalent direct à « une
// texture plaquée derrière la scène » : on reconstruit le même dégradé par l'élévation du
// rayon de vue (EYEDIR.y), et les étoiles par une grille de cellules hachées sur la sphère
// du ciel plutôt que par une liste de positions — visuellement équivalent, sans maintenir
// 1600 instances. Voir AVANCEMENT.md, Écarts constatés.

uniform float day_factor : hint_range(0.0, 1.0) = 0.0;

const vec3 NIGHT_TOP    = vec3(0.01568, 0.01568, 0.05490); // 0x04040e
const vec3 NIGHT_BOTTOM = vec3(0.04706, 0.06275, 0.18824); // 0x0c1030
const vec3 DAY_TOP      = vec3(0.22745, 0.48235, 0.83529); // 0x3a7bd5
const vec3 DAY_BOTTOM   = vec3(0.74902, 0.89412, 1.0);     // 0xbfe4ff

// Palette des étoiles : blanc / bleu pâle / crème, comme `palette` dans `makeSky()`.
const vec3 STAR_WHITE = vec3(1.0, 1.0, 1.0);
const vec3 STAR_BLUE  = vec3(0.66667, 0.8, 1.0);
const vec3 STAR_CREAM = vec3(1.0, 0.91373, 0.76863);

float hash21(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

void sky() {
	vec3 top = mix(NIGHT_TOP, DAY_TOP, day_factor);
	vec3 bottom = mix(NIGHT_BOTTOM, DAY_BOTTOM, day_factor);
	// Approximation de la position verticale d'écran du canvas d'origine par l'élévation
	// du rayon de vue : les deux vont de « bas d'écran » à « haut d'écran ».
	float t = clamp(EYEDIR.y * 0.5 + 0.5, 0.0, 1.0);
	vec3 col = mix(bottom, top, t);

	// Grille de cellules en coordonnées sphériques : une étoile par cellule, tirée au hasard.
	vec2 uv = vec2(atan(EYEDIR.z, EYEDIR.x), acos(clamp(EYEDIR.y, -1.0, 1.0)));
	vec2 cell = floor(uv * 60.0);
	float presence = hash21(cell);
	float star_mask = step(0.985, presence);
	float phase = hash21(cell + 7.31);
	float pick = hash21(cell + 19.7);
	vec3 star_color = pick < 0.34 ? STAR_WHITE : (pick < 0.67 ? STAR_BLUE : STAR_CREAM);
	// Scintillement individuel : une vitesse et une phase propres à chaque étoile, comme
	// `starPhases[i] = { a, da }` dans le jeu d'origine.
	float twinkle = 0.35 + 0.65 * (0.5 + 0.5 * sin(TIME * (0.4 + phase * 1.2) + phase * 62.0));
	float visible = star_mask * (1.0 - day_factor) * step(0.0, EYEDIR.y);
	col += star_color * twinkle * visible * 0.95;

	COLOR = col;
}
