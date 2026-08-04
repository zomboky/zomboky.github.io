class_name MultiMeshBuilder
extends RefCounted
## Instanciation en masse — port de `makeInstancedFromModel()` (docs/hibou-3d.html).
##
## Le décor du jeu, ce sont 3 000 arbres, 64 nuages, 22 massifs et une trentaine de
## chalets. Les poser en nœuds individuels coûterait autant d'appels de rendu ;
## `MultiMeshInstance3D` les envoie en un seul par surface (PLAN_GODOT.md §6.5).
##
## Un modèle importé est rarement un seul maillage : c'est une hiérarchie de
## `MeshInstance3D` avec leurs transforms locales et leurs matériaux. On produit
## donc **un `MultiMeshInstance3D` par (maillage source × surface)**, en composant
## la transform d'instance avec celle de la pièce dans le modèle — exactement ce
## que fait `makeInstancedFromModel` avec `matrixWorld`.

## Un maillage du modèle source, avec sa place dans la hiérarchie.
class Part extends RefCounted:
	var mesh: Mesh
	var local: Transform3D
	var materials: Array[Material] = []


## Relève les maillages d'un modèle et leur transform relative à [param root].
##
## Le modèle doit être dans l'arbre : les transforms globales sont lues, ce qui
## capture au passage la normalisation (échelle, recentrage, lacet) appliquée par
## `ModelUtils.normalize()`.
static func collect_parts(root: Node3D) -> Array[Part]:
	var parts: Array[Part] = []
	var inverse := root.global_transform.affine_inverse()
	for node in _mesh_instances(root):
		var part := Part.new()
		part.mesh = node.mesh
		part.local = inverse * node.global_transform
		for surface in node.mesh.get_surface_count():
			part.materials.append(node.get_active_material(surface))
		parts.append(part)
	return parts


## Construit les `MultiMeshInstance3D` sous [param parent].
##
## [param transforms] est la liste des instances, dans l'espace de [param parent].
## [param material_override] remplace le matériau du modèle quand il est fourni —
## c'est ainsi que les nuages obtiennent leurs paliers d'opacité, un `MultiMesh`
## ne pouvant pas faire varier la transparence instance par instance.
## Retourne les nœuds créés. Chacun porte en métadonnée `part_local` la transform
## de sa pièce dans le modèle : c'est ce qu'il faut pour reposer les instances par
## la suite (dérive des nuages), sans réassocier nœuds et pièces à la main.
static func build(parent: Node3D, parts: Array[Part], transforms: Array[Transform3D],
		material_override: Material = null, cast_shadow := true) -> Array[MultiMeshInstance3D]:
	var created: Array[MultiMeshInstance3D] = []
	if transforms.is_empty():
		return created
	for part in parts:
		for surface in part.mesh.get_surface_count():
			var multi_mesh := MultiMesh.new()
			multi_mesh.transform_format = MultiMesh.TRANSFORM_3D
			# Une surface par MultiMesh : le format n'accepte qu'un maillage, et
			# un maillage multi-surfaces réutiliserait le mauvais matériau.
			multi_mesh.mesh = _single_surface(part.mesh, surface)
			multi_mesh.instance_count = transforms.size()
			for i in transforms.size():
				multi_mesh.set_instance_transform(i, transforms[i] * part.local)

			var instance := MultiMeshInstance3D.new()
			instance.multimesh = multi_mesh
			instance.material_override = material_override if material_override != null \
				else part.materials[surface]
			instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if cast_shadow \
				else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			instance.set_meta("part_local", part.local)
			parent.add_child(instance)
			created.append(instance)
	return created


## Extrait une surface dans son propre `ArrayMesh`.
static func _single_surface(source: Mesh, surface: int) -> Mesh:
	if source.get_surface_count() == 1:
		return source
	var extracted := ArrayMesh.new()
	extracted.add_surface_from_arrays(
		source.surface_get_primitive_type(surface), source.surface_get_arrays(surface))
	return extracted


static func _mesh_instances(root: Node) -> Array[MeshInstance3D]:
	var out: Array[MeshInstance3D] = []
	if root is MeshInstance3D and (root as MeshInstance3D).mesh != null:
		out.append(root)
	for child in root.get_children():
		out.append_array(_mesh_instances(child))
	return out
