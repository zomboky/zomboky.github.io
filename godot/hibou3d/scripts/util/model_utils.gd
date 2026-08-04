class_name ModelUtils
extends RefCounted
## Portage de `normalizeModel()` (docs/hibou-3d.html) — PLAN_GODOT.md §5.2.
##
## Le jeu Three.js n'utilise jamais un .glb tel quel : il l'enveloppe dans trois
## groupes imbriqués (wrapper / spin / inner) qui le recentrent, le posent au sol
## et le mettent à l'échelle d'une dimension cible. Les modèles téléchargés ayant
## des échelles et des orientations arbitraires, c'est ce qui rend le monde cohérent.
##
## On garde la même hiérarchie à trois niveaux plutôt que d'aplatir en une seule
## transform : le `wrapper` doit rester neutre pour que l'appelant puisse lui
## appliquer sa propre rotation (assiette de vol du hibou, orientation d'un arbre)
## sans écraser la normalisation.


## Boîte englobante d'un sous-arbre, exprimée dans l'espace local de `root`.
##
## Équivalent de `new THREE.Box3().setFromObject(root)`. Godot n'a pas d'API
## d'agrégat : on parcourt les `VisualInstance3D` et on compose leur AABB avec
## leur transform relative à `root`.
static func aggregate_aabb(root: Node3D) -> AABB:
	var result := AABB()
	var found := false
	for node in _visual_instances(root):
		var local := root.global_transform.affine_inverse() * node.global_transform
		var box := local * node.get_aabb()
		if found:
			result = result.merge(box)
		else:
			result = box
			found = true
	return result


static func _visual_instances(root: Node) -> Array[VisualInstance3D]:
	var out: Array[VisualInstance3D] = []
	if root is VisualInstance3D:
		out.append(root)
	for child in root.get_children():
		out.append_array(_visual_instances(child))
	return out


## Applique la normalisation à une hiérarchie `wrapper → spin → inner → modèle`
## déjà construite en scène.
##
## [param target_size] : dimension visée, sur l'axe donné par [param axis]
##   (0 = largeur/envergure X, 1 = hauteur Y, 2 = longueur Z).
## [param ground_align] : si vrai, le bas du modèle est posé sur y = 0 ;
##   sinon le modèle est centré sur son barycentre géométrique.
##
## Reproduit exactement le calcul du JS :
##   inner.scale    = target / size[axis]
##   inner.position = (-center.x·s, ground_align ? -min.y·s : -center.y·s, -center.z·s)
static func normalize(inner: Node3D, model: Node3D, axis: int, target_size: float,
		ground_align: bool = true) -> void:
	var box := aggregate_aabb(model)
	var size := box.size
	var extent: float = [size.x, size.y, size.z][axis]
	var scale := target_size / (extent if extent > 0.0 else 1.0)
	var center := box.get_center()

	inner.scale = Vector3.ONE * scale
	inner.position = Vector3(
		-center.x * scale,
		(-box.position.y if ground_align else -center.y) * scale,
		-center.z * scale,
	)
