/**
 * AstroMoon — Render Loop & Scene Rebuild Pipeline
 * Handles LOD updates, culling, and delegating drawing to PixiRenderer.
 */

import { viewportState } from '../stores/viewportState.svelte.js';
import { layerState } from '../stores/layerState.svelte.js';
import { Transform } from './transform.js';
import { GeoJSONLod } from './geojson_lod.js';
import { PixiRenderer } from './pixi_renderer.js';
import { Anchors } from './anchors.js';
import { uiState } from '../stores/uiState.svelte.js';
import { CULLING, PERF } from './config.js';

let frameCount = 0;
let fpsTime = 0;
let lastInteractionTime = 0;
let _lastPanZoomTime = 0;
let _lastViewportTx = 0;
let _lastViewportTy = 0;
let lastViewportScale = 1;
let _lastHoveredAnchorId = null;

export function setLastInteractionTime() {
  lastInteractionTime = Date.now();
}

/** Compute axis-aligned bounding box in normalized [0,1] space for pre-culling. */
export function computeNormBounds(feature) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  if (!feature.projectedCoords) return;
  for (const ring of feature.projectedCoords) {
    if (!ring) continue;
    for (let i = 0; i < ring.length; i += 2) {
      const x = ring[i];
      const y = ring[i + 1];
      if (isNaN(x)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  feature._normBounds = { minX, minY, maxX, maxY };
}

export function updateLayerCache() {
  if (!layerState.projectedFeatures) return;

  // ─── LOD Selection ───
  if (layerState.lodEnabled) {
    const tState = Transform.getState();
    const newLOD = GeoJSONLod.selectLOD(viewportState.scale, tState.scale, tState.layerSize);
    if (newLOD !== layerState.currentLOD) {
      layerState.currentLOD = newLOD;
    }
  }

  // ─── Pre-culling setup (viewport bounds in world space) ───
  const app = PixiRenderer.getApp();
  const screenW = app ? app.screen.width : viewportState.canvasW;
  const screenH = app ? app.screen.height : viewportState.canvasH;
  const invScale = 1 / viewportState.scale;
  const margin = CULLING.viewportMargin;
  const vpMinX = (-viewportState.tx - screenW * margin) * invScale;
  const vpMaxX = (screenW - viewportState.tx + screenW * margin) * invScale;
  const vpMinY = (-viewportState.ty - screenH * margin) * invScale;
  const vpMaxY = (screenH - viewportState.ty + screenH * margin) * invScale;

  for (const feature of layerState.projectedFeatures) {
    // Select source coords (LOD-aware)
    let sourceCoords;
    if (layerState.lodEnabled && feature.projectedLodCoords && feature.projectedLodCoords[layerState.currentLOD]) {
      sourceCoords = feature.projectedLodCoords[layerState.currentLOD];
    } else {
      sourceCoords = feature.projectedCoords;
    }

    if (!feature.renderedCoords || feature.renderedCoords.length !== sourceCoords.length) {
      feature.renderedCoords = new Array(sourceCoords.length);
    }

    if (!feature.worldBounds) {
      feature.worldBounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    } else {
      feature.worldBounds.minX = Infinity;
      feature.worldBounds.minY = Infinity;
      feature.worldBounds.maxX = -Infinity;
      feature.worldBounds.maxY = -Infinity;
    }

    // ─── Pre-culling: estimate bounds via affine transform only (skip TPS) ───
    if (feature._normBounds) {
      const nb = feature._normBounds;
      const c0 = Transform.apply(nb.minX, nb.minY, { x: 0, y: 0 });
      const c1 = Transform.apply(nb.maxX, nb.minY, { x: 0, y: 0 });
      const c2 = Transform.apply(nb.minX, nb.maxY, { x: 0, y: 0 });
      const c3 = Transform.apply(nb.maxX, nb.maxY, { x: 0, y: 0 });
      const estMinX = Math.min(c0.x, c1.x, c2.x, c3.x);
      const estMaxX = Math.max(c0.x, c1.x, c2.x, c3.x);
      const estMinY = Math.min(c0.y, c1.y, c2.y, c3.y);
      const estMaxY = Math.max(c0.y, c1.y, c2.y, c3.y);

      if (estMaxX < vpMinX || estMinX > vpMaxX || estMaxY < vpMinY || estMinY > vpMaxY) {
        for (let r = 0; r < sourceCoords.length; r++) {
          feature.renderedCoords[r] = feature.renderedCoords[r] || new Float32Array(0);
          if (feature.renderedCoords[r].length > 0) {
            feature.renderedCoords[r] = new Float32Array(0);
          }
        }
        continue;
      }
    }

    for (let r = 0; r < sourceCoords.length; r++) {
      const ring = sourceCoords[r];
      if (!ring) continue;

      if (!feature.renderedCoords[r] || feature.renderedCoords[r].length !== ring.length) {
        feature.renderedCoords[r] = new Float32Array(ring.length);
      }
      const cachedRing = feature.renderedCoords[r];

      cachedRing.set(ring);
      Anchors.applyBuffer(cachedRing);

      const bounds = feature.worldBounds;
      for (let i = 0; i < cachedRing.length; i += 2) {
        const x = cachedRing[i];
        const y = cachedRing[i + 1];
        if (isNaN(x)) continue;
        if (x < bounds.minX) bounds.minX = x;
        if (x > bounds.maxX) bounds.maxX = x;
        if (y < bounds.minY) bounds.minY = y;
        if (y > bounds.maxY) bounds.maxY = y;
      }
    }
  }
  layerState.layerTransformDirty = false;
}

export function rebuildScene(forceAll = false, hadTransformChange = false, lodChanged = false) {
  const transformFn = Anchors.getTransformFunction();
  const rebuildEphemeris = forceAll || layerState.dirtyEphemeris;
  const rebuildTransform = forceAll || hadTransformChange;

  if (layerState.projectedFeatures) {
    PixiRenderer.rebuildGeoJSON(layerState.projectedFeatures, viewportState);
  }

  if (rebuildEphemeris || rebuildTransform) {
    PixiRenderer.rebuildNightMask(transformFn);
    PixiRenderer.rebuildTerminator(transformFn, viewportState);
  }

  if (layerState.dirtyGrid || rebuildTransform || lodChanged) {
    PixiRenderer.rebuildGrid(transformFn, viewportState, layerState.currentLOD);
    layerState.dirtyGrid = false;
  }

  PixiRenderer.rebuildAnchors(Anchors.getAll(), viewportState, uiState.hoveredAnchorId);
  PixiRenderer.rebuildPivotAnchor(viewportState);

  if (layerState.cratersDB) {
    PixiRenderer.rebuildAnnotations(transformFn, layerState.cratersDB, viewportState, viewportState.canvasW, viewportState.canvasH);
  }

  layerState.dirtyEphemeris = false;
}

export function renderTick(ticker) {
  frameCount++;
  const now = performance.now();
  if (now - fpsTime >= 1000) {
    viewportState.fps = frameCount;
    frameCount = 0;
    fpsTime = now;
  }

  const timeSinceLastInteraction = Date.now() - lastInteractionTime;
  const viewportZoomChanged = Math.abs(viewportState.scale - lastViewportScale) > 0.001;
  const viewportPanChanged = Math.abs(viewportState.tx - _lastViewportTx) > 1 || Math.abs(viewportState.ty - _lastViewportTy) > 1;

  if (viewportZoomChanged || viewportPanChanged) {
    _lastPanZoomTime = Date.now();
  }
  const timeSincePanZoom = Date.now() - _lastPanZoomTime;

  let lodChanged = false;
  if (layerState.lodEnabled && layerState.projectedFeatures) {
    const tState = Transform.getState();
    const newLOD = GeoJSONLod.selectLOD(viewportState.scale, tState.scale, tState.layerSize);
    if (newLOD !== layerState.currentLOD) {
      lodChanged = true;
      layerState.layerTransformDirty = true;
      layerState.currentLOD = newLOD;
    }
  }

  PixiRenderer.updateViewport(viewportState);

  const isInteracting = viewportState.isDragging || timeSincePanZoom < PERF.interactionFadeMs;

  if (PixiRenderer.showLabels && PixiRenderer.showLabels()) {
    PixiRenderer.updateAnnotationsTransform(viewportState, isInteracting, viewportState.mouseX, viewportState.mouseY);
  }

  if ((layerState.layerTransformDirty || viewportZoomChanged || viewportPanChanged) && layerState.projectedFeatures) {
    if (timeSinceLastInteraction > PERF.rebuildDebounceMs || layerState.layerTransformDirty) {
      const hadTransformChange = layerState.layerTransformDirty;
      if (layerState.layerTransformDirty) updateLayerCache();
      rebuildScene(false, hadTransformChange, lodChanged);
      lastViewportScale = viewportState.scale;
      _lastViewportTx = viewportState.tx;
      _lastViewportTy = viewportState.ty;
    }
  }

  // Fast-path: Only rebuild anchors if the hovered ID changed (no need for full scene rebuild)
  if (uiState.hoveredAnchorId !== _lastHoveredAnchorId) {
    _lastHoveredAnchorId = uiState.hoveredAnchorId;
    PixiRenderer.rebuildAnchors(Anchors.getAll(), viewportState, uiState.hoveredAnchorId);
  }
}
