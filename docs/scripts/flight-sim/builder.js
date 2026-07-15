import * as THREE from '../../three/build/three.module.min.js';
import { OrbitControls } from '../../three/examples/jsm/controls/OrbitControls.js';
import { getPartDef, MAX_PARTS } from './parts.js';
import { buildAircraft, freeNodes, removePartAndDescendants, makeUid, validateDesign } from './aircraft.js';

const MARKER_COLOR = 0xffd23f;
const MARKER_HOVER_COLOR = 0x33ff77;

// Hangar KSP-like : on choisit une pièce dans la palette (HTML, voir
// hud.js), puis on clique sur un point d'accroche mis en évidence dans la
// scène 3D pour la poser. La toute première pièce (un fuselage) se pose
// directement, sans point d'accroche puisque rien n'existe encore.
export function createBuilder({ scene, camera, canvas, onChange, onSelectPlaced }) {
  const hangarGroup = new THREE.Group();
  hangarGroup.visible = false;
  scene.add(hangarGroup);
  hangarGroup.add(new THREE.GridHelper(24, 24, 0x8fb4d9, 0x30507a));

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.8, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minDistance = 2.5;
  controls.maxDistance = 22;

  let design = { parts: [] };
  let aircraftGroup = null;
  let selectedDefId = null;
  let selectedPlacedUid = null;
  const markers = [];
  const markerGroup = new THREE.Group();
  hangarGroup.add(markerGroup);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hoveredMarker = null;

  function disposeGroup(group) {
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  }

  function rebuildVisual() {
    if (aircraftGroup) { hangarGroup.remove(aircraftGroup); disposeGroup(aircraftGroup); }
    const built = buildAircraft(design);
    aircraftGroup = built.group;
    hangarGroup.add(aircraftGroup);
    return built;
  }

  function refreshMarkers() {
    markerGroup.clear();
    markers.length = 0;
    hoveredMarker = null;
    if (!selectedDefId || design.parts.length === 0 || design.parts.length >= MAX_PARTS) return;
    const def = getPartDef(selectedDefId);
    const seen = new Set();
    for (const nodeName of def.mountsTo) {
      for (const free of freeNodes(design, nodeName)) {
        const key = `${free.parentUid}:${free.node}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 12, 10),
          new THREE.MeshBasicMaterial({ color: MARKER_COLOR, transparent: true, opacity: 0.85, depthTest: false }),
        );
        mesh.position.copy(free.position);
        mesh.renderOrder = 10;
        markerGroup.add(mesh);
        markers.push({ mesh, parentUid: free.parentUid, node: free.node });
      }
    }
  }

  function afterDesignChange() {
    const built = rebuildVisual();
    refreshMarkers();
    onChange(design, built);
  }

  function selectPart(defId) {
    selectedPlacedUid = null;
    onSelectPlaced(null);
    if (design.parts.length === 0) {
      if (getPartDef(defId).category !== 'fuselage') return;
      design.parts.push({ uid: makeUid(), id: defId, parent: null, node: null });
      selectedDefId = null;
      afterDesignChange();
      return;
    }
    selectedDefId = defId;
    refreshMarkers();
  }

  function clearSelection() {
    selectedDefId = null;
    refreshMarkers();
  }

  function placeAt(marker) {
    design.parts.push({ uid: makeUid(), id: selectedDefId, parent: marker.parentUid, node: marker.node });
    selectedDefId = null;
    afterDesignChange();
  }

  function pointerToNdc(event) {
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function onPointerMove(event) {
    if (!markers.length) return;
    pointerToNdc(event);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(markers.map((m) => m.mesh));
    if (hoveredMarker) hoveredMarker.mesh.material.color.setHex(MARKER_COLOR);
    hoveredMarker = null;
    if (hits.length) {
      hoveredMarker = markers.find((m) => m.mesh === hits[0].object);
      hoveredMarker.mesh.material.color.setHex(MARKER_HOVER_COLOR);
    }
  }

  function onClick(event) {
    if (!hangarGroup.visible) return;
    if (hoveredMarker) { placeAt(hoveredMarker); return; }
    if (selectedDefId || !aircraftGroup) return;
    pointerToNdc(event);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(aircraftGroup.children);
    selectedPlacedUid = hits.length ? hits[0].object.userData.partUid : null;
    onSelectPlaced(selectedPlacedUid);
  }

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('click', onClick);

  function removeSelected() {
    if (!selectedPlacedUid) return;
    removePartAndDescendants(design, selectedPlacedUid);
    selectedPlacedUid = null;
    onSelectPlaced(null);
    afterDesignChange();
  }

  function loadDesign(newDesign) {
    design = { parts: (newDesign.parts || []).map((p) => ({ ...p })) };
    selectedDefId = null;
    selectedPlacedUid = null;
    onSelectPlaced(null);
    afterDesignChange();
  }

  function resetDesign() { loadDesign({ parts: [] }); }

  return {
    show() { hangarGroup.visible = true; controls.enabled = true; },
    hide() { hangarGroup.visible = false; controls.enabled = false; clearSelection(); },
    update() { controls.update(); },
    selectPart,
    clearSelection,
    removeSelected,
    loadDesign,
    resetDesign,
    getDesign: () => design,
    getSelectedPlacedUid: () => selectedPlacedUid,
    hasMarkers: () => markers.length > 0,
    isAtCapacity: () => design.parts.length >= MAX_PARTS,
    validate: () => validateDesign(design),
  };
}
