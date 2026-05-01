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
import { GlowFilter, ConvolutionFilter, AdjustmentFilter } from 'pixi-filters';
import { GeoJSON } from './geojson.js';
import { Transform } from './transform.js';
import { Anchors } from './anchors.js';
import { GRID, LABELS, CULLING, RENDER, EMERGENCY, LAYER_PALETTE, configEvents } from './config.js';
import { moonState } from '../stores/moonState.svelte.js';
import { uiState } from '../stores/uiState.svelte.js';
import { viewportState } from '../stores/viewportState.svelte.js';
import { studioState } from '../stores/studioState.svelte.js';
import { layerState } from '../stores/layerState.svelte.js';

// Cache for reactive redraws
let _lastProjectedFeatures = null;
let _lastVp = null;
let _lastTransformFn = null;
let _lastLodLevel = 0;
let _currentHoveredCrater = null;

// Scene graph references
let app = null;
let viewportContainer, geojsonContainer, annotationsContainer, labelsContainer;
let bgSprite = null;
let nightMaskContainer, nightMaskGfx, nightMaskClip;
let nightMaskBlurFilter = null;
let dayMaskContainer, dayMaskGfx, dayMaskClip;
let dayMaskBlurFilter = null;
let terminatorGfx, gridGfx, limbGlowGfx, anchorsGfx, dotsGfx;
let moonBackdropGfx;
let labelsBgGfx;
let hoverContainer, hoverBgGfx, hoverLabel;
let activeLabels = []; // Will now hold Containers
let layerGraphicsMap = new Map(); // Store PIXI.Graphics objects indexed by layerIndex
let textPool = []; // Will now hold Containers { bg, text }

// Studio filters cache
let _studioAdjustment = null;
let _studioSharpen = null;
let _studioDenoise = null;
let _studioVignetteSprite = null; // Use a sprite for vignette fallback


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

  const _app = new PIXI.Application();

  // Register advanced blend modes
  PIXI.extensions.add(
    PIXI.OverlayBlend, PIXI.ColorBurnBlend, PIXI.ColorDodgeBlend, PIXI.DarkenBlend, 
    PIXI.DifferenceBlend, PIXI.ExclusionBlend, PIXI.HardLightBlend, PIXI.LightenBlend, PIXI.SoftLightBlend
  );

  await _app.init({
    preference: 'webgl',
    backgroundAlpha: 0,
    resizeTo: window,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  // Canvas inherits positioning from #pixi-container (fixed in CSS)
  _app.canvas.id = 'main-canvas';

  container.appendChild(_app.canvas);

  // Build scene tree
  viewportContainer = new PIXI.Container();
  _app.stage.addChild(viewportContainer);

  moonBackdropGfx = new PIXI.Graphics();
  viewportContainer.addChild(moonBackdropGfx);

  bgSprite = new PIXI.Sprite();
  bgSprite.visible = false;
  bgSprite.mask = null;
  viewportContainer.addChild(bgSprite);

  geojsonContainer = new PIXI.Container();
  viewportContainer.addChild(geojsonContainer);



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

  dotsGfx = new PIXI.Graphics();
  annotationsContainer.addChild(dotsGfx);

  // Groupe Textes + Fonds (pour fondu indÃ©pendant)
  labelsContainer = new PIXI.Container();
  annotationsContainer.addChild(labelsContainer);

  labelsBgGfx = new PIXI.Graphics();
  labelsContainer.addChild(labelsBgGfx);

  // Global Hover UI (for popups)
  hoverContainer = new PIXI.Container();
  annotationsContainer.addChild(hoverContainer);

  hoverBgGfx = new PIXI.Graphics();
  hoverContainer.addChild(hoverBgGfx);

  hoverLabel = new PIXI.BitmapText({
    text: '',
    style: { fontFamily: 'Space Grotesk Bold', fontSize: 14, align: 'center' }
  });
  hoverLabel.anchor.set(0.5, 1);
  hoverLabel.visible = false;
  hoverContainer.addChild(hoverLabel);

  // Live Config Update Listeners
  configEvents.addEventListener('configChanged', (e) => {
    const { section, key } = e.detail;
    if (section === 'RENDER') {
      redrawAllLayers();
    } else if (section === 'GRID') {
      redrawGrid();
    }
  });

  app = _app; // NOW EXPOSE THE INITIALIZED APP
  return app;
}

function redrawAllLayers() {
  if (_lastProjectedFeatures && _lastVp) {
    rebuildGeoJSON(_lastProjectedFeatures, _lastVp);
  }
  if (_lastTransformFn && _lastVp) {
    rebuildMoonMask(_lastTransformFn);
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
  return (app && app.renderer) ? app : null;
}



/**
 * Set the background moon image from an HTMLImageElement.
 */
function setBackgroundImage(htmlImage, canvasW, canvasH) {
  const texture = PIXI.Texture.from(htmlImage);
  bgSprite.texture = texture;

  // Contain image within canvas
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
  
  // Use anchor 0.5 for perfect rotation/flip around center
  bgSprite.anchor.set(0.5);
  bgSprite.x = canvasW / 2;
  bgSprite.y = canvasH / 2;
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
 * Also updates the contentContainer for Studio rotation/flip centered on image.
 */
function updateViewport(vp) {
  if (!viewportContainer) return;
  const isStudio = uiState.currentPhase !== 'ALIGN';
  
  if (isStudio && bgSprite && bgSprite.visible) {
    const s = studioState;
    
    // THE Axis of rotation/flip is the geometric center of the photo
    const cx = bgSprite.x; 
    const cy = bgSprite.y;
    
    viewportContainer.pivot.set(cx, cy);
    
    // Adjust position to compensate for the pivot shift.
    // Stage = (World - Pivot) * Scale + Position
    // We want World=cx to land at screen point (tx + cx*scale)
    viewportContainer.position.set(
      vp.tx + cx * vp.scale, 
      vp.ty + cy * vp.scale
    );
    
    // Apply Global Studio Transforms
    viewportContainer.rotation = s.rotation * (Math.PI / 180);
    viewportContainer.scale.set(
      vp.scale * (s.flipH ? -1 : 1),
      vp.scale * (s.flipV ? -1 : 1)
    );
  } else {
    // Normal Navigation (Pivot 0,0)
    viewportContainer.pivot.set(0, 0);
    viewportContainer.position.set(vp.tx, vp.ty);
    viewportContainer.scale.set(vp.scale);
    viewportContainer.rotation = 0;
  }
}

/**
 * Apply Studio image adjustments to the background sprite.
 * Only affects bgSprite, not layers.
 */
function applyStudioAdjustments() {
  if (!bgSprite || !bgSprite.visible) return;

  const s = studioState;
  const filters = [];

  // --- 1. Brightness, Contrast & Saturation (AdjustmentFilter) ---
  // Using AdjustmentFilter instead of ColorMatrix to avoid "stepping on each other"
  if (s.brightness !== 1.0 || s.contrast !== 1.0 || s.grayscale) {
    if (!_studioAdjustment) _studioAdjustment = new AdjustmentFilter();
    
    _studioAdjustment.brightness = s.brightness;
    _studioAdjustment.contrast = s.contrast;
    // For grayscale later (desaturate if s.grayscale is true)
    _studioAdjustment.saturation = s.grayscale ? 0 : 1;
    
    filters.push(_studioAdjustment);
  }

  // --- 2. Sharpness & Clarity (Convolution) ---
  if (s.sharpness > 0 || s.clarity !== 0.0) {
    if (!_studioSharpen) {
      _studioSharpen = new ConvolutionFilter({
        matrix: [0, 0, 0, 0, 1, 0, 0, 0, 0],
        width: bgSprite.width,
        height: bgSprite.height
      });
    }
    
    // Softer sharpness progression
    const kS = s.sharpness * 0.4; 
    // Clarity as a slight contrast boost in the kernel
    const kC = s.clarity * 0.2;
    
    const k = kS + kC;
    _studioSharpen.matrix = [
      0, -k, 0,
      -k, 1 + 4*k, -k,
      0, -k, 0
    ];
    
    filters.push(_studioSharpen);
  }

  // --- 3. Denoising (Blur) ---
  if (s.denoising > 0) {
    if (!_studioDenoise) _studioDenoise = new PIXI.BlurFilter();
    _studioDenoise.strength = s.denoising * 1.5;
    filters.push(_studioDenoise);
  }

  // --- 4. Vignetting (Custom Implementation) ---
  if (s.vignette > 0) {
    if (!_studioVignetteSprite) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      const grad = ctx.createRadialGradient(512, 512, 0, 512, 512, 512);
      
      // More aggressive gradient
      grad.addColorStop(0, 'white'); 
      grad.addColorStop(0.2, 'white'); 
      grad.addColorStop(0.8, 'black'); // Total black earlier
      grad.addColorStop(1, 'black');
      
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 1024);
      
      const texture = PIXI.Texture.from(canvas);
      _studioVignetteSprite = new PIXI.Sprite(texture);
      _studioVignetteSprite.anchor.set(0.5);
      _studioVignetteSprite.blendMode = 'multiply'; // Real vignette feel
      bgSprite.parent.addChildAt(_studioVignetteSprite, bgSprite.parent.getChildIndex(bgSprite) + 1);
    }
    
    _studioVignetteSprite.visible = true;
    _studioVignetteSprite.x = bgSprite.x;
    _studioVignetteSprite.y = bgSprite.y;
    
    // Scale controls "Radius" 
    // We must ensure corners are covered (1.42), but we want it closer
    const minScale = 1.2; // A bit smaller than corners to allow "hard" vignette
    const spread = minScale + (s.vignetteFeather * 0.8); // 1.2 to 2.0 range
    _studioVignetteSprite.width = bgSprite.width * spread;
    _studioVignetteSprite.height = bgSprite.height * spread;
    
    // Intensity
    _studioVignetteSprite.alpha = s.vignette;
  } else if (_studioVignetteSprite) {
    _studioVignetteSprite.visible = false;
  }

  bgSprite.filters = filters.length > 0 ? filters : null;
}

/**
 * Enable or disable the circular background mask (used to hide stars behind the grid).
 */
function setMoonMaskEnabled(enabled) {
  if (moonBackdropGfx) {
    moonBackdropGfx.visible = enabled;
  }
}

// ─── GeoJSON Rendering ───

/**
 * Rebuild all GeoJSON layer graphics from projected feature data.
 * Called only when data changes (dirty flag), not every frame.
 */
function rebuildGeoJSON(projectedFeatures, vp) {
  if (!geojsonContainer || !app) return;
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
    
    const isStudio = uiState.currentPhase !== 'ALIGN';

    // Apply Blend Mode
    const blendModeStr = (isStudio && layerName) ? (studioState.layerBlendMode[layerName] ?? 'normal') : 'normal';
    gfx.blendMode = blendModeStr;

    const colorIdx = (isStudio && layerName) ? (studioState.layerColor[layerName] ?? layerIndex) : layerIndex;
    const colors = LAYER_PALETTE[colorIdx % LAYER_PALETTE.length];
    const opacity = (isStudio && layerName) ? (studioState.layerOpacity[layerName] ?? 1.0) : 1.0;
    const fine = (isStudio && layerName) ? (studioState.layerFine[layerName] ?? 1.5) : 1.5;
    const isSmooth = (isStudio && layerName) ? (studioState.layerSmooth[layerName] ?? false) : false;
    const glow = (isStudio && layerName) ? (studioState.layerGlow[layerName] ?? 0.0) : 0.0;
    const blur = (isStudio && layerName) ? (studioState.layerBlur[layerName] ?? 0.0) : 0.0;

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

      const activeFilters = [];
      if (glow > 0 && (hasPolys || hasLines)) {
        activeFilters.push(new GlowFilter({ 
          distance: glow * 12, 
          outerStrength: 2, 
          innerStrength: 0, 
          color: colors.stroke, 
          quality: 0.5 
        }));
      }
      if (blur > 0) {
        activeFilters.push(new PIXI.BlurFilter({ strength: blur }));
      }
      gfx.filters = activeFilters.length > 0 ? activeFilters : null;

    } else {
      // â”€â”€â”€ Z-INDEX GLOW METHOD (Fast Path, High Performance) â”€â”€â”€
      const activeFilters = [];
      if (blur > 0) {
        activeFilters.push(new PIXI.BlurFilter({ strength: blur }));
      }
      gfx.filters = activeFilters.length > 0 ? activeFilters : null;

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

// ─── Moon Mask ───

function rebuildMoonMask(transformFn) {
  if (!moonBackdropGfx || !app) return;
  moonBackdropGfx.clear();
  
  // Get horizon shape from grid cache (independent of spacing)
  const cache = _getGridCache(10);
  const hb = cache.horizonNorm;
  
  let moved = false;
  for (let i = 0; i < hb.length; i += 2) {
    const pt = transformFn(hb[i], hb[i+1]);
    if (!moved) {
      moonBackdropGfx.moveTo(pt.x, pt.y);
      moved = true;
    } else {
      moonBackdropGfx.lineTo(pt.x, pt.y);
    }
  }
  
  // Le fond plein pour cacher les étoiles physiquement derrière la lune (pendant IMPORT)
  moonBackdropGfx.fill({ color: 0x06060c, alpha: 1.0 });
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

/**
 * Extract the contiguous visible arc from the terminator projection cache.
 * Shared by nightMask, dayMask, limbGlow.
 * @returns {{ visiblePoints, first, last } | null}
 */
function _getVisibleTerminatorArc() {
  const projCache = _getTerminatorProjections();
  if (!projCache) return null;

  const pts = projCache.projNorm;
  const n = pts.length;

  // Find the first visible point whose predecessor is null (arc start boundary)
  let startIdx = 0;
  let found = false;
  for (let i = 0; i < n; i++) {
    if (pts[i] !== null && pts[(i - 1 + n) % n] === null) {
      startIdx = i; found = true; break;
    }
  }
  if (!found) {
    startIdx = pts.findIndex(p => p !== null);
    if (startIdx === -1) return null;
  }

  const visiblePoints = [];
  for (let i = 0; i < n; i++) {
    const p = pts[(startIdx + i) % n];
    if (p !== null) visiblePoints.push(p);
    else if (visiblePoints.length > 0) break;
  }

  if (visiblePoints.length < 2) return null;
  return { visiblePoints, first: visiblePoints[0], last: visiblePoints[visiblePoints.length - 1] };
}

/**
 * Determine if a given angle on the disc midpoint falls on the night side.
 * Uses inverse projection with fallback at reduced radius.
 * @param {number} aMid - Angle in radians from disc center
 * @returns {boolean}
 */
function _isNightSide(aMid) {
  const state = moonState;
  const DEG2RAD = Math.PI / 180;
  const sLon = state.sunLon * DEG2RAD;
  const sLat = (state.sunLat || 0) * DEG2RAD;
  const cosSLat = Math.cos(sLat), sinSLat = Math.sin(sLat);
  const cosSLon = Math.cos(sLon), sinSLon = Math.sin(sLon);

  for (const r of [0.49, 0.45]) {
    const nx = 0.5 + r * Math.cos(aMid);
    const ny = 0.5 + r * Math.sin(aMid);
    const geo = GeoJSON.inverseProject(nx, ny);
    if (geo) {
      const gLon = geo.lon * DEG2RAD, gLat = geo.lat * DEG2RAD;
      const dot = Math.cos(gLat) * Math.cos(gLon) * cosSLat * cosSLon +
                  Math.cos(gLat) * Math.sin(gLon) * cosSLat * sinSLon +
                  Math.sin(gLat) * sinSLat;
      return dot < 0;
    }
  }
  return false;
}

/**
 * Close a mask shape along the lunar disc edge (CW or CCW arc).
 * @param {PIXI.Graphics[]} gfxList - Graphics objects to draw on simultaneously
 * @param {Function} transformFn - Normalized → world coordinate transform
 * @param {number} aLast - Angle of last visible terminator point
 * @param {number} aFirst - Angle of first visible terminator point
 * @param {boolean} closeCW - true = sweep CW (aLast→aFirst), false = sweep CCW
 * @param {number} [steps=40] - Number of arc segments
 */
function _closeArcOnDisc(gfxList, transformFn, aLast, aFirst, closeCW, steps = 40) {
  if (closeCW) {
    let diff = aFirst - aLast;
    if (diff < 0) diff += Math.PI * 2;
    for (let i = 1; i <= steps; i++) {
      const a = aLast + diff * (i / steps);
      const pt = transformFn(0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a));
      for (const gfx of gfxList) gfx.lineTo(pt.x, pt.y);
    }
  } else {
    let diffCCW = aLast - aFirst;
    if (diffCCW < 0) diffCCW += Math.PI * 2;
    for (let i = 1; i <= steps; i++) {
      const a = aLast - diffCCW * (i / steps);
      const pt = transformFn(0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a));
      for (const gfx of gfxList) gfx.lineTo(pt.x, pt.y);
    }
  }
}

/**
 * Apply glow and/or blur filters to a Graphics object (shared pattern).
 * @param {PIXI.Graphics} gfx
 * @param {{ glow?: number, glowColor?: number, blur?: number }} opts
 */
function _applyFilters(gfx, { glow = 0, glowColor = 0xffffff, blur = 0 } = {}) {
  const filters = [];
  if (glow > 0) {
    filters.push(new GlowFilter({ distance: glow * 12, outerStrength: 2, innerStrength: 0, color: glowColor, quality: 0.5 }));
  }
  if (blur > 0) {
    filters.push(new PIXI.BlurFilter({ strength: blur }));
  }
  gfx.filters = filters.length > 0 ? filters : null;
}

function rebuildNightMask(transformFn) {
  if (!nightMaskGfx || !app) return;
  try {
    _lastTransformFn = transformFn;
    nightMaskGfx.clear();
    nightMaskClip.clear();

    const isStudio = uiState.currentPhase !== 'ALIGN';
    const showMask = isStudio ? studioState.nightMaskVisible : true;
    if (!showMask) {
      nightMaskContainer.visible = false;
      return;
    }
    nightMaskContainer.visible = true;

    const arc = _getVisibleTerminatorArc();
    if (!arc) return;
    const { visiblePoints, first, last } = arc;

    // Trace the terminator curve on both graphics
    const gfxPair = [nightMaskGfx, nightMaskClip];
    let moved = false;
    for (const p of visiblePoints) {
      const pt = transformFn(p[0], p[1]);
      if (!moved) { 
        for (const gfx of gfxPair) gfx.moveTo(pt.x, pt.y);
        moved = true; 
      } else { 
        for (const gfx of gfxPair) gfx.lineTo(pt.x, pt.y);
      }
    }

    // Determine night side and close along it
    const cx = 0.5, cy = 0.5;
    const aLast = Math.atan2(last[1] - cy, last[0] - cx);
    const aFirst = Math.atan2(first[1] - cy, first[0] - cx);
    let diff = aFirst - aLast;
    if (diff < 0) diff += Math.PI * 2;
    const aMid = aLast + diff / 2;
    const isNight1 = _isNightSide(aMid);

    // Close arc through the night side
    _closeArcOnDisc(gfxPair, transformFn, aLast, aFirst, isNight1);

    for (const gfx of gfxPair) gfx.closePath();

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
      // The blur spills into both sides. The clip mask perfectly cuts it off at the day side.
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
  if (!dayMaskGfx || !app) return;
  try {
    _lastTransformFn = transformFn;
    dayMaskGfx.clear();
    dayMaskClip.clear();
    const isStudio = uiState.currentPhase !== 'ALIGN';
    const showMask = isStudio ? studioState.dayMaskVisible : false;
    if (!showMask) {
      dayMaskContainer.visible = false;
      return;
    }
    dayMaskContainer.visible = true;

    const arc = _getVisibleTerminatorArc();
    if (!arc) return;
    const { visiblePoints, first, last } = arc;

    // Trace the terminator curve on both graphics
    const gfxPair = [dayMaskGfx, dayMaskClip];
    let moved = false;
    for (const p of visiblePoints) {
      const pt = transformFn(p[0], p[1]);
      if (!moved) {
        for (const gfx of gfxPair) gfx.moveTo(pt.x, pt.y);
        moved = true;
      } else {
        for (const gfx of gfxPair) gfx.lineTo(pt.x, pt.y);
      }
    }

    // Determine night side; close along the DAY side (inverse)
    const cx = 0.5, cy = 0.5;
    const aLast = Math.atan2(last[1] - cy, last[0] - cx);
    const aFirst = Math.atan2(first[1] - cy, first[0] - cx);
    let diff = aFirst - aLast;
    if (diff < 0) diff += Math.PI * 2;
    const aMid = aLast + diff / 2;
    const isNight1 = _isNightSide(aMid);

    // Close arc through the day side (inverted from night mask)
    _closeArcOnDisc(gfxPair, transformFn, aLast, aFirst, !isNight1);

    for (const gfx of gfxPair) gfx.closePath();

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
  if (!terminatorGfx || !app) return;
  _lastTransformFn = transformFn;
  _lastVp = vp;
  terminatorGfx.clear();

  const isStudio = uiState.currentPhase !== 'ALIGN';
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
  const termBlur = isStudio ? studioState.terminatorBlur : 0.0;
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
    _applyFilters(terminatorGfx, { glow: termGlow, glowColor: termColor, blur: termBlur });

  } else {
    _applyFilters(terminatorGfx, { blur: termBlur });

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
  if (!gridGfx || !app) return;
  _lastTransformFn = transformFn;
  _lastVp = vp;
  _lastLodLevel = lodLevel;

  const isStudio = uiState.currentPhase !== 'ALIGN';
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
  const gridBlur = isStudio ? studioState.gridBlur : 0.0;
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
    
    _applyFilters(gridGfx, { glow: gridGlow, glowColor: gridColor, blur: gridBlur });

  } else {
    _applyFilters(gridGfx, { blur: gridBlur });

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

// --- Limb Glow (aesthetic day-side edge glow) ---

let _limbGlowBlurFilter = null;

function rebuildLimbGlow(transformFn, vp) {
  if (!limbGlowGfx || !app) return;
  _lastTransformFn = transformFn;
  _lastVp = vp;
  limbGlowGfx.clear();

  const isStudio = uiState.currentPhase !== 'ALIGN';
  if (!isStudio || !studioState.limbGlow || studioState.limbGlowIntensity <= 0) {
    limbGlowGfx.visible = false;
    return;
  }
  limbGlowGfx.visible = true;

  const opacity = studioState.limbGlowOpacity;
  const thickness = studioState.limbGlowThickness;
  const spread = studioState.limbGlowSpread;
  const blur = studioState.limbGlowBlur;
  const invScale = 1 / vp.scale;

  // ── Determine day-side arc boundaries ──
  let dayArcStart = 0;
  let dayArcSweep = Math.PI * 2; // fallback: full circle

  const arc = _getVisibleTerminatorArc();
  if (arc) {
    const { first, last } = arc;
    const cx = 0.5, cy = 0.5;
    const aLast = Math.atan2(last[1] - cy, last[0] - cx);
    const aFirst = Math.atan2(first[1] - cy, first[0] - cx);

    let diff = aFirst - aLast;
    if (diff < 0) diff += Math.PI * 2;
    const aMid = aLast + diff / 2;
    const isNight1 = _isNightSide(aMid);

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
    if (typeof limbGlowGfx.beginPath === 'function') limbGlowGfx.beginPath();
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
    _limbGlowBlurFilter.padding = blur * 10 + 100;
    
    limbGlowGfx.filters = [_limbGlowBlurFilter];
  } else {
    limbGlowGfx.filters = null;
  }
}


function rebuildAnchors(anchorsData, vp, activeAnchorId) {
  if (!anchorsGfx || !app) return;
  anchorsGfx.clear();
  if (anchorsData.length === 0 || uiState.currentPhase !== 'ALIGN') return;

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
  if (!anchorsGfx || !app) return;
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
  if (!annotationsContainer || !app) return;
  if (!_showLabels || !cratersDB || cratersDB.length === 0) {
    annotationsContainer.visible = false;
    return;
  }
  annotationsContainer.visible = true;

  dotsGfx.clear();
  labelsBgGfx.clear();

  const isStudio = uiState.currentPhase !== 'ALIGN';
  const s = studioState;
  const invScale = 1 / vp.scale;
  const fontSizeRatio = s.labelFontSize / 14;
  const globalRot = isStudio ? s.rotation * (Math.PI / 180) : 0;
  const globalFlipH = isStudio && s.flipH;
  const globalFlipV = isStudio && s.flipV;

  // Move current labels to pool
  for (const label of activeLabels) {
    label.visible = false;
    label.alpha = 0; // Absolute safety
    textPool.push(label);
  }
  activeLabels = [];
  _activeLabelMap.clear();
  labelsBgGfx.clear();

  const MAX_LABELS = studioState.labelCount;
  const MAX_DOTS = Math.min(1000, Math.max(100, MAX_LABELS * 2));

  const cx = canvasW / 2;
  const cy = canvasH / 2;
  const maxScreenDistSq = cx * cx + cy * cy;

  _allVisibleCraterPoints.length = 0;
  _dotCandidates.length = 0;
  const _pinnedCandidates = []; // Nouveau réservoir pour les prioritaires
  _candidates.length = 0;
  _placedBoxes.length = 0;

  // Passe 1 : Collecter et trier tous les cratÃ¨res visibles dans le champ
  for (const crater of cratersDB) {
    if (crater.name === "--" || crater.nx === null) continue;

    const pt = transformFn(crater.nx, crater.ny);
    const ptX = pt.x, ptY = pt.y; // Copy from scratch object
    const g = viewportContainer.toGlobal(new PIXI.Point(ptX, ptY));
    const sx = g.x;
    const sy = g.y;

    const isPinned = studioState.pinnedCraters.has(crater.name);

    // Frustum Culling généreux (On le garde même si pinned, pour ne pas saturer si c'est loin)
    if (!isPinned && (sx < -200 || sx > canvasW + 200 || sy < -200 || sy > canvasH + 200)) continue;

    // ─── Filtrage par taille (diamètre) ───
    if (!isPinned && (crater.diameter < studioState.labelMinSize || crater.diameter > studioState.labelMaxSize)) continue;

    // ─── Filtrage par Type ───
    if (!isPinned && (studioState.labelHiddenTypes && studioState.labelHiddenTypes.has(crater.type))) continue;

    if (isPinned) {
      _pinnedCandidates.push({ crater, ptX, ptY, sx, sy, isPinned });
    } else {
      _dotCandidates.push({ crater, ptX, ptY, sx, sy, isPinned });
    }
  }

  // cratersDB est déjà trié par diamètre décroissant à l'init.
  // On construit la liste finale : Pinned d'abord, puis les meilleurs auto-dots.
  const combinedDots = [..._pinnedCandidates, ..._dotCandidates.slice(0, MAX_DOTS)];
  const dotsCount = combinedDots.length;
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

  // To keep icons upright on screen, we need to apply the inverse of the parent's flip/rotation
  const iconCompRot = (globalFlipH !== globalFlipV) ? globalRot : -globalRot;
  const iconCompFH = globalFlipH ? -1 : 1;
  const iconCompFV = globalFlipV ? -1 : 1;
  const cosIco = Math.cos(iconCompRot);
  const sinIco = Math.sin(iconCompRot);

  // Passe 2 : Dessiner le Top N des plus gros cratÃ¨res de la zone
  for (let i = 0; i < dotsCount; i++) {
    const item = combinedDots[i];
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

    if (item.isPinned && op < 0.5) op = 0.5; // Ensure pinned labels are always visible
    if (op < 0.05 && !item.isPinned) continue;

    // Rayon bornÃ© entre 2.0 et 3.0 via sqrt
    const onScreenRadius = Math.max(LABELS.dotRadiusMin, Math.min(LABELS.dotRadiusMax, Math.sqrt(crater.diameter * vp.scale) * LABELS.dotRadiusScale));
    const baseR = onScreenRadius / vp.scale;
    const type = crater.type;

    // Local transform helper for icon points
    const tr = (dx, dy) => {
      let x = dx * iconCompFH;
      let y = dy * iconCompFV;
      const rx = x * cosIco - y * sinIco;
      const ry = x * sinIco + y * cosIco;
      return { x: ptX + rx, y: ptY + ry };
    };

    if (type === 'Mons, montes') {
      // Montagne (Triangle) - Neon Pink
      const r = baseR * 2.5;
      const p1 = tr(0, -r), p2 = tr(r, r), p3 = tr(-r, r);
      dotsGfx.poly([p1.x, p1.y, p2.x, p2.y, p3.x, p3.y]);
      dotsGfx.fill({ color: 0xFF4081, alpha: op });
    } else if (type === 'Mare, maria' || type === 'Oceanus, oceani' || type === 'Sinus, sinÅ«s' || type === 'Lacus, lacÅ«s' || type === 'Palus, paludes') {
      // Vague (Wave) - Electric Cyan
      const r = baseR * 2.5;
      const p1 = tr(-r, 0), p2 = tr(-r/2, -r), p3 = tr(0, 0), p4 = tr(r/2, r), p5 = tr(r, 0);
      dotsGfx.moveTo(p1.x, p1.y);
      dotsGfx.quadraticCurveTo(p2.x, p2.y, p3.x, p3.y);
      dotsGfx.quadraticCurveTo(p4.x, p4.y, p5.x, p5.y);
      dotsGfx.stroke({ width: 1.5 / vp.scale, color: 0x00E5FF, alpha: op });
    } else if (type === 'Statio') {
      // IcÃ´ne "Satellite Dish" - Neon Green
      const s = baseR * 0.4;
      const px = (x, y) => tr((x - 12) * s, (y - 12) * s);

      // Bras du rÃ©cepteur
      const b1 = px(9, 15), b2 = px(12, 12);
      dotsGfx.moveTo(b1.x, b1.y);
      dotsGfx.lineTo(b2.x, b2.y);
      dotsGfx.stroke({ width: 1.5 / vp.scale, color: 0x00FF88, alpha: op });

      // Onde interne (Arc approximated by points since tr() doesn't support arc natively)
      const center = px(11, 13);
      const startAngle = -Math.PI/2 + iconCompRot;
      const endAngle = 0 + iconCompRot;
      // We flip the sweep if handedness is different
      const sweep = (iconCompFH !== iconCompFV) ? -Math.PI/2 : Math.PI/2;
      
      dotsGfx.moveTo(px(11, 7).x, px(11, 7).y); // This point is already tr'd via px
      // PIXI.Graphics.arc() doesn't handle non-identity parent well if we want screen-upright
      // so we use simple arc command with transformed angles
      dotsGfx.arc(center.x, center.y, 6 * s, startAngle, startAngle + sweep, sweep < 0);
      dotsGfx.stroke({ width: 1.5 / vp.scale, color: 0x00FF88, alpha: op });

      // Onde externe
      dotsGfx.moveTo(px(11, 3).x, px(11, 3).y);
      dotsGfx.arc(center.x, center.y, 10 * s, startAngle, startAngle + sweep, sweep < 0);
      dotsGfx.stroke({ width: 1.5 / vp.scale, color: 0x00FF88, alpha: op });

      // Parabole
      const v1 = px(4, 10), v2 = px(4, 20), v3 = px(14, 20);
      dotsGfx.moveTo(v1.x, v1.y);
      dotsGfx.quadraticCurveTo(v2.x, v2.y, v3.x, v3.y);
      dotsGfx.lineTo(v1.x, v1.y);
      dotsGfx.fill({ color: 0x00FF88, alpha: op });
    } else {
      // CratÃ¨re classique (Point)
      const isSpecial = type.startsWith('Mont') || type.startsWith('Promontorium') || type.startsWith('Vallis') || type.startsWith('Catena');
      
      if (isSpecial || studioState.labelPointVisible) {
        const pColor = isSpecial ? 0xffffff : LAYER_PALETTE[studioState.labelColorPoints % LAYER_PALETTE.length].stroke;
        const pOp = isSpecial ? op : op * studioState.labelPointOpacity;
        const pShape = isSpecial ? 'circle' : studioState.labelPointShape;
        const finalR = baseR * (isSpecial ? 1.0 : studioState.labelPointSize);

        if (pShape === 'square') {
          const p1 = tr(-finalR, -finalR), p2 = tr(finalR, -finalR), p3 = tr(finalR, finalR), p4 = tr(-finalR, finalR);
          dotsGfx.poly([p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y]);
          dotsGfx.fill({ color: pColor, alpha: pOp });
        } else if (pShape === 'ring') {
          dotsGfx.circle(ptX, ptY, finalR); // Circle is rotation invariant
          dotsGfx.stroke({ width: 1.5 / vp.scale, color: pColor, alpha: pOp });
        } else if (pShape === 'cross') {
          const s = finalR * 1.2;
          const h1 = tr(-s, 0), h2 = tr(s, 0), v1 = tr(0, -s), v2 = tr(0, s);
          dotsGfx.moveTo(h1.x, h1.y); dotsGfx.lineTo(h2.x, h2.y);
          dotsGfx.moveTo(v1.x, v1.y); dotsGfx.lineTo(v2.x, v2.y);
          dotsGfx.stroke({ width: 2.0 / vp.scale, color: pColor, alpha: pOp });
        } else {
          // Circle
          dotsGfx.circle(ptX, ptY, finalR);
          dotsGfx.fill({ color: pColor, alpha: pOp });
        }
      }
    }

    // Filters for Points (Glow/Blur)
    const pointFilters = [];
    if (studioState.labelPointBlur > 0) {
      pointFilters.push(new PIXI.BlurFilter({ strength: studioState.labelPointBlur }));
    }
    if (studioState.labelPointGlow > 0) {
      pointFilters.push(new GlowFilter({
        distance: studioState.labelPointGlow,
        outerStrength: 2,
        color: LAYER_PALETTE[studioState.labelColorPoints % LAYER_PALETTE.length].stroke,
        quality: 0.1
      }));
    }
    dotsGfx.filters = pointFilters.length ? pointFilters : null;

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

    // Strict Culling des labels sur le bord véritable de l'écran
    if (!item.isPinned && (boxX < 0 || boxX + textWidth > canvasW || boxY < 0 || boxY + textHeight > canvasH)) continue;

    const dx = sx - cx;
    const dy = sy - cy;
    const distSq = dx * dx + dy * dy;
    const normalizedDist = Math.max(0, Math.min(1, Math.sqrt(distSq / maxScreenDistSq)));
    
    // Le score de base dépend du diamètre et de la proximité du centre
    let score = (crater.diameter * vp.scale) * (1.0 - (normalizedDist * 0.8));
    
    if (item.isPinned) {
      score += 1000000; // Pinned priority
    } else {
      // Boost majeur pour les Statio afin qu'elles s'affichent toujours
      if (type === 'Statio') score += 10000;
      // Léger bonus pour les Mers/Montagnes pour les privilégier aux petits cratères
      else if (type !== 'Crater, craters' && type !== 'Satellite Feature') score += 10 * vp.scale;
    }

    _candidates.push({ crater, ptX, ptY, sx, sy, op, score, boxX, boxY, textWidth, textHeight, isPinned: item.isPinned });
  }

  // Tri par prioritÃ© dÃ©croissante
  _candidates.sort((a, b) => b.score - a.score);



  let autoLabelsCount = 0;
  for (const item of _candidates) {
    const isPinned = item.isPinned;
    if (!isPinned && autoLabelsCount >= MAX_LABELS) continue;

    // HITBOX INVISIBLE : Force les labels Ã  s'Ã©carter les uns des autres
    const pad = 12; // Réduit pour permettre une plus haute densité
    
    // Adjust text width based on target font size
    const adjustedTextWidth = item.textWidth * fontSizeRatio;
    const adjustedTextHeight = item.textHeight * fontSizeRatio;

    const hitX = item.boxX - pad;
    const hitY = item.boxY - pad;
    const hitW = adjustedTextWidth + pad * 2;
    const hitH = adjustedTextHeight + pad * 2;

    // Anti-Overlap sur la Hitbox gÃ©ante
    let overlap = false;
    for (const box of _placedBoxes) {
      if (hitX < box.x + box.w && hitX + hitW > box.x &&
        hitY < box.y + box.h && hitY + hitH > box.y) {
        overlap = true;
        break;
      }
    }
    if (overlap && !isPinned) continue;

    if (!isPinned) autoLabelsCount++;

    // Validation (on rÃ©serve tout ce grand espace vide)
    _placedBoxes.push({ x: hitX, y: hitY, w: hitW, h: hitH });

    // Get a label container from pool
    let container = textPool.pop();
    
    // Si on a un container mais que le type de texte ne correspond pas au mode HQ/SQ, on le recrÃ©e
    if (container) {
      const isText = container._text instanceof PIXI.Text;
      if (isText !== studioState.labelHQ) {
        container.removeChild(container._text);
        container._text.destroy();
        container._text = null;
      }
    }

    if (!container || !container._text) {
      if (!container) container = new PIXI.Container();
      
      if (!container._bg) {
        const bg = new PIXI.Graphics();
        container.addChild(bg);
        container._bg = bg;
      }
      
      let text;
      if (studioState.labelHQ) {
        text = new PIXI.Text({
          text: '',
          style: {
            fontFamily: 'Space Grotesk',
            fontSize: 14,
            fill: 0xffffff,
            fontWeight: '700',
            align: 'center',
          }
        });
      } else {
        text = new PIXI.BitmapText({
          text: '',
          style: {
            fontFamily: 'SpaceGrotesk',
            fontSize: 14,
            align: 'center',
          }
        });
      }
      text.anchor.set(0.5, 1);
      container.addChild(text);
      container._text = text;
      
      labelsContainer.addChild(container);
    }

    const { _bg: bg, _text: text } = container;
    
    container._worldX = item.ptX;
    container._worldY = item.ptY;
    container._crater = item.crater;
    
    // Initial compensation to avoid flicker/vertical labels on first frame

    container.position.set(item.ptX, item.ptY);
    container.pivot.y = LABELS.labelOffsetY / fontSizeRatio;
    container.scale.set(
      invScale * fontSizeRatio * (globalFlipH ? -1 : 1),
      invScale * fontSizeRatio * (globalFlipV ? -1 : 1)
    );
    container.rotation = (globalFlipH !== globalFlipV) ? globalRot : -globalRot;

    container.visible = true;
    container.alpha = item.op;

    const isSpecialCrater = item.crater.type === 'Statio' || item.crater.type === 'Maria' || item.crater.type.startsWith('Mont');

    text.text = item.crater.name;
    const textColor = LAYER_PALETTE[studioState.labelColorText % LAYER_PALETTE.length].stroke;
    
    // Update Text Style
    if (studioState.labelHQ) {
      text.style.fontFamily = studioState.labelPoliceFont;
      text.style.fontWeight = studioState.labelPoliceWeight.toString();
      text.style.fontSize = studioState.labelFontSize;
    } else {
      text.style.fontFamily = 'SpaceGrotesk';
      text.style.fontSize = studioState.labelFontSize;
    }
    text.tint = textColor;
    text.alpha = studioState.labelPoliceOpacity;
    text.visible = studioState.labelPoliceVisible;

    // Redraw Background
    bg.clear();
    if (studioState.labelFondVisible) {
      const bgW = text.width + (10 + studioState.labelFondSizeX);
      const bgH = text.height + (6 + studioState.labelFondSizeY);
      container._bgW = bgW;
      container._bgH = bgH;
      const bgAlpha = studioState.labelFondOpacity;
      const bgColor = LAYER_PALETTE[studioState.labelFondColor % LAYER_PALETTE.length].stroke;
      const bgRadius = studioState.labelFondRadius;
      bg.roundRect(-bgW / 2, -bgH, bgW, bgH, bgRadius);
      
      bg.fill({ color: bgColor, alpha: bgAlpha });
      
      if (item.isPinned && studioState.labelShowLockHighlight) {
        bg.stroke({ width: 2, color: 0x00E5FF, alpha: 1.0 });
      } else {
        // Supprimé le cerclage par défaut pour éviter les artefacts avec le glow
        bg.stroke({ width: 0 });
      }

      // Filters for background (Glow/Blur)
      if (studioState.labelFondGlow > 0 || studioState.labelFondBlur > 0) {
        const filters = [];
        if (studioState.labelFondBlur > 0) {
          filters.push(new PIXI.BlurFilter({ strength: studioState.labelFondBlur }));
        }
        if (studioState.labelFondGlow > 0) {
          filters.push(new GlowFilter({
            distance: studioState.labelFondGlow * 2,
            outerStrength: 2,
            color: bgColor,
            quality: 0.1 // Performance
          }));
        }
        bg.filters = filters.length ? filters : null;
      } else {
        bg.filters = null;
      }
    } else {
      bg.visible = false;
    }

    activeLabels.push(container);
    _activeLabelMap.set(item.crater, container);
  }

  // FORCE IMMEDIATE TRANSFORM UPDATE to avoid 1-frame ghosting artifacts
  // Using the viewportState from the closure or global if needed
  // We use viewportState directly as it's the source of truth
  updateAnnotationsTransform(_lastVp || viewportState, viewportState.isDragging);
}

/**
 * Lightweight update for labels during zoom/pan.
 * Just updates transforms and scales without full rebuild or dot update.
 */
function updateAnnotationsTransform(vp, isDragging = false, mouseX = -1000, mouseY = -1000) {
  if (!_showLabels) {
    _currentHoveredCrater = null;
    return;
  }
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
  const s = studioState;
  const isStudio = uiState.currentPhase !== 'ALIGN';
  const globalRot = isStudio ? s.rotation * (Math.PI / 180) : 0;
  const globalFlipH = isStudio && s.flipH;
  const globalFlipV = isStudio && s.flipV;

  for (const labelObj of activeLabels) {
    const { _worldX, _worldY } = labelObj;
    
    const verticalOffset = LABELS.labelOffsetY * invScale * (globalFlipV ? -1 : 1);
    
    // Get screen position for culling. We use the offset point to check if the box is on screen.
    const g = viewportContainer.toGlobal(new PIXI.Point(_worldX, _worldY - verticalOffset));
    const sx = g.x;
    const sy = g.y;
    
    const textW = labelObj._text.text.length * 8;
    const textH = 14;
    const boxX = sx - textW / 2;
    const boxY = sy - 8 - textH;

    // On n'affiche pas si tronqué par le bord (Culling strict)
    if (boxX < 0 || boxX + textW > w || boxY < 0 || boxY + textH > h) {
      labelObj.visible = false;
    } else {
      const fontSizeRatio = studioState.labelFontSize / 14;
      labelObj.visible = true;
      
      // Position exactly on crater, use pivot for screen-space consistent offset
      labelObj.position.set(_worldX, _worldY);
      labelObj.pivot.y = LABELS.labelOffsetY / fontSizeRatio;
      
      // Scale compensation: Double flip makes it upright
      labelObj.scale.set(
        invScale * fontSizeRatio * (globalFlipH ? -1 : 1), 
        invScale * fontSizeRatio * (globalFlipV ? -1 : 1)
      );
      
      // Rotation compensation: 
      // If handedness changed (1 flip), local rotation must follow parent to cancel out.
      // If handedness same (0 or 2 flips), local rotation must oppose parent.
      labelObj.rotation = (globalFlipH !== globalFlipV) ? globalRot : -globalRot;
      
      // RESET TINTS (Container level for PixiJS v8 + Text level)
      labelObj.tint = 0xffffff;
      labelObj._text.tint = LAYER_PALETTE[studioState.labelColorText % LAYER_PALETTE.length].stroke;
    }
  }

  // 3. Hover : Scan optimisÃ© (influence rÃ©duite)
  let closestCandidate = null;
  let closestDistSq = LABELS.hoverRadius * LABELS.hoverRadius;

  // We perform the scan even during drag so that onMouseUp can detect the click,
  // but we only render the hover UI if not dragging.
  for (const cand of _allVisibleCraterPoints) {
    // Get screen position accounting for the viewport transform
    const g = viewportContainer.toGlobal(new PIXI.Point(cand.ptX, cand.ptY));
    const sx = g.x;
    const sy = g.y;

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

  // 4. Update Hover UI
  hoverBgGfx.clear();
  hoverLabel.visible = false;
  _currentHoveredCrater = null;

  if (closestCandidate) {
    _currentHoveredCrater = closestCandidate.crater;
    
    // Only render hover visuals if not dragging
    if (!isDragging) {
    // Vérifier si ce cratère possède DÉJÀ un label à l'écran (O(1) lookup)
    const existingLabel = _activeLabelMap.get(closestCandidate.crater) || null;

    if (existingLabel && existingLabel.visible) {
      // Highlight sur le label existant : Texte en Cyan + Bordure de hover Blanche
      existingLabel._text.tint = 0x00d4ff;
      
      // On utilise le hoverBgGfx pour dessiner la bordure par-dessus (pour ne pas polluer le cache du label)
      const hBgW = existingLabel._bgW || 0;
      const hBgH = existingLabel._bgH || 0;
      const fontSizeRatio = studioState.labelFontSize / 14;

      // Position exactly on crater, use same pivot as labels
      hoverContainer.position.set(closestCandidate.ptX, closestCandidate.ptY);
      hoverContainer.pivot.y = LABELS.labelOffsetY / fontSizeRatio;

      const finalScale = invScale * fontSizeRatio;
      hoverContainer.scale.set(finalScale * (globalFlipH ? -1 : 1), finalScale * (globalFlipV ? -1 : 1));
      hoverContainer.rotation = (globalFlipH !== globalFlipV) ? globalRot : -globalRot;

      // Draw border in the compensated local space (0,0 is now the crater + vertical offset)
      hoverBgGfx.roundRect(-hBgW / 2, -hBgH, hBgW, hBgH, studioState.labelFondRadius);
      hoverBgGfx.stroke({ width: 2 / fontSizeRatio, color: 0xffffff, alpha: 1.0 });

      // Petit cercle de témoignage sur le point
      // Again, crater is at +OFFSET relative to our pivot.
      hoverBgGfx.circle(0, LABELS.labelOffsetY / fontSizeRatio, 8);
      hoverBgGfx.stroke({ width: 1.5 / fontSizeRatio, color: 0x00d4ff, alpha: 0.8 });

    } else {
      // S'il n'avait pas de label, on fait "pop" un label de hover classique
      const txt = closestCandidate.crater.name;
      hoverLabel.text = txt;

      const fontSizeRatio = studioState.labelFontSize / 14;
      const hTextW = hoverLabel.width;
      const hTextH = hoverLabel.height;
      const hBgW = hTextW + (10 + studioState.labelFondSizeX);
      const hBgH = hTextH + (6 + studioState.labelFondSizeY);
      
      // Position exactly on crater, use pivot for 14px offset
      hoverContainer.position.set(closestCandidate.ptX, closestCandidate.ptY);
      hoverContainer.pivot.y = 14 / fontSizeRatio;

      const finalScale = invScale * fontSizeRatio;
      hoverContainer.scale.set(finalScale * (globalFlipH ? -1 : 1), finalScale * (globalFlipV ? -1 : 1));
      hoverContainer.rotation = (globalFlipH !== globalFlipV) ? globalRot : -globalRot;

      hoverBgGfx.roundRect(-hBgW / 2, -hBgH, hBgW, hBgH, studioState.labelFondRadius);
      hoverBgGfx.fill({ color: 0x06060c, alpha: 0.95 });
      hoverBgGfx.stroke({ width: 2 / fontSizeRatio, color: 0xffffff, alpha: 0.9 }); // Bordure blanche au hover

      hoverLabel.tint = 0x00d4ff; // Texte Cyan au hover
      hoverLabel.visible = true;

      // Cercle bleu sur le point même si label popup
      // Since pivot is at 14px above crater, and global scale is 1, 
      // the crater is at exactly +14px locally.
      hoverBgGfx.circle(0, 14 / fontSizeRatio, 8); 
      hoverBgGfx.stroke({ width: 1.5, color: 0x00d4ff, alpha: 0.8 });
    }
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



function getHoveredCrater() {
  return _currentHoveredCrater;
}

export const PixiRenderer = {
  init,
  getApp,
  setBackgroundImage,
  getBackgroundDisplaySize,
  updateViewport,
  applyStudioAdjustments,
  rebuildGeoJSON,
  rebuildNightMask,
  rebuildDayMask,
  rebuildTerminator,
  rebuildGrid,
  rebuildLimbGlow,
  rebuildAnchors,
  rebuildPivotAnchor,
  rebuildAnnotations,
  rebuildMoonMask,
  setMoonMaskEnabled,
  updateAnnotationsTransform,
  toggleGrid,
  toggleLabels,
  setLabelsEnabled,
  showLabels: isLabelsEnabled,
  getHoveredCrater
};
