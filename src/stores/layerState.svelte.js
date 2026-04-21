/**
 * AstroMoon — Layer & GeoJSON State Store (Svelte 5 Runes)
 * Replaces window.cratersDB + LOD state from app.js.
 */

class LayerState {
  // --- Reactive properties ---
  lodEnabled = $state(false);
  currentLOD = $state(2);
  loadedLayerNames = $state([]);
  layerCount = $state(0);
  layerTransformDirty = $state(true);
  dirtyEphemeris = $state(true);
  dirtyGrid = $state(false);
  anchorRevision = $state(0);
  anchorCount = $state(0);

  // --- Non-reactive properties (to avoid proxy overhead in PixiJS) ---
  
  /** All raw features from loaded GeoJSON layers (NOT reactive to avoid proxy overhead) */
  allRawFeatures = [];
  
  /** Projected features (with renderedCoords) (NOT reactive) */
  projectedFeatures = null;
  
  /** Crater database (loaded from JSON) (NOT reactive) */
  cratersDB = null;

  reset() {
    this.lodEnabled = false;
    this.currentLOD = 2;
    this.loadedLayerNames = [];
    this.layerCount = 0;
    this.layerTransformDirty = true;
    this.dirtyEphemeris = true;
    this.dirtyGrid = false;
    this.anchorRevision = 0;
    this.anchorCount = 0;
    
    // Non-reactive properties reset 
    // Usually these are reloaded or re-parsed, but we can clear them here
    this.allRawFeatures = [];
    this.projectedFeatures = null;
    this.cratersDB = null;
  }
}

export const layerState = new LayerState();
