/**
 * AstroMoon — Layer & GeoJSON State Store (Svelte 5 Runes)
 * Replaces window.cratersDB + LOD state from app.js.
 */

let _lodEnabled = $state(false);
let _currentLOD = $state(2);
let _loadedLayerNames = $state([]);
let _layerCount = $state(0);
let _layerTransformDirty = $state(true);
let _dirtyEphemeris = $state(true);
let _dirtyGrid = $state(false);
let _anchorRevision = $state(0);

export const layerState = {
  /** All raw features from loaded GeoJSON layers (NOT reactive to avoid proxy overhead) */
  allRawFeatures: [],
  /** Projected features (with renderedCoords)  (NOT reactive) */
  projectedFeatures: null,
  /** Crater database (loaded from JSON)  (NOT reactive) */
  cratersDB: null,

  get lodEnabled() { return _lodEnabled; },
  set lodEnabled(v) { _lodEnabled = v; },

  get currentLOD() { return _currentLOD; },
  set currentLOD(v) { _currentLOD = v; },

  get loadedLayerNames() { return _loadedLayerNames; },
  set loadedLayerNames(v) { _loadedLayerNames = v; },

  get layerCount() { return _layerCount; },
  set layerCount(v) { _layerCount = v; },

  get layerTransformDirty() { return _layerTransformDirty; },
  set layerTransformDirty(v) { _layerTransformDirty = v; },

  get dirtyEphemeris() { return _dirtyEphemeris; },
  set dirtyEphemeris(v) { _dirtyEphemeris = v; },

  get dirtyGrid() { return _dirtyGrid; },
  set dirtyGrid(v) { _dirtyGrid = v; },

  get anchorRevision() { return _anchorRevision; },
  set anchorRevision(v) { _anchorRevision = v; }
};
