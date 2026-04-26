/**
 * AstroMoon â€” PixiJS v8 Renderer
 * Replaces the Canvas 2D renderer with a GPU-accelerated PixiJS scene graph.
 * 
 * Architecture: 
 *   stage
 *     â””â”€â”€ viewportContainer  (handles pan/zoom via position & scale)
 *           â”œâ”€â”€ bgSprite      (background moon photo)
 *           â”œâ”€â”€ geojsonContainer  (one Graphics per layer)
 *           â”œâ”€â”€ nightMaskContainer  (night-side overlay)
 *           â”œâ”€â”€ dayMaskContainer    (day-side overlay)
 *           â”œâ”€â”€ terminatorGfx
 *           â”œâ”€â”€ gridGfx
 *           â”œâ”€â”€ anchorsGfx
 *           â””â”€â”€ annotationsContainer (Text + Graphics dots)
 */

import * as PIXI from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import { GeoJSON } from './geojson.js';
import { Transform } from './transform.js';
import { Anchors } from './anchors.js';
import { GRID, LABELS, CULLING, RENDER, EMERGENCY, LAYER_PALETTE, configEvents } from './config.js';
import { moonState } from '../stores/moonState.svelte.js';
import { uiState } from '../stores/uiState.svelte.js';
import { studioState } from '../stores/studioState.svelte.js';
import { layerState } from '../stores/layerState.svelte.js';

// Cache for reactive redraws
let _lastProjectedFeatures = null;
let _lastVp = null;
let _lastTransformFn = null;
let _lastLodLevel = 0;

// Scene graph references
let app = null;
let viewportContainer, geojsonContainer, annotationsContainer, labelsContainer;
let bgSprite = null;
let nightMaskContainer, nightMaskGfx, nightMaskClip;
let nightMaskBlurFilter = null;
let dayMaskContainer, dayMaskGfx, dayMaskClip;
let dayMaskBlurFilter = null;
let terminatorGfx, gridGfx, limbGlowGfx, anchorsGfx, dotsGfx, labelsBgGfx;
let layerGraphicsMap = new Map(); // Store PIXI.Graphics objects indexed by layerIndex
let textPool = [];
let activeLabels = [];

// Hover
let hoverBgGfx = null;
let hoverLabel = null;

let _showLabels = false;
let _labelsTargetAlpha = 1;
let _allVisibleCraterPoints = [];

const _dotCandidates = [];
const _candidates = [];
const _placedBoxes = [];
const _activeLabelMap = new Map(); // crater -> BitmapText, for O(1) hover lookup

/**
 * Initialize the PixiJS application and build the scene tree.
 * @param {HTMLElement} container - DOM element to append the canvas to
 * @returns {PIXI.Application}
 */
async function init(container) {
  try {
    const fontUrl = `assets/bitmap/bitmap_SpaceGrotesk_white.fnt?v=${Date.now()}`;
    PIXI.Assets.add({ alias: 'SpaceGrotesk', src: fontUrl });
    await PIXI.Assets.load('SpaceGrotesk');

    // Optimisation de la texture pour le downscaling (Mipmaps + Linear filtering)
    const font = PIXI.Assets.get('SpaceGrotesk');
    if (font && font.pages) {
      font.pages.forEach(page => {
        if (page.texture && page.texture.source) {
          page.texture.source.style.magFilter = 'linear';
          page.texture.source.style.minFilter = 'linear';
          page.texture.source.style.mipmapMode = 'on';
          // Le forÃ§age de 'resolution' ici casse les UVs de la BitmapFont, on le supprime.
          page.texture.source.update();
        }
      });
    }
  } catch (err) {
    console.error("PixiRenderer: Font load error:", err);
  }

  app = new PIXI.Application();

  // Register advanced blend modes
  console.log('Registering advanced blend modes, OverlayBlend is:', PIXI.OverlayBlend);
  PIXI.extensions.add(
    PIXI.OverlayBlend, PIXI.ColorBurnBlend, PIXI.ColorDodgeBlend, PIXI.DarkenBlend, 
    PIXI.DifferenceBlend, PIXI.ExclusionBlend, PIXI.HardLightBlend, PIXI.LightenBlend, PIXI.SoftLightBlend
  );

  await app.init({
    preference: 'webgl',
    background: 0x06060c,
    resizeTo: window,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  // Canvas inherits positioning from #pixi-container (fixed in CSS)
  app.canvas.id = 'main-canvas';

  container.appendChild(app.canvas);

  // Build scene tree
  viewportContainer = new PIXI.Container();
  app.stage.addChild(viewportContainer);

  bgSprite = new PIXI.Sprite();
  bgSprite.visible = false;
  viewportContainer.addChild(bgSprite);

  geojsonContainer = new PIXI.Container();
  viewportContainer.addChild(geojsonContainer);

  // Lazy initialized in rebuildNightMask to survive HMR resets
  // nightMaskBlurFilter = new PIXI.BlurFilter({ strength: 0 });

  nightMaskContainer = new PIXI.Container();
  viewportContainer.addChild(nightMaskContainer);

  nightMaskGfx = new PIXI.Graphics();
  nightMaskContainer.addChild(nightMaskGfx);

  nightMaskClip = new PIXI.Graphics();
  viewportContainer.addChild(nightMaskClip);
  
  // Mask the container, not the filtered graphic
  nightMaskContainer.mask = nightMaskClip;

  // Day Mask (inverse of night mask â€” brightens the day side)
  dayMaskContainer = new PIXI.Container();
  viewportContainer.addChild(dayMaskContainer);

  dayMaskGfx = new PIXI.Graphics();
  dayMaskContainer.addChild(dayMaskGfx);

  dayMaskClip = new PIXI.Graphics();
  viewportContainer.addChild(dayMaskClip);

  dayMaskContainer.mask = dayMaskClip;
  dayMaskContainer.visible = false; // off by default

  terminatorGfx = new PIXI.Graphics();
  viewportContainer.addChild(terminatorGfx);

  gridGfx = new PIXI.Graphics();
  gridGfx.visible = false;
  viewportContainer.addChild(gridGfx);

  // Limb Glow (aesthetic arc on day-side edge)
  limbGlowGfx = new PIXI.Graphics();
  limbGlowGfx.visible = false;
  viewportContainer.addChild(limbGlowGfx);

  anchorsGfx = new PIXI.Graphics();
  viewportContainer.addChild(anchorsGfx);

  // Annotations
  annotationsContainer = new PIXI.Container();
  annotationsContainer.visible = false;
  viewportContainer.addChild(annotationsContainer);

  // Les points restent constants et attachÃ©s Ã  Annotations
  dotsGfx = new PIXI.Graphics();
  annotationsContainer.addChild(dotsGfx);

  // Groupe Textes + Fonds (pour fondu indÃ©pendant)
  labelsContainer = new PIXI.Container();
  annotationsContainer.addChild(labelsContainer);

  labelsBgGfx = new PIXI.Graphics();
  labelsContainer.addChild(labelsBgGfx);

  // Hover
  hoverBgGfx = new PIXI.Graphics();
  labelsContainer.addChild(hoverBgGfx);

  hoverLabel = new PIXI.BitmapText({
    text: '',
    style: { fontFamily: 'Space Grotesk Bold', fontSize: 14, align: 'center' }
  });
  hoverLabel.anchor.set(0.5, 1);
  hoverLabel.visible = false;
  labelsContainer.addChild(hoverLabel);

  // Live Config Update Listeners
  configEvents.addEventListener('configChanged', (e) => {
    const { section, key } = e.detail;
    if (section === 'RENDER') {
      redrawAllLayers();
    } else if (section === 'GRID') {
      redrawGrid();
    }
  });

  return app;
}

function redrawAllLayers() {
  if (_lastProjectedFeatures && _lastVp) {
    rebuildGeoJSON(_lastProjectedFeatures, _lastVp);
  }
  if (_lastTransformFn && _lastVp) {
    rebuildNightMask(_lastTransformFn);
    rebuildDayMask(_lastTransformFn);
    rebuildTerminator(_lastTransformFn, _lastVp);
    rebuildLimbGlow(_lastTransformFn, _lastVp);
  }
}

function redrawGrid() {
  if (_lastTransformFn && _lastVp) {
    rebuildGrid(_lastTransformFn, _lastVp, _lastLodLevel);
  }
}

/**
 * Get the PixiJS Application instance.
 */
function getApp() {
  return app;
}

/**
 * Get screen dimensions.
 */
function getScreenSize() {
  return { width: app.screen.width, height: app.screen.height };
}

/**
 * Set the background moon image from an HTMLImageElement.
 */
function setBackgroundImage(htmlImage, canvasW, canvasH) {
  const texture = PIXI.Texture.from(htmlImage);
  bgSprite.texture = texture;

  // Contain image within canvas (same logic as old drawBackground)
  const imgAspect = htmlImage.width / htmlImage.height;
  const canvasAspect = canvasW / canvasH;

  let drawW, drawH;
  if (imgAspect > canvasAspect) {
    drawW = canvasW;
    drawH = canvasW / imgAspect;
  } else {
    drawH = canvasH;
    drawW = canvasH * imgAspect;
  }

  bgSprite.width = drawW;
  bgSprite.height = drawH;
  bgSprite.x = (canvasW - drawW) / 2;
  bgSprite.y = (canvasH - drawH) / 2;
  bgSprite.visible = true;
}

/**
 * Get the displayed size of the background image on canvas.
 * Returns null if no image is loaded.
 * @returns {{ width: number, height: number } | null}
 */
function getBackgroundDisplaySize() {
  if (!bgSprite || !bgSprite.visible) return null;
  return { width: bgSprite.width, height: bgSprite.height };
}

/**
 * Update the viewport container transform (pan/zoom).
 */
function updateViewport(vp) {
  viewportContainer.position.set(vp.tx, vp.ty);
  viewportContainer.scale.set(vp.scale);
}

// â”€â”€â”€ GeoJSON Rendering â”€â”€â”€

/**
 * Rebuild all GeoJSON layer graphics from projected feature data.
 * Called only when data changes (dirty flag), not every frame.
 */
function rebuildGeoJSON(projectedFeatures, vp) {
  _lastProjectedFeatures = projectedFeatures;
  _lastVp = vp;

  if (!projectedFeatures || projectedFeatures.length === 0) {
    geojsonContainer.visible = false;
    return;
  }
  geojsonContainer.visible = true;

  // Group features by layerIndex
  const layerMap = new Map();
  for (const feature of projectedFeatures) {
    if (!feature.renderedCoords) continue;
    if (!layerMap.has(feature.layerIndex)) {
      layerMap.set(feature.layerIndex, []);
    }
    layerMap.get(feature.layerIndex).push(feature);
  }

  const invScale = 1 / vp.scale;

  // Viewport bounds en coordonnÃ©es "monde" brutes, avec marge paramÃ©trable
  const marginX = app.screen.width * CULLING.viewportMargin;
  const marginY = app.screen.height * CULLING.viewportMargin;
  const vpMinX = (-vp.tx - marginX) * invScale;
  const vpMaxX = (app.screen.width - vp.tx + marginX) * invScale;
  const vpMinY = (-vp.ty - marginY) * invScale;
  const vpMaxY = (app.screen.height - vp.ty + marginY) * invScale;

  // Hide all current graphics first (instead of removing them)
  for (const gfx of layerGraphicsMap.values()) {
    gfx.visible = false;
  }

  for (const [layerIndex, features] of layerMap) {
    let gfx = layerGraphicsMap.get(layerIndex);
    if (!gfx) {
      gfx = new PIXI.Graphics();
      geojsonContainer.addChild(gfx);
      layerGraphicsMap.set(layerIndex, gfx);
    }

    const layerName = layerState.loadedLayerNames[layerIndex];
    const isVisible = layerName ? (studioState.layerVisibility[layerName] ?? true) : true;
    if (!isVisible) {
      gfx.visible = false;
      continue;
    }

    gfx.clear();
    gfx.visible = true;
    
    // Apply Blend Mode
    const blendModeStr = layerName ? (studioState.layerBlendMode[layerName] ?? 'normal') : 'normal';
    gfx.blendMode = blendModeStr;

    const colorIdx = layerName ? (studioState.layerColor[layerName] ?? layerIndex) : layerIndex;
    const colors = LAYER_PALETTE[colorIdx % LAYER_PALETTE.length];
    const opacity = layerName ? (studioState.layerOpacity[layerName] ?? 1.0) : 1.0;
    const fine = layerName ? (studioState.layerFine[layerName] ?? 1.5) : 1.5;
    const isSmooth = layerName ? (studioState.layerSmooth[layerName] ?? false) : false;
    const glow = layerName ? (studioState.layerGlow[layerName] ?? 0.0) : 0.0;

    // --- Helper to trace paths for Z-Indexed rendering ---
    const traceRing = (ring) => {
      if (!isSmooth) {
        let started = false;
        for (let i = 0; i < ring.length; i += 2) {
          const rx = ring[i], ry = ring[i + 1];
          if (isNaN(rx)) { started = false; continue; }
          if (!started) { gfx.moveTo(rx, ry); started = true; }
          else { gfx.lineTo(rx, ry); }
        }
      } else {
        let started = false;
        for (let i = 0; i < ring.length; i += 2) {
          const rx = ring[i], ry = ring[i + 1];
          if (isNaN(rx)) { started = false; continue; }
          if (!started) { 
            gfx.moveTo(rx, ry); 
            started = true; 
          } else if (i + 2 < ring.length && !isNaN(ring[i + 2])) {
            const nx = ring[i + 2], ny = ring[i + 3];
            gfx.quadraticCurveTo(rx, ry, (rx + nx) / 2, (ry + ny) / 2);
          } else {
            gfx.lineTo(rx, ry);
          }
        }
      }
    };

    const tracePolygons = () => {
      let polyFound = false;
      for (const feature of features) {
        if (feature.type !== 'polygon') continue;
        if (feature.worldBounds && (feature.worldBounds.maxX < vpMinX || feature.worldBounds.minX > vpMaxX ||
            feature.worldBounds.maxY < vpMinY || feature.worldBounds.minY > vpMaxY)) continue;
        polyFound = true;
        for (const ring of feature.renderedCoords) {
          if (ring.length < 4) continue;
          traceRing(ring);
          gfx.closePath();
        }
      }
      return polyFound;
    };

    const traceLines = () => {
      let lineFound = false;
      for (const feature of features) {
        if (feature.type !== 'line') continue;
        if (feature.worldBounds && (feature.worldBounds.maxX < vpMinX || feature.worldBounds.minX > vpMaxX ||
            feature.worldBounds.maxY < vpMinY || feature.worldBounds.minY > vpMaxY)) continue;
        lineFound = true;
        for (const ring of feature.renderedCoords) {
          if (ring.length < 4) continue;
          traceRing(ring);
        }
      }
      return lineFound;
    };

    // --- Rendering Strategy Selection ---
    const useShaderGlow = uiState.currentPhase === 'EXPORT' ? true : studioState.useShaderGlow;

    if (useShaderGlow) {
      // â”€â”€â”€ SHADER GLOW METHOD (High Quality, Low Performance) â”€â”€â”€
      const hasPolys = tracePolygons();
      if (hasPolys) {
        gfx.fill({ color: colors.fill, alpha: colors.fillAlpha * opacity });
      }
      const hasLines = traceLines();
      
      if (hasPolys || hasLines) {
        gfx.stroke({ width: fine * invScale, color: colors.stroke, alpha: colors.alpha * opacity });
      }

      if (glow > 0 && (hasPolys || hasLines)) {
        gfx.filters = [new GlowFilter({ 
          distance: glow * 12, 
          outerStrength: 2, 
          innerStrength: 0, 
          color: colors.stroke, 
          quality: 0.5 
        })];
      } else {
        gfx.filters = null;
      }

    } else {
      // â”€â”€â”€ Z-INDEX GLOW METHOD (Fast Path, High Performance) â”€â”€â”€
      gfx.filters = null;

      const hasPolys = tracePolygons();
      const hasLines = traceLines();

      if (hasPolys) {
        gfx.fill({ color: colors.fill, alpha: colors.fillAlpha * opacity });
      }

      if (hasPolys || hasLines) {
        if (glow > 0) {
          const glowWidth = fine * invScale * (1 + glow * 2.5);
          const glowAlpha = Math.min(1.0, colors.alpha * opacity * (0.15 + glow * 0.15));
          gfx.stroke({ width: glowWidth, color: colors.stroke, alpha: glowAlpha });
        }
        // Core stroke (drawn over the glow stroke)
        gfx.stroke({ width: fine * invScale, color: colors.stroke, alpha: colors.alpha * opacity });
      }
    }

    // --- Type 3: Points (Batching) ---
    let ptFound = false;
    for (const feature of features) {
      if (feature.type !== 'point') continue;
      if (feature.worldBounds) {
        if (feature.worldBounds.maxX < vpMinX || feature.worldBounds.minX > vpMaxX ||
          feature.worldBounds.maxY < vpMinY || feature.worldBounds.minY > vpMaxY) continue;
      }
      ptFound = true;
      for (const ring of feature.renderedCoords) {
        for (let i = 0; i < ring.length; i += 2) {
          const rx = ring[i], ry = ring[i + 1];
          if (isNaN(rx)) continue;
          gfx.circle(rx, ry, RENDER.geoPointRadius * invScale);
        }
      }
    }
    if (ptFound) {
      gfx.fill({ color: colors.stroke, alpha: colors.alpha * opacity });
    }
  }
}

// â”€â”€â”€ Night Mask â”€â”€â”€

// Shared projection cache for terminator points (used by both nightmask + terminator)
let _termProjCache = null; // { geoPointsRef, libKey, projNorm: Array<[nx,ny]|null> }

/**
 * Get projected terminator points (normalized coords).
 * Cached per ephemeris change (terminatorGeoPoints ref + libration).
 */
function _getTerminatorProjections() {
  const state = moonState;
  if (!state || !state.terminatorGeoPoints || state.terminatorGeoPoints.length === 0) return null;

  const geoPoints = state.terminatorGeoPoints;
  const libKey = `${(state.librationLon || 0).toFixed(6)}_${(state.librationLat || 0).toFixed(6)}`;

  if (_termProjCache && _termProjCache.geoPointsRef === geoPoints && _termProjCache.libKey === libKey) {
    return _termProjCache;
  }

  const projNorm = new Array(geoPoints.length);
  for (let i = 0; i < geoPoints.length; i++) {
    projNorm[i] = GeoJSON.projectPoint(geoPoints[i][0], geoPoints[i][1]);
  }

  _termProjCache = { geoPointsRef: geoPoints, libKey, projNorm };
  return _termProjCache;
}

function rebuildNightMask(transformFn) {
  try {
    _lastTransformFn = transformFn;
    nightMaskGfx.clear();
    nightMaskClip.clear();

  const isStudio = uiState.currentPhase === 'STUDIO' || uiState.currentPhase === 'EXPORT';
  const showMask = isStudio ? studioState.nightMaskVisible : true;
  if (!showMask) {
    nightMaskContainer.visible = false;
    return;
  }
  nightMaskContainer.visible = true;

  const projCache = _getTerminatorProjections();
  if (!projCache) return;

  const pts = projCache.projNorm;
  const state = moonState;
  const n = pts.length;
  let startIdx = 0;
  let found = false;
  for (let i = 0; i < n; i++) {
    if (pts[i] !== null && pts[(i - 1 + n) % n] === null) {
      startIdx = i;
      found = true;
      break;
    }
  }
  if (!found) {
    startIdx = pts.findIndex(p => p !== null);
    if (startIdx === -1) return;
  }

  const visiblePoints = [];
  for (let i = 0; i < n; i++) {
    const p = pts[(startIdx + i) % n];
    if (p !== null) visiblePoints.push(p);
    else if (visiblePoints.length > 0) break;
  }

  if (visiblePoints.length < 2) return;

  const first = visiblePoints[0];
  const last = visiblePoints[visiblePoints.length - 1];

  // Draw solid night mask
  let moved = false;
  for (const p of visiblePoints) {
    const pt = transformFn(p[0], p[1]);
    if (!moved) { 
      nightMaskGfx.moveTo(pt.x, pt.y); 
      nightMaskClip.moveTo(pt.x, pt.y);
      moved = true; 
    } else { 
      nightMaskGfx.lineTo(pt.x, pt.y); 
      nightMaskClip.lineTo(pt.x, pt.y);
    }
  }

  const cx = 0.5, cy = 0.5;
  const aLast = Math.atan2(last[1] - cy, last[0] - cx);
  const aFirst = Math.atan2(first[1] - cy, first[0] - cx);

  let diff = aFirst - aLast;
  if (diff < 0) diff += Math.PI * 2;
  const aMid1 = aLast + diff / 2;
  const testNx = 0.5 + 0.49 * Math.cos(aMid1);
  const testNy = 0.5 + 0.49 * Math.sin(aMid1);

  let isNight1 = false;
  const geo = GeoJSON.inverseProject(testNx, testNy);
  if (geo) {
    const sLon = state.sunLon * Math.PI / 180;
    const sLat = (state.sunLat || 0) * Math.PI / 180;
    const geoLon = geo.lon * Math.PI / 180;
    const geoLat = geo.lat * Math.PI / 180;
    const px = Math.cos(geoLat) * Math.cos(geoLon);
    const py = Math.cos(geoLat) * Math.sin(geoLon);
    const pz = Math.sin(geoLat);
    const sx = Math.cos(sLat) * Math.cos(sLon);
    const sy = Math.cos(sLat) * Math.sin(sLon);
    const sz = Math.sin(sLat);
    isNight1 = (sx * px + sy * py + sz * pz) < 0;
  } else {
    const testNx2 = 0.5 + 0.45 * Math.cos(aMid1);
    const testNy2 = 0.5 + 0.45 * Math.sin(aMid1);
    const geo2 = GeoJSON.inverseProject(testNx2, testNy2);
    if (geo2) {
      const sLon = state.sunLon * Math.PI / 180;
      const sLat = (state.sunLat || 0) * Math.PI / 180;
      const geoLon = geo2.lon * Math.PI / 180;
      const geoLat = geo2.lat * Math.PI / 180;
      const px = Math.cos(geoLat) * Math.cos(geoLon);
      const py = Math.cos(geoLat) * Math.sin(geoLon);
      const pz = Math.sin(geoLat);
      const sx = Math.cos(sLat) * Math.cos(sLon);
      const sy = Math.cos(sLat) * Math.sin(sLon);
      const sz = Math.sin(sLat);
      isNight1 = (sx * px + sy * py + sz * pz) < 0;
    }
  }

  // Close the mask with an arc along the disc edge
  const steps = 40;
  if (isNight1) {
    for (let i = 1; i <= steps; i++) {
      let a = aLast + diff * (i / steps);
      let nx = 0.5 + 0.5 * Math.cos(a);
      let ny = 0.5 + 0.5 * Math.sin(a);
      let pt = transformFn(nx, ny);
      nightMaskGfx.lineTo(pt.x, pt.y);
      nightMaskClip.lineTo(pt.x, pt.y);
    }
  } else {
    let diffCCW = aLast - aFirst;
    if (diffCCW < 0) diffCCW += Math.PI * 2;
    for (let i = 1; i <= steps; i++) {
      let a = aLast - diffCCW * (i / steps);
      let nx = 0.5 + 0.5 * Math.cos(a);
      let ny = 0.5 + 0.5 * Math.sin(a);
      let pt = transformFn(nx, ny);
      nightMaskGfx.lineTo(pt.x, pt.y);
      nightMaskClip.lineTo(pt.x, pt.y);
    }
  }

  nightMaskGfx.closePath();
  nightMaskClip.closePath();

  const maskColor = isStudio ? LAYER_PALETTE[studioState.nightMaskColor % LAYER_PALETTE.length].fill : RENDER.nightMaskColor;
  const maskOpacity = isStudio ? studioState.nightMaskOpacity : RENDER.nightMaskAlpha;
  
  nightMaskContainer.blendMode = isStudio ? studioState.nightMaskBlendMode : 'normal';
  nightMaskGfx.fill({ color: maskColor, alpha: maskOpacity });
  nightMaskClip.fill({ color: 0xffffff, alpha: 1.0 });

  const maskBlur = isStudio ? studioState.nightMaskBlur : 0;
  
    if (maskBlur > 0) {
      if (!nightMaskBlurFilter) {
        nightMaskBlurFilter = new PIXI.BlurFilter({ strength: maskBlur });
      } else {
        nightMaskBlurFilter.strength = maskBlur;
      }
      // The blur spills into both sides. The clip mask perfectly cuts it off at the day side,
      // confining the gradient purely to the night side.
      nightMaskGfx.filters = [nightMaskBlurFilter];
    } else {
      nightMaskGfx.filters = null;
    }
  } catch (e) {
    console.error("Error in rebuildNightMask:", e);
  }
}

// â”€â”€â”€ Day Mask (inverse of Night Mask) â”€â”€â”€

function rebuildDayMask(transformFn) {
  try {
    _lastTransformFn = transformFn;
    dayMaskGfx.clear();
    dayMaskClip.clear();

    const isStudio = uiState.currentPhase === 'STUDIO' || uiState.currentPhase === 'EXPORT';
    const showMask = isStudio ? studioState.dayMaskVisible : false;
    if (!showMask) {
      dayMaskContainer.visible = false;
      return;
    }
    dayMaskContainer.visible = true;

    const projCache = _getTerminatorProjections();
    if (!projCache) return;

    const pts = projCache.projNorm;
    const state = moonState;
    const n = pts.length;
    let startIdx = 0;
    let found = false;
    for (let i = 0; i < n; i++) {
      if (pts[i] !== null && pts[(i - 1 + n) % n] === null) {
        startIdx = i;
        found = true;
        break;
      }
    }
    if (!found) {
      startIdx = pts.findIndex(p => p !== null);
      if (startIdx === -1) return;
    }

    const visiblePoints = [];
    for (let i = 0; i < n; i++) {
      const p = pts[(startIdx + i) % n];
      if (p !== null) visiblePoints.push(p);
      else if (visiblePoints.length > 0) break;
    }

    if (visiblePoints.length < 2) return;

    const first = visiblePoints[0];
    const last = visiblePoints[visiblePoints.length - 1];

    // Trace the terminator curve
    let moved = false;
    for (const p of visiblePoints) {
      const pt = transformFn(p[0], p[1]);
      if (!moved) {
        dayMaskGfx.moveTo(pt.x, pt.y);
        dayMaskClip.moveTo(pt.x, pt.y);
        moved = true;
      } else {
        dayMaskGfx.lineTo(pt.x, pt.y);
        dayMaskClip.lineTo(pt.x, pt.y);
      }
    }

    const cx = 0.5, cy = 0.5;
    const aLast = Math.atan2(last[1] - cy, last[0] - cx);
    const aFirst = Math.atan2(first[1] - cy, first[0] - cx);

    let diff = aFirst - aLast;
    if (diff < 0) diff += Math.PI * 2;
    const aMid1 = aLast + diff / 2;
    const testNx = 0.5 + 0.49 * Math.cos(aMid1);
    const testNy = 0.5 + 0.49 * Math.sin(aMid1);

    // Determine which side is night (same logic as nightMask)
    let isNight1 = false;
    const geo = GeoJSON.inverseProject(testNx, testNy);
    if (geo) {
      const sLon = state.sunLon * Math.PI / 180;
      const sLat = (state.sunLat || 0) * Math.PI / 180;
      const geoLon = geo.lon * Math.PI / 180;
      const geoLat = geo.lat * Math.PI / 180;
      const px = Math.cos(geoLat) * Math.cos(geoLon);
      const py = Math.cos(geoLat) * Math.sin(geoLon);
      const pz = Math.sin(geoLat);
      const sx = Math.cos(sLat) * Math.cos(sLon);
      const sy = Math.cos(sLat) * Math.sin(sLon);
      const sz = Math.sin(sLat);
      isNight1 = (sx * px + sy * py + sz * pz) < 0;
    } else {
      const testNx2 = 0.5 + 0.45 * Math.cos(aMid1);
      const testNy2 = 0.5 + 0.45 * Math.sin(aMid1);
      const geo2 = GeoJSON.inverseProject(testNx2, testNy2);
      if (geo2) {
        const sLon = state.sunLon * Math.PI / 180;
        const sLat = (state.sunLat || 0) * Math.PI / 180;
        const geoLon = geo2.lon * Math.PI / 180;
        const geoLat = geo2.lat * Math.PI / 180;
        const px = Math.cos(geoLat) * Math.cos(geoLon);
        const py = Math.cos(geoLat) * Math.sin(geoLon);
        const pz = Math.sin(geoLat);
        const sx = Math.cos(sLat) * Math.cos(sLon);
        const sy = Math.cos(sLat) * Math.sin(sLon);
        const sz = Math.sin(sLat);
        isNight1 = (sx * px + sy * py + sz * pz) < 0;
      }
    }

    // Close the mask along the DAY side arc (INVERSE of night mask)
    const steps = 40;
    if (!isNight1) {
      // Arc1 is the day side â†’ close along it
      for (let i = 1; i <= steps; i++) {
        let a = aLast + diff * (i / steps);
        let nx = 0.5 + 0.5 * Math.cos(a);
        let ny = 0.5 + 0.5 * Math.sin(a);
        let pt = transformFn(nx, ny);
        dayMaskGfx.lineTo(pt.x, pt.y);
        dayMaskClip.lineTo(pt.x, pt.y);
      }
    } else {
      // Arc2 is the day side â†’ close CCW
      let diffCCW = aLast - aFirst;
      if (diffCCW < 0) diffCCW += Math.PI * 2;
      for (let i = 1; i <= steps; i++) {
        let a = aLast - diffCCW * (i / steps);
        let nx = 0.5 + 0.5 * Math.cos(a);
        let ny = 0.5 + 0.5 * Math.sin(a);
        let pt = transformFn(nx, ny);
        dayMaskGfx.lineTo(pt.x, pt.y);
        dayMaskClip.lineTo(pt.x, pt.y);
      }
    }

    dayMaskGfx.closePath();
    dayMaskClip.closePath();

    const maskColor = LAYER_PALETTE[studioState.dayMaskColor % LAYER_PALETTE.length].fill;
    const maskOpacity = studioState.dayMaskOpacity;

    dayMaskContainer.blendMode = studioState.dayMaskBlendMode;
    dayMaskGfx.fill({ color: maskColor, alpha: maskOpacity });
    dayMaskClip.fill({ color: 0xffffff, alpha: 1.0 });

    const maskBlur = studioState.dayMaskBlur;

    if (maskBlur > 0) {
      if (!dayMaskBlurFilter) {
        dayMaskBlurFilter = new PIXI.BlurFilter({ strength: maskBlur });
      } else {
        dayMaskBlurFilter.strength = maskBlur;
      }
      dayMaskGfx.filters = [dayMaskBlurFilter];
    } else {
      dayMaskGfx.filters = null;
    }
  } catch (e) {
    console.error("Error in rebuildDayMask:", e);
  }
}

// â”€â”€â”€ Terminator Line â”€â”€â”€

function rebuildTerminator(transformFn, vp) {
  _lastTransformFn = transformFn;
  _lastVp = vp;
  terminatorGfx.clear();

  const isStudio = uiState.currentPhase === 'STUDIO' || uiState.currentPhase === 'EXPORT';
  const termVisible = studioState.terminatorVisible;
  if (!termVisible) {
    terminatorGfx.visible = false;
    return;
  }
  terminatorGfx.visible = true;

  const projCache = _getTerminatorProjections();
  if (!projCache) return;

  const projNorm = projCache.projNorm;
  const len = projNorm.length;
  const invScale = 1 / vp.scale;

  // Build world-space buffer from cached projections + transformFn
  if (!rebuildTerminator._buf || rebuildTerminator._buf.length < len * 2) {
    rebuildTerminator._buf = new Float64Array(len * 2);
  }
  const buf = rebuildTerminator._buf;
  for (let i = 0; i < len; i++) {
    const proj = projNorm[i];
    if (proj) {
      const pt = transformFn(proj[0], proj[1]);
      buf[i * 2] = pt.x;
      buf[i * 2 + 1] = pt.y;
    } else {
      buf[i * 2] = NaN;
      buf[i * 2 + 1] = NaN;
    }
  }


  const termColor = isStudio ? LAYER_PALETTE[studioState.terminatorColor % LAYER_PALETTE.length].stroke : RENDER.terminatorCoreColor;
  const termThick = isStudio ? studioState.terminatorThickness : RENDER.terminatorCoreWidth;
  const termOpacity = isStudio ? studioState.terminatorOpacity : 1.0;
  const termGlow = isStudio ? studioState.terminatorGlow : 1.0; 
  const useShaderGlow = uiState.currentPhase === 'EXPORT' ? true : (isStudio ? studioState.useShaderGlow : true);
  
  terminatorGfx.blendMode = isStudio ? studioState.terminatorBlendMode : 'normal';

  function traceTerminator() {
    let isDrawing = false;
    for (let i = 0; i < len; i++) {
      const px = buf[i * 2], py = buf[i * 2 + 1];
      if (!isNaN(px)) {
        if (!isDrawing) { terminatorGfx.moveTo(px, py); isDrawing = true; }
        else { terminatorGfx.lineTo(px, py); }
      } else {
        isDrawing = false;
      }
    }
  }

  if (useShaderGlow) {
    traceTerminator();
    terminatorGfx.stroke({ width: termThick * invScale, color: termColor, alpha: termOpacity });
    if (termGlow > 0) {
      terminatorGfx.filters = [new GlowFilter({ distance: termGlow * 12, outerStrength: 2, innerStrength: 0, color: termColor, quality: 0.5 })];
    } else {
      terminatorGfx.filters = null;
    }
  } else {
    terminatorGfx.filters = null;
    traceTerminator();
    if (termGlow > 0) {
      if (!isStudio) {
        // Fallback to original initial display rendering
        terminatorGfx.stroke({ width: RENDER.terminatorGlowWidth * invScale, color: RENDER.terminatorGlowColor, alpha: RENDER.terminatorGlowAlpha });
      } else {
        const glowWidth = termThick * invScale * (1 + termGlow * 2.5);
        const glowAlpha = Math.min(1.0, termOpacity * (0.15 + termGlow * 0.15));
        terminatorGfx.stroke({ width: glowWidth, color: termColor, alpha: glowAlpha });
      }
    }
    if (typeof terminatorGfx.beginPath === 'function') terminatorGfx.beginPath();
    traceTerminator();
    terminatorGfx.stroke({ width: termThick * invScale, color: termColor, alpha: termOpacity });
  }
}

// â”€â”€â”€ Grid â”€â”€â”€

// Cached grid projection data (changes with libration OR grid spacing)
let _gridCache = null; // { cacheKey, linesNorm, horizonNorm }

/**
 * Build or retrieve cached grid normalized coords.
 * Reprojects when libration or grid spacing changes.
 * @param {number} spacing - Grid line spacing in degrees (default 10)
 */
function _getGridCache(spacing = 10) {
  const state = moonState || {};
  const libKey = `${(state.librationLon || 0).toFixed(6)}_${(state.librationLat || 0).toFixed(6)}`;
  const cacheKey = `${libKey}_${spacing}`;

  if (_gridCache && _gridCache.cacheKey === cacheKey) return _gridCache;

  // Build grid lines as flat [nx, ny, nx, ny, ...] with NaN separators between lines
  const linesData = [];

  // Longitude lines
  for (let lon = -90; lon <= 90; lon += spacing) {
    let hasStarted = false;
    for (let lat = 90; lat >= -90; lat -= GRID.sampleStep) {
      const proj = GeoJSON.projectPoint(lon, lat);
      if (!proj) continue;
      if (!hasStarted) hasStarted = true;
      linesData.push(proj[0], proj[1]);
    }
    if (hasStarted) linesData.push(NaN, NaN); // separator
  }

  // Latitude lines
  for (let lat = -90; lat <= 90; lat += spacing) {
    let hasStarted = false;
    for (let lon = -90; lon <= 90; lon += GRID.sampleStep) {
      const proj = GeoJSON.projectPoint(lon, lat);
      if (!proj) continue;
      if (!hasStarted) hasStarted = true;
      linesData.push(proj[0], proj[1]);
    }
    if (hasStarted) linesData.push(NaN, NaN); // separator
  }

  // Horizon circle
  const horizonData = [];
  for (let angle = 0; angle <= 360; angle += GRID.horizonStep) {
    const rad = angle * Math.PI / 180;
    horizonData.push(0.5 + 0.5 * Math.cos(rad), 0.5 + 0.5 * Math.sin(rad));
  }

  _gridCache = {
    cacheKey,
    linesNorm: new Float32Array(linesData),
    horizonNorm: new Float32Array(horizonData),
    // Working buffers for transform (avoids allocation)
    linesWork: new Float32Array(linesData.length),
    horizonWork: new Float32Array(horizonData.length)
  };

  return _gridCache;
}

function rebuildGrid(transformFn, vp, lodLevel = 0) {
  _lastTransformFn = transformFn;
  _lastVp = vp;
  _lastLodLevel = lodLevel;

  const isStudio = uiState.currentPhase === 'STUDIO' || uiState.currentPhase === 'EXPORT';
  const showGrid = studioState.gridVisible;
  
  gridGfx.clear();
  if (!showGrid) {
    gridGfx.visible = false;
    return;
  }
  gridGfx.visible = true;

  const invScale = 1 / vp.scale;
  const spacing = isStudio ? studioState.gridInterval : (GRID.spacingByLOD[lodLevel] || 10);
  const cache = _getGridCache(spacing);

  // Copy cached projections to working buffers, then apply TPS + Transform in-place
  cache.linesWork.set(cache.linesNorm);
  Anchors.applyBuffer(cache.linesWork);

  cache.horizonWork.set(cache.horizonNorm);
  Anchors.applyBuffer(cache.horizonWork);


  const gridColor = isStudio ? LAYER_PALETTE[studioState.gridColor % LAYER_PALETTE.length].stroke : GRID.lineColor;
  const gridThick = isStudio ? studioState.gridThickness : GRID.lineWidth;
  const gridOpacity = isStudio ? studioState.gridOpacity : GRID.lineAlpha;
  const gridGlow = isStudio ? studioState.gridGlow : 0.0;
  const useShaderGlow = uiState.currentPhase === 'EXPORT' ? true : (isStudio ? studioState.useShaderGlow : false);

  gridGfx.blendMode = isStudio ? studioState.gridBlendMode : 'normal';

  function traceGrid() {
    const lb = cache.linesWork;
    let moved = false;
    for (let i = 0; i < lb.length; i += 2) {
      const x = lb[i], y = lb[i + 1];
      if (isNaN(x)) { moved = false; continue; }
      if (!moved) { gridGfx.moveTo(x, y); moved = true; }
      else gridGfx.lineTo(x, y);
    }
    
    const hb = cache.horizonWork;
    if (hb.length > 0) {
      gridGfx.moveTo(hb[0], hb[1]);
      for (let i = 2; i < hb.length; i += 2) {
        gridGfx.lineTo(hb[i], hb[i + 1]);
      }
    }
  }

  if (useShaderGlow) {
    traceGrid();
    gridGfx.stroke({ width: gridThick * invScale, color: gridColor, alpha: gridOpacity });
    if (gridGlow > 0) {
      gridGfx.filters = [new GlowFilter({ distance: gridGlow * 12, outerStrength: 2, innerStrength: 0, color: gridColor, quality: 0.5 })];
    } else {
      gridGfx.filters = null;
    }
  } else {
    gridGfx.filters = null;
    traceGrid();
    if (gridGlow > 0) {
      const glowWidth = gridThick * invScale * (1 + gridGlow * 2.5);
      const glowAlpha = Math.min(1.0, gridOpacity * (0.15 + gridGlow * 0.15));
      gridGfx.stroke({ width: glowWidth, color: gridColor, alpha: glowAlpha });
    }
    if (typeof gridGfx.beginPath === 'function') gridGfx.beginPath();
    traceGrid();
    gridGfx.stroke({ width: gridThick * invScale, color: gridColor, alpha: gridOpacity });
  }
}


// â”€â”€â”€ Limb Glow (aesthetic day-side edge glow) â”€â”€â”€

let _limbGlowBlurFilter = null;

function rebuildLimbGlow(transformFn, vp) {
  _lastTransformFn = transformFn;
  _lastVp = vp;
  limbGlowGfx.clear();

  const isStudio = uiState.currentPhase === 'STUDIO' || uiState.currentPhase === 'EXPORT';
  if (!isStudio || !studioState.limbGlow || studioState.limbGlowIntensity <= 0) {
    limbGlowGfx.visible = false;
    return;
  }
  limbGlowGfx.visible = true;

  const projCache = _getTerminatorProjections();
  const state = moonState;
  const opacity = studioState.limbGlowOpacity;
  const thickness = studioState.limbGlowThickness;
  const spread = studioState.limbGlowSpread;
  const blur = studioState.limbGlowBlur;
  const invScale = 1 / vp.scale;
  const useShaderGlow = uiState.currentPhase === 'EXPORT' ? true : studioState.useShaderGlow;

  // â”€â”€ Determine day-side arc boundaries â”€â”€
  let dayArcStart = 0;
  let dayArcSweep = Math.PI * 2; // fallback: full circle

  if (projCache && projCache.projNorm) {
    const pts = projCache.projNorm;
    const n = pts.length;

    let startIdx = 0;
    let found = false;
    for (let i = 0; i < n; i++) {
      if (pts[i] !== null && pts[(i - 1 + n) % n] === null) {
        startIdx = i; found = true; break;
      }
    }
    if (!found) startIdx = pts.findIndex(p => p !== null);

    if (startIdx >= 0) {
      const visiblePoints = [];
      for (let i = 0; i < n; i++) {
        const p = pts[(startIdx + i) % n];
        if (p !== null) visiblePoints.push(p);
        else if (visiblePoints.length > 0) break;
      }

      if (visiblePoints.length >= 2) {
        const first = visiblePoints[0];
        const last = visiblePoints[visiblePoints.length - 1];
        const cx = 0.5, cy = 0.5;
        const aLast = Math.atan2(last[1] - cy, last[0] - cx);
        const aFirst = Math.atan2(first[1] - cy, first[0] - cx);

        let diff = aFirst - aLast;
        if (diff < 0) diff += Math.PI * 2;
        const aMid1 = aLast + diff / 2;
        const testNx = 0.5 + 0.49 * Math.cos(aMid1);
        const testNy = 0.5 + 0.49 * Math.sin(aMid1);

        let isNight1 = false;
        const geo = GeoJSON.inverseProject(testNx, testNy);
        if (geo) {
          const sLon = state.sunLon * Math.PI / 180;
          const sLat = (state.sunLat || 0) * Math.PI / 180;
          const geoLon = geo.lon * Math.PI / 180;
          const geoLat = geo.lat * Math.PI / 180;
          const dot = (Math.cos(geoLat) * Math.cos(geoLon) * Math.cos(sLat) * Math.cos(sLon)) +
                      (Math.cos(geoLat) * Math.sin(geoLon) * Math.cos(sLat) * Math.sin(sLon)) +
                      (Math.sin(geoLat) * Math.sin(sLat));
          isNight1 = dot < 0;
        }

        if (!isNight1) {
          dayArcStart = aLast;
          dayArcSweep = diff;
        } else {
          let diffCCW = aLast - aFirst;
          if (diffCCW < 0) diffCCW += Math.PI * 2;
          dayArcStart = aLast;
          dayArcSweep = -diffCCW;
        }
      }
    }
  }

  // ── Extend arc slightly beyond endpoints so glow wraps around the poles ──
  const overreach = Math.abs(dayArcSweep) * 0.02;
  const extStart = dayArcStart - Math.sign(dayArcSweep) * overreach;
  const extSweep = dayArcSweep + Math.sign(dayArcSweep) * overreach * 2;

  const steps = 80;
  const glowColor = LAYER_PALETTE[studioState.limbGlowColor % LAYER_PALETTE.length].stroke;
  
  // Base parameters
  const baseAlpha = opacity;
  const baseWidth = thickness * invScale;
  const baseRadius = 0.5;

  function traceArcAtRadius(radiusOffset) {
    let moved = false;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = extStart + extSweep * t;
      const r = baseRadius + radiusOffset;
      const pt = transformFn(0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a));
      if (!moved) { limbGlowGfx.moveTo(pt.x, pt.y); moved = true; }
      else limbGlowGfx.lineTo(pt.x, pt.y);
    }
  }

  // Draw 3 concentric arcs with descending opacity, increasing thickness, and offset spread
  const spreadScale = spread * 0.0005; // Map 0-50 to 0-0.025 radius units

  // Arc 1: Base
  traceArcAtRadius(0);
  limbGlowGfx.stroke({ width: baseWidth, color: glowColor, alpha: baseAlpha });

  // Arc 2: Mid
  if (spreadScale > 0 || thickness > 0) {
    traceArcAtRadius(spreadScale);
    limbGlowGfx.stroke({ width: baseWidth * 2, color: glowColor, alpha: baseAlpha * 0.5 });
  }

  // Arc 3: Outer
  if (spreadScale > 0 || thickness > 0) {
    traceArcAtRadius(spreadScale * 2.5);
    limbGlowGfx.stroke({ width: baseWidth * 4, color: glowColor, alpha: baseAlpha * 0.25 });
  }

  // Apply Gaussian blur if requested
  if (blur > 0) {
    if (!_limbGlowBlurFilter) {
      _limbGlowBlurFilter = new PIXI.BlurFilter({ strength: blur, quality: 3 });
    } else {
      _limbGlowBlurFilter.strength = blur;
    }
    // Prevent filter clipping at the bounds of the graphics
    _limbGlowBlurFilter.padding = blur * 3 + 20;
    
    limbGlowGfx.filters = [_limbGlowBlurFilter];
  } else {
    limbGlowGfx.filters = null;
  }
}


function rebuildAnchors(anchorsData, vp, activeAnchorId) {
  anchorsGfx.clear();

  if (anchorsData.length === 0) return;

  const invScale = 1 / vp.scale;

  for (const a of anchorsData) {
    const srcPt = Transform.apply(a.sx, a.sy);
    const srcX = srcPt.x, srcY = srcPt.y;
    const dst = Transform.apply(a.dx, a.dy);
    const isActive = a.id === activeAnchorId;

    const dist = Math.hypot(dst.x - srcX, dst.y - srcY);
    if (dist > 2) {
      // Connecting dashed line (simplified to solid in PixiJS)
      anchorsGfx.moveTo(srcX, srcY);
      anchorsGfx.lineTo(dst.x, dst.y);
      anchorsGfx.stroke({ width: RENDER.anchorLineWidth * invScale, color: 0xffffff, alpha: RENDER.anchorLineAlpha });

      // Source (orange)
      anchorsGfx.circle(srcX, srcY, RENDER.anchorSrcRadius * invScale);
      anchorsGfx.fill({ color: RENDER.anchorSrcColor });
      anchorsGfx.stroke({ width: RENDER.anchorLineWidth * invScale, color: 0xffffff, alpha: 0.6 });
    }

    // Active halo
    if (isActive) {
      anchorsGfx.circle(dst.x, dst.y, RENDER.anchorHaloRadius * invScale);
      anchorsGfx.fill({ color: RENDER.anchorDstColor, alpha: RENDER.anchorHaloAlpha });
    }

    // Destination (green)
    const dstRadius = (isActive ? RENDER.anchorDstActiveRadius : RENDER.anchorDstRadius) * invScale;
    anchorsGfx.circle(dst.x, dst.y, dstRadius);
    anchorsGfx.fill({ color: RENDER.anchorDstColor });
    anchorsGfx.stroke({ width: (isActive ? 2.5 : 1.5) * invScale, color: 0xffffff, alpha: 0.8 });
  }
}

/**
 * Render the emergency mode pivot anchor (orange diamond).
 */
function rebuildPivotAnchor(vp) {
  const pivot = uiState.pivotAnchor;
  if (!pivot || !uiState.emergencyMode) return;

  const invScale = 1 / vp.scale;
  const pt = Transform.apply(pivot.nx, pivot.ny);
  const s = EMERGENCY.pivotDiamondSize * invScale;

  // Halo glow
  anchorsGfx.circle(pt.x, pt.y, EMERGENCY.pivotHaloRadius * invScale);
  anchorsGfx.fill({ color: EMERGENCY.pivotColor, alpha: EMERGENCY.pivotHaloAlpha });

  // Diamond shape
  anchorsGfx.moveTo(pt.x, pt.y - s);      // top
  anchorsGfx.lineTo(pt.x + s, pt.y);      // right
  anchorsGfx.lineTo(pt.x, pt.y + s);      // bottom
  anchorsGfx.lineTo(pt.x - s, pt.y);      // left
  anchorsGfx.closePath();
  anchorsGfx.fill({ color: EMERGENCY.pivotColor, alpha: 0.9 });
  anchorsGfx.stroke({ width: EMERGENCY.pivotLineWidth * invScale, color: 0xffffff, alpha: 0.8 });

  // Inner dot
  anchorsGfx.circle(pt.x, pt.y, 2 * invScale);
  anchorsGfx.fill({ color: 0xffffff });
}

// â”€â”€â”€ Annotations (Crater Labels) â”€â”€â”€

function rebuildAnnotations(transformFn, cratersDB, vp, canvasW, canvasH) {
  if (!_showLabels || !cratersDB || cratersDB.length === 0) {
    annotationsContainer.visible = false;
    return;
  }
  annotationsContainer.visible = true;

  const minDiameter = 10 / vp.scale;
  dotsGfx.clear();
  labelsBgGfx.clear();

  // Move current labels to pool
  for (const label of activeLabels) {
    label.visible = false;
    textPool.push(label);
  }
  activeLabels = [];
  _activeLabelMap.clear();

  const MAX_DOTS = LABELS.maxDots;
  const MAX_LABELS = LABELS.maxLabels;

  const cx = canvasW / 2;
  const cy = canvasH / 2;
  const maxScreenDistSq = cx * cx + cy * cy;

  _allVisibleCraterPoints.length = 0;
  _dotCandidates.length = 0;
  _candidates.length = 0;
  _placedBoxes.length = 0;

  // Passe 1 : Collecter et trier tous les cratÃ¨res visibles dans le champ
  for (const crater of cratersDB) {
    if (crater.name === "--" || crater.nx === null) continue;

    const pt = transformFn(crater.nx, crater.ny);
    const ptX = pt.x, ptY = pt.y; // Copy from scratch object
    const sx = ptX * vp.scale + vp.tx;
    const sy = ptY * vp.scale + vp.ty;

    // Frustum Culling gÃ©nÃ©reux
    if (sx < -200 || sx > canvasW + 200 || sy < -200 || sy > canvasH + 200) continue;

    _dotCandidates.push({ crater, ptX, ptY, sx, sy });
  }

  // cratersDB is pre-sorted by diameter descending (done once at init)
  // _dotCandidates inherits that order â€” no re-sort needed

  const dotsCount = Math.min(_dotCandidates.length, MAX_DOTS);
  const minHoverDiameter = LABELS.hoverMinScreenDiameter / vp.scale;

  // Pre-compute sun trig ONCE outside the loop
  const DEG2RAD = Math.PI / 180;
  const hasSun = moonState && typeof moonState.sunLon === 'number';
  let sinSLon = 0, cosSLon = 0, sinSLat = 0, cosSLat = 0, sunLonRad = 0;
  if (hasSun) {
    sunLonRad = moonState.sunLon * DEG2RAD;
    const sLatR = (moonState.sunLat || 0) * DEG2RAD;
    sinSLon = Math.sin(sunLonRad); cosSLon = Math.cos(sunLonRad);
    sinSLat = Math.sin(sLatR); cosSLat = Math.cos(sLatR);
  }

  // Passe 2 : Dessiner le Top N des plus gros cratÃ¨res de la zone
  for (let i = 0; i < dotsCount; i++) {
    const item = _dotCandidates[i];
    const { crater, ptX, ptY, sx, sy } = item;

    // Sun incidence using pre-computed trig (crater.sinLat/cosLat/lonRad immutable)
    let op = 1.0;
    if (hasSun) {
      const cosI = crater.sinLat * sinSLat + crater.cosLat * cosSLat * Math.cos(crater.lonRad - sunLonRad);
      if (cosI < 0) op = LABELS.nightOpacity;
      else if (cosI < LABELS.nightTransitionCosI) {
        op = LABELS.nightOpacity + ((1.0 - LABELS.nightOpacity) * (cosI / LABELS.nightTransitionCosI));
      }
    }

    if (op < 0.05) continue;

    // Rayon bornÃ© entre 2.0 et 3.0 via sqrt
    const onScreenRadius = Math.max(LABELS.dotRadiusMin, Math.min(LABELS.dotRadiusMax, Math.sqrt(crater.diameter * vp.scale) * LABELS.dotRadiusScale));
    const baseR = onScreenRadius / vp.scale;
    const type = crater.type;

    if (type === 'Mons, montes') {
      // Montagne (Triangle) - Neon Pink
      const r = baseR * 2.5;
      dotsGfx.poly([
        ptX, ptY - r,
        ptX + r, ptY + r,
        ptX - r, ptY + r
      ]);
      dotsGfx.fill({ color: 0xFF4081, alpha: op });
    } else if (type === 'Mare, maria' || type === 'Oceanus, oceani' || type === 'Sinus, sinÅ«s' || type === 'Lacus, lacÅ«s' || type === 'Palus, paludes') {
      // Vague (Wave) - Electric Cyan
      const r = baseR * 2.5;
      dotsGfx.moveTo(ptX - r, ptY);
      dotsGfx.quadraticCurveTo(ptX - r/2, ptY - r, ptX, ptY);
      dotsGfx.quadraticCurveTo(ptX + r/2, ptY + r, ptX + r, ptY);
      dotsGfx.stroke({ width: 1.5 / vp.scale, color: 0x00E5FF, alpha: op });
    } else if (type === 'Statio') {
      // IcÃ´ne "Satellite Dish" (Lucide SVG traduit en vectoriel natif) - Neon Green
      const s = baseR * 0.4; // Ã‰chelle
      const px = (x) => ptX + (x - 12) * s;
      const py = (y) => ptY + (y - 12) * s;

      // Bras du rÃ©cepteur (m9 15 3-3)
      dotsGfx.moveTo(px(9), py(15));
      dotsGfx.lineTo(px(12), py(12));
      dotsGfx.stroke({ width: 1.5 / vp.scale, color: 0x00FF88, alpha: op });

      // Onde interne (M17 13a6 6 0 0 0-6-6)
      dotsGfx.moveTo(px(11), py(7)); // Point de dÃ©part de l'arc
      dotsGfx.arc(px(11), py(13), 6 * s, -Math.PI/2, 0);
      dotsGfx.stroke({ width: 1.5 / vp.scale, color: 0x00FF88, alpha: op });

      // Onde externe (M21 13A10 10 0 0 0 11 3)
      dotsGfx.moveTo(px(11), py(3)); // Point de dÃ©part de l'arc
      dotsGfx.arc(px(11), py(13), 10 * s, -Math.PI/2, 0);
      dotsGfx.stroke({ width: 1.5 / vp.scale, color: 0x00FF88, alpha: op });

      // Parabole (M4 10a7.31... Z) - reproduite via bÃ©zier
      dotsGfx.moveTo(px(4), py(10));
      dotsGfx.quadraticCurveTo(px(4), py(20), px(14), py(20));
      dotsGfx.lineTo(px(4), py(10));
      dotsGfx.fill({ color: 0x00FF88, alpha: op });
    } else {
      // CratÃ¨re classique (Point Rouge)
      dotsGfx.circle(ptX, ptY, baseR);
      dotsGfx.fill({ color: 0xff4b4b, alpha: op });
    }

    // Les petits cratÃ¨res ne dÃ©clenchent pas le survol pour Ã©viter le bruit
    // MAIS on force le survol pour les Ã©lÃ©ments spÃ©ciaux (Sondes, Montagnes, Mers)
    if (crater.diameter >= minHoverDiameter || (type !== 'Crater, craters' && type !== 'Satellite Feature')) {
      _allVisibleCraterPoints.push({ crater, ptX, ptY, op });
    }

    // PrÃ©paration pour les Labels
    const textWidth = crater.name.length * 8;
    const textHeight = 14;
    const boxX = sx - textWidth / 2;
    const boxY = sy - 8 - textHeight;

    // Strict Culling des labels sur le bord vÃ©ritable de l'Ã©cran
    if (boxX < 0 || boxX + textWidth > canvasW || boxY < 0 || boxY + textHeight > canvasH) continue;

    const dx = sx - cx;
    const dy = sy - cy;
    const distSq = dx * dx + dy * dy;
    const normalizedDist = Math.max(0, Math.min(1, Math.sqrt(distSq / maxScreenDistSq)));
    
    // Le score de base dÃ©pend du diamÃ¨tre et de la proximitÃ© du centre
    let score = (crater.diameter * vp.scale) * (1.0 - (normalizedDist * 0.8));
    
    // Boost majeur pour les Statio afin qu'elles s'affichent toujours
    if (type === 'Statio') score += 10000;
    // LÃ©ger bonus pour les Mers/Montagnes pour les privilÃ©gier aux petits cratÃ¨res
    else if (type !== 'Crater, craters' && type !== 'Satellite Feature') score += 10 * vp.scale;

    _candidates.push({ crater, ptX, ptY, sx, sy, op, score, boxX, boxY, textWidth, textHeight });
  }

  // Tri par prioritÃ© dÃ©croissante
  _candidates.sort((a, b) => b.score - a.score);

  const invScale = 1 / vp.scale;

  for (const item of _candidates) {
    if (activeLabels.length >= MAX_LABELS) break;

    // HITBOX INVISIBLE : Force les labels Ã  s'Ã©carter les uns des autres
    const pad = LABELS.overlapPadding;
    const hitX = item.boxX - pad;
    const hitY = item.boxY - pad;
    const hitW = item.textWidth + pad * 2;
    const hitH = item.textHeight + pad * 2;

    // Anti-Overlap sur la Hitbox gÃ©ante
    let overlap = false;
    for (const box of _placedBoxes) {
      if (hitX < box.x + box.w && hitX + hitW > box.x &&
        hitY < box.y + box.h && hitY + hitH > box.y) {
        overlap = true;
        break;
      }
    }
    if (overlap) continue;

    // Validation (on rÃ©serve tout ce grand espace vide)
    _placedBoxes.push({ x: hitX, y: hitY, w: hitW, h: hitH });

    // Design de la Pilule (Backdrop) ajustÃ©e et amincie
    const bgWorldW = (item.textWidth + 10) * invScale;
    const bgWorldH = (item.textHeight + 6) * invScale;
    const bgWorldX = item.ptX - bgWorldW / 2;
    const bgWorldY = (item.ptY - LABELS.labelOffsetY * invScale) - bgWorldH;

    labelsBgGfx.roundRect(bgWorldX, bgWorldY, bgWorldW, bgWorldH, 3 * invScale);
    labelsBgGfx.fill({ color: 0x06060c, alpha: item.op * 0.85 });
    labelsBgGfx.stroke({ width: 1 * invScale, color: 0x22222a, alpha: item.op * 0.6 });

    // Utilisation de PIXI.BitmapText
    let label = textPool.pop();
    if (!label) {
      label = new PIXI.BitmapText({
        text: '',
        style: {
          fontFamily: 'Space Grotesk Bold',
          fontSize: 14,
          align: 'center',
        }
      });
      label.anchor.set(0.5, 1);
      labelsContainer.addChild(label);
    }

    label.text = item.crater.name;
    label.position.set(item.ptX, item.ptY - LABELS.labelOffsetY * invScale);
    label.scale.set(invScale);
    label.alpha = item.op;
    label.visible = true;

    label._worldX = item.ptX;
    label._worldY = item.ptY;
    label._crater = item.crater;

    activeLabels.push(label);
    _activeLabelMap.set(item.crater, label);
  }
}

/**
 * Lightweight update for labels during zoom/pan.
 * Just updates transforms and scales without full rebuild or dot update.
 */
function updateAnnotationsTransform(vp, isDragging = false, mouseX = -1000, mouseY = -1000) {
  if (!_showLabels) return;
  const invScale = 1 / vp.scale;

  // 1. VisibilitÃ© & Fondu (Optimisation GPU)
  _labelsTargetAlpha = isDragging ? 0 : 1;

  if (isDragging) {
    // Disparition instantanÃ©e pour soulager le "blender" GPU pendant les mouvements
    labelsContainer.alpha = 0;
    labelsContainer.visible = false;
  } else {
    // Apparition en fondu doux au relÃ¢chement
    labelsContainer.visible = true;
    const alphaDiff = _labelsTargetAlpha - labelsContainer.alpha;
    if (Math.abs(alphaDiff) > 0.01) {
      labelsContainer.alpha += alphaDiff * LABELS.fadeInSpeed; // Smooth Damping (controlled by config)
    } else {
      labelsContainer.alpha = _labelsTargetAlpha;
    }
  }

  const w = app.screen.width;
  const h = app.screen.height;

  // 2. Frustum Culling temps rÃ©el STRICT
  for (const label of activeLabels) {
    const sx = label._worldX * vp.scale + vp.tx;
    const sy = label._worldY * vp.scale + vp.ty;
    const textW = label.text.length * 8;
    const textH = 14;
    const boxX = sx - textW / 2;
    const boxY = sy - 8 - textH;

    // On n'affiche pas si tronquÃ© par le bord (Culling strict)
    if (boxX < 0 || boxX + textW > w || boxY < 0 || boxY + textH > h) {
      label.visible = false;
    } else {
      label.visible = true;
      label.position.set(label._worldX, label._worldY - LABELS.labelOffsetY * invScale);
      label.scale.set(invScale);
      label.tint = 0xffffff; // Reset le tint obligatoire pour retirer l'effet bleu aprÃ¨s un hover
    }
  }

  // 3. Hover : Scan optimisÃ© (influence rÃ©duite)
  let closestCandidate = null;
  let closestDistSq = 144; // 12 * 12

  if (!isDragging) {
    for (const cand of _allVisibleCraterPoints) {
      const sx = cand.ptX * vp.scale + vp.tx;
      const sy = cand.ptY * vp.scale + vp.ty;

      const dx = sx - mouseX;
      if (Math.abs(dx) > 15) continue;
      const dy = sy - mouseY;
      if (Math.abs(dy) > 15) continue;

      const dSq = dx * dx + dy * dy;
      if (dSq < closestDistSq) {
        closestDistSq = dSq;
        closestCandidate = cand;
      }
    }
  }

  // 4. Update Hover UI
  hoverBgGfx.clear();
  hoverLabel.visible = false;

  if (closestCandidate) {
    // VÃ©rifier si ce cratÃ¨re possÃ¨de DÃ‰JÃ€ un label Ã  l'Ã©cran (O(1) lookup)
    const existingLabel = _activeLabelMap.get(closestCandidate.crater) || null;

    // Effet commun : cercle NÃ©on de sÃ©lection
    hoverBgGfx.circle(closestCandidate.ptX, closestCandidate.ptY, 8 * invScale);
    hoverBgGfx.stroke({ width: 2 * invScale, color: 0x00d4ff, alpha: 0.9 });

    if (existingLabel && existingLabel.visible) {
      // Glow sur le label existant au lieu de le dupliquer !
      existingLabel.tint = 0x00d4ff;
    } else {
      // S'il n'avait pas de label, on fait "pop" un label de hover classique
      const txt = closestCandidate.crater.name;
      hoverLabel.text = txt;

      const textW = txt.length * 9;
      const textH = 22;
      const bgWorldW = (textW + 16) * invScale;
      const bgWorldH = (textH + 8) * invScale;
      const bgWorldX = closestCandidate.ptX - bgWorldW / 2;
      const bgWorldY = (closestCandidate.ptY - 12 * invScale) - bgWorldH + (4 * invScale);

      hoverBgGfx.roundRect(bgWorldX, bgWorldY, bgWorldW, bgWorldH, 6 * invScale);
      hoverBgGfx.fill({ color: 0x06060c, alpha: 0.95 });
      hoverBgGfx.stroke({ width: 2 * invScale, color: 0x00d4ff, alpha: 0.8 });

      hoverLabel.position.set(closestCandidate.ptX, closestCandidate.ptY - 14 * invScale);
      hoverLabel.scale.set(invScale);
      hoverLabel.tint = 0x00d4ff;
      hoverLabel.visible = true;
    }
  }
}

// â”€â”€â”€ Toggle Functions â”€â”€â”€

function toggleGrid() {
  studioState.gridVisible = !studioState.gridVisible;
  gridGfx.visible = studioState.gridVisible;
  return studioState.gridVisible;
}

function toggleLabels() {
  // We'll leave _showLabels local to PixiJS for now unless asked
  _showLabels = !_showLabels;
  annotationsContainer.visible = _showLabels;
  return _showLabels;
}

function setLabelsEnabled(enabled) {
  _showLabels = enabled;
  annotationsContainer.visible = enabled;
}

function isLabelsEnabled() {
  return _showLabels;
}

function getLayerColor(layerIndex) {
  return LAYER_PALETTE[layerIndex % LAYER_PALETTE.length];
}

function getPalette() {
  return LAYER_PALETTE;
}

export const PixiRenderer = {
  init,
  getApp,
  getScreenSize,
  setBackgroundImage,
  getBackgroundDisplaySize,
  updateViewport,
  rebuildGeoJSON,
  rebuildNightMask,
  rebuildDayMask,
  rebuildTerminator,
  rebuildGrid,
  rebuildLimbGlow,
  rebuildAnchors,
  rebuildPivotAnchor,
  rebuildAnnotations,
  updateAnnotationsTransform,
  toggleGrid,
  toggleLabels,
  setLabelsEnabled,
  showLabels: isLabelsEnabled,
  getLayerColor,
  getPalette
};
