/**
 * AstroMoon — PixiJS v8 Renderer
 * Replaces the Canvas 2D renderer with a GPU-accelerated PixiJS scene graph.
 * 
 * Architecture: 
 *   stage
 *     └── viewportContainer  (handles pan/zoom via position & scale)
 *           ├── bgSprite      (background moon photo)
 *           ├── geojsonContainer  (one Graphics per layer)
 *           ├── nightMaskGfx
 *           ├── terminatorGfx
 *           ├── gridGfx
 *           ├── anchorsGfx
 *           └── annotationsContainer (Text + Graphics dots)
 */

import * as PIXI from 'https://cdn.jsdelivr.net/npm/pixi.js@8.17.1/dist/pixi.min.mjs';
import { GeoJSON } from './geojson.js';
import { Transform } from './transform.js';
import { Anchors } from './anchors.js';
import { GRID, LABELS, CULLING, RENDER, LAYER_PALETTE } from './config.js';


// Scene graph references
let app = null;
let viewportContainer = null;
let bgSprite = null;
let geojsonContainer = null;
let nightMaskGfx = null;
let terminatorGfx = null;
let gridGfx = null;
let anchorsGfx = null;
let annotationsContainer = null;
let layerGraphicsMap = new Map(); // Store PIXI.Graphics objects indexed by layerIndex
let textPool = [];
let activeLabels = [];
let dotsGfx = null;
let labelsContainer = null;
let labelsBgGfx = null;

// Hover
let hoverBgGfx = null;
let hoverLabel = null;

let _showGrid = false;
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
          // Force la résolution pour correspondre au ratio physique
          page.texture.source.resolution = window.devicePixelRatio || 2;
          page.texture.source.alphaMode = 'premultiplied-alpha';
          page.texture.source.update();
        }
      });
    }
  } catch (err) {
    console.error("PixiRenderer: Font load error:", err);
  }

  app = new PIXI.Application();
  await app.init({
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

  nightMaskGfx = new PIXI.Graphics();
  viewportContainer.addChild(nightMaskGfx);

  terminatorGfx = new PIXI.Graphics();
  viewportContainer.addChild(terminatorGfx);

  gridGfx = new PIXI.Graphics();
  gridGfx.visible = false;
  viewportContainer.addChild(gridGfx);

  anchorsGfx = new PIXI.Graphics();
  viewportContainer.addChild(anchorsGfx);

  // Annotations
  annotationsContainer = new PIXI.Container();
  annotationsContainer.visible = false;
  viewportContainer.addChild(annotationsContainer);

  // Les points restent constants et attachés à Annotations
  dotsGfx = new PIXI.Graphics();
  annotationsContainer.addChild(dotsGfx);

  // Groupe Textes + Fonds (pour fondu indépendant)
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

  return app;
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
 * Update the viewport container transform (pan/zoom).
 */
function updateViewport(vp) {
  viewportContainer.position.set(vp.tx, vp.ty);
  viewportContainer.scale.set(vp.scale);
}

// ─── GeoJSON Rendering ───

/**
 * Rebuild all GeoJSON layer graphics from projected feature data.
 * Called only when data changes (dirty flag), not every frame.
 */
function rebuildGeoJSON(projectedFeatures, vp) {
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

  // Viewport bounds en coordonnées "monde" brutes, avec une marge anti-pop (30%)
  const marginX = app.screen.width * 0.3;
  const marginY = app.screen.height * 0.3;
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

    gfx.clear();
    gfx.visible = true;
    const colors = LAYER_PALETTE[layerIndex % LAYER_PALETTE.length];

    // --- Type 1: Polygons (Batching) ---
    let polyFound = false;
    for (const feature of features) {
      if (feature.type !== 'polygon') continue;
      // Culling
      if (feature.worldBounds) {
        if (feature.worldBounds.maxX < vpMinX || feature.worldBounds.minX > vpMaxX ||
            feature.worldBounds.maxY < vpMinY || feature.worldBounds.minY > vpMaxY) continue;
      }
      polyFound = true;
      for (const ring of feature.renderedCoords) {
        if (ring.length < 4) continue;
        let started = false;
        for (let i = 0; i < ring.length; i += 2) {
          const rx = ring[i], ry = ring[i + 1];
          if (isNaN(rx)) { started = false; continue; }
          if (!started) { gfx.moveTo(rx, ry); started = true; }
          else { gfx.lineTo(rx, ry); }
        }
        gfx.closePath();
      }
    }
    if (polyFound) {
      gfx.fill({ color: colors.fill, alpha: colors.fillAlpha });
      gfx.stroke({ width: 1.5 * invScale, color: colors.stroke, alpha: colors.alpha });
    }

    // --- Type 2: Lines (Batching) ---
    let lineFound = false;
    for (const feature of features) {
      if (feature.type !== 'line') continue;
      if (feature.worldBounds) {
        if (feature.worldBounds.maxX < vpMinX || feature.worldBounds.minX > vpMaxX ||
            feature.worldBounds.maxY < vpMinY || feature.worldBounds.minY > vpMaxY) continue;
      }
      lineFound = true;
      for (const ring of feature.renderedCoords) {
        if (ring.length < 4) continue;
        let started = false;
        for (let i = 0; i < ring.length; i += 2) {
          const rx = ring[i], ry = ring[i + 1];
          if (isNaN(rx)) { started = false; continue; }
          if (!started) { gfx.moveTo(rx, ry); started = true; }
          else { gfx.lineTo(rx, ry); }
        }
      }
    }
    if (lineFound) {
      gfx.stroke({ width: 1.5 * invScale, color: colors.stroke, alpha: colors.alpha });
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
          gfx.circle(rx, ry, 3 * invScale);
        }
      }
    }
    if (ptFound) {
      gfx.fill({ color: colors.stroke, alpha: colors.alpha });
    }
  }
}

// ─── Night Mask ───

// Shared projection cache for terminator points (used by both nightmask + terminator)
let _termProjCache = null; // { geoPointsRef, libKey, projNorm: Array<[nx,ny]|null> }

/**
 * Get projected terminator points (normalized coords).
 * Cached per ephemeris change (terminatorGeoPoints ref + libration).
 */
function _getTerminatorProjections() {
  const state = window.appMoonState;
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
  nightMaskGfx.clear();

  const projCache = _getTerminatorProjections();
  if (!projCache) return;

  const pts = projCache.projNorm;
  const state = window.appMoonState;
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

  // Draw terminator arc
  let moved = false;
  for (const p of visiblePoints) {
    const pt = transformFn(p[0], p[1]);
    if (!moved) { nightMaskGfx.moveTo(pt.x, pt.y); moved = true; }
    else { nightMaskGfx.lineTo(pt.x, pt.y); }
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
    }
  }

  nightMaskGfx.closePath();
  nightMaskGfx.fill({ color: 0x06060c, alpha: 0.75 });
}

// ─── Terminator Line ───

function rebuildTerminator(transformFn, vp) {
  terminatorGfx.clear();

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

  // Draw glow line from buffer
  let moved = false;
  for (let i = 0; i < len; i++) {
    const px = buf[i * 2], py = buf[i * 2 + 1];
    if (!isNaN(px)) {
      if (!moved) { terminatorGfx.moveTo(px, py); moved = true; }
      else { terminatorGfx.lineTo(px, py); }
    } else {
      if (moved) terminatorGfx.stroke({ width: 3.0 * invScale, color: 0xe0faff, alpha: 1.0 });
      moved = false;
    }
  }
  if (moved) terminatorGfx.stroke({ width: 3.0 * invScale, color: 0xe0faff, alpha: 1.0 });

  // Draw white core from same buffer
  moved = false;
  for (let i = 0; i < len; i++) {
    const px = buf[i * 2], py = buf[i * 2 + 1];
    if (!isNaN(px)) {
      if (!moved) { terminatorGfx.moveTo(px, py); moved = true; }
      else { terminatorGfx.lineTo(px, py); }
    } else {
      if (moved) terminatorGfx.stroke({ width: 1.5 * invScale, color: 0xffffff, alpha: 1.0 });
      moved = false;
    }
  }
  if (moved) terminatorGfx.stroke({ width: 1.5 * invScale, color: 0xffffff, alpha: 1.0 });
}

// ─── Grid ───

// Cached grid projection data (changes with libration OR grid spacing)
let _gridCache = null; // { cacheKey, linesNorm, horizonNorm }

/**
 * Build or retrieve cached grid normalized coords.
 * Reprojects when libration or grid spacing changes.
 * @param {number} spacing - Grid line spacing in degrees (default 10)
 */
function _getGridCache(spacing = 10) {
  const state = window.appMoonState || {};
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
  gridGfx.clear();
  if (!_showGrid) return;

  const invScale = 1 / vp.scale;
  const spacing = GRID.spacingByLOD[lodLevel] || 10;
  const cache = _getGridCache(spacing);

  // Copy cached projections to working buffers, then apply TPS + Transform in-place
  cache.linesWork.set(cache.linesNorm);
  Anchors.applyBuffer(cache.linesWork);

  cache.horizonWork.set(cache.horizonNorm);
  Anchors.applyBuffer(cache.horizonWork);

  // Draw grid lines from transformed buffer
  const lb = cache.linesWork;
  let moved = false;
  for (let i = 0; i < lb.length; i += 2) {
    const x = lb[i], y = lb[i + 1];
    if (isNaN(x)) { moved = false; continue; }
    if (!moved) { gridGfx.moveTo(x, y); moved = true; }
    else gridGfx.lineTo(x, y);
  }
  gridGfx.stroke({ width: GRID.lineWidth * invScale, color: GRID.lineColor, alpha: GRID.lineAlpha });

  // Draw horizon from transformed buffer
  const hb = cache.horizonWork;
  gridGfx.moveTo(hb[0], hb[1]);
  for (let i = 2; i < hb.length; i += 2) {
    gridGfx.lineTo(hb[i], hb[i + 1]);
  }
  gridGfx.stroke({ width: GRID.horizonWidth * invScale, color: GRID.horizonColor, alpha: GRID.horizonAlpha });
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
      anchorsGfx.stroke({ width: 1 * invScale, color: 0xffffff, alpha: 0.3 });

      // Source (orange)
      anchorsGfx.circle(srcX, srcY, 5 * invScale);
      anchorsGfx.fill({ color: 0xff6b35 });
      anchorsGfx.stroke({ width: 1 * invScale, color: 0xffffff, alpha: 0.6 });
    }

    // Active halo
    if (isActive) {
      anchorsGfx.circle(dst.x, dst.y, 18 * invScale);
      anchorsGfx.fill({ color: 0x00ff88, alpha: 0.12 });
    }

    // Destination (green)
    const dstRadius = (isActive ? 9 : 7) * invScale;
    anchorsGfx.circle(dst.x, dst.y, dstRadius);
    anchorsGfx.fill({ color: 0x00ff88 });
    anchorsGfx.stroke({ width: (isActive ? 2.5 : 1.5) * invScale, color: 0xffffff, alpha: 0.8 });
  }
}

// ─── Annotations (Crater Labels) ───

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

  // Passe 1 : Collecter et trier tous les cratères visibles dans le champ
  for (const crater of cratersDB) {
    if (crater.name === "--" || crater.nx === null) continue;

    const pt = transformFn(crater.nx, crater.ny);
    const ptX = pt.x, ptY = pt.y; // Copy from scratch object
    const sx = ptX * vp.scale + vp.tx;
    const sy = ptY * vp.scale + vp.ty;

    // Frustum Culling généreux
    if (sx < -200 || sx > canvasW + 200 || sy < -200 || sy > canvasH + 200) continue;

    _dotCandidates.push({ crater, ptX, ptY, sx, sy });
  }

  // cratersDB is pre-sorted by diameter descending (done once at init)
  // _dotCandidates inherits that order — no re-sort needed
  
  const dotsCount = Math.min(_dotCandidates.length, MAX_DOTS);
  const minHoverDiameter = LABELS.hoverMinScreenDiameter / vp.scale;

  // Pre-compute sun trig ONCE outside the loop
  const DEG2RAD = Math.PI / 180;
  const hasSun = window.appMoonState && typeof window.appMoonState.sunLon === 'number';
  let sinSLon = 0, cosSLon = 0, sinSLat = 0, cosSLat = 0, sunLonRad = 0;
  if (hasSun) {
    sunLonRad = window.appMoonState.sunLon * DEG2RAD;
    const sLatR = (window.appMoonState.sunLat || 0) * DEG2RAD;
    sinSLon = Math.sin(sunLonRad); cosSLon = Math.cos(sunLonRad);
    sinSLat = Math.sin(sLatR); cosSLat = Math.cos(sLatR);
  }

  // Passe 2 : Dessiner le Top N des plus gros cratères de la zone
  for (let i = 0; i < dotsCount; i++) {
    const item = _dotCandidates[i];
    const { crater, ptX, ptY, sx, sy } = item;

    // Sun incidence using pre-computed trig (crater.sinLat/cosLat/lonRad immutable)
    let op = 1.0;
    if (hasSun) {
      const cosI = crater.sinLat * sinSLat + crater.cosLat * cosSLat * Math.cos(crater.lonRad - sunLonRad);
      if (cosI < 0) op = 0.25;
      else if (cosI < 0.1) op = 0.25 + (0.75 * (cosI / 0.1));
    }

    if (op < 0.05) continue;

    // Rayon borné entre 2.0 et 3.0 via sqrt
    const onScreenRadius = Math.max(LABELS.dotRadiusMin, Math.min(LABELS.dotRadiusMax, Math.sqrt(crater.diameter * vp.scale) * LABELS.dotRadiusScale));

    dotsGfx.circle(ptX, ptY, onScreenRadius / vp.scale);
    dotsGfx.fill({ color: 0xff4b4b, alpha: op });

    if (crater.diameter >= minHoverDiameter) {
      _allVisibleCraterPoints.push({ crater, ptX, ptY, op });
    }

    // Préparation pour les Labels
    const textWidth = crater.name.length * 8;
    const textHeight = 14;
    const boxX = sx - textWidth / 2;
    const boxY = sy - 8 - textHeight;

    // Strict Culling des labels sur le bord véritable de l'écran
    if (boxX < 0 || boxX + textWidth > canvasW || boxY < 0 || boxY + textHeight > canvasH) continue;

    const dx = sx - cx;
    const dy = sy - cy;
    const distSq = dx * dx + dy * dy;
    const normalizedDist = Math.max(0, Math.min(1, Math.sqrt(distSq / maxScreenDistSq)));
    const score = (crater.diameter * vp.scale) * (1.0 - (normalizedDist * 0.8));

    _candidates.push({ crater, ptX, ptY, sx, sy, op, score, boxX, boxY, textWidth, textHeight });
  }

  // Tri par priorité décroissante
  _candidates.sort((a, b) => b.score - a.score);

  const invScale = 1 / vp.scale;

  for (const item of _candidates) {
    if (activeLabels.length >= MAX_LABELS) break;

    // HITBOX INVISIBLE : Force les labels à s'écarter les uns des autres
    const pad = LABELS.overlapPadding;
    const hitX = item.boxX - pad;
    const hitY = item.boxY - pad;
    const hitW = item.textWidth + pad * 2;
    const hitH = item.textHeight + pad * 2;

    // Anti-Overlap sur la Hitbox géante
    let overlap = false;
    for (const box of _placedBoxes) {
      if (hitX < box.x + box.w && hitX + hitW > box.x &&
        hitY < box.y + box.h && hitY + hitH > box.y) {
        overlap = true;
        break;
      }
    }
    if (overlap) continue;

    // Validation (on réserve tout ce grand espace vide)
    _placedBoxes.push({ x: hitX, y: hitY, w: hitW, h: hitH });

    // Design de la Pilule (Backdrop) ajustée et amincie
    const bgWorldW = (item.textWidth + 10) * invScale;
    const bgWorldH = (item.textHeight + 6) * invScale;
    const bgWorldX = item.ptX - bgWorldW / 2;
    const bgWorldY = (item.ptY - 10 * invScale) - bgWorldH;

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
    label.position.set(item.ptX, item.ptY - 10 * invScale);
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

  // 1. Interpolation Alpha (Tempo / Fondu)
  _labelsTargetAlpha = isDragging ? 0 : 1;
  const alphaDiff = _labelsTargetAlpha - labelsContainer.alpha;
  if (Math.abs(alphaDiff) > 0.01) {
    labelsContainer.alpha += alphaDiff * 0.15; // Smooth Damping
  } else {
    labelsContainer.alpha = _labelsTargetAlpha;
  }

  const w = app.screen.width;
  const h = app.screen.height;

  // 2. Frustum Culling temps réel STRICT
  for (const label of activeLabels) {
    const sx = label._worldX * vp.scale + vp.tx;
    const sy = label._worldY * vp.scale + vp.ty;
    const textW = label.text.length * 8;
    const textH = 14;
    const boxX = sx - textW / 2;
    const boxY = sy - 8 - textH;

    // On n'affiche pas si tronqué par le bord (Culling strict)
    if (boxX < 0 || boxX + textW > w || boxY < 0 || boxY + textH > h) {
      label.visible = false;
    } else {
      label.visible = true;
      label.position.set(label._worldX, label._worldY - 10 * invScale);
      label.scale.set(invScale);
      label.tint = 0xffffff; // Reset le tint obligatoire pour retirer l'effet bleu après un hover
    }
  }

  // 3. Hover : Scan optimisé (influence réduite)
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
    // Vérifier si ce cratère possède DÉJÀ un label à l'écran (O(1) lookup)
    const existingLabel = _activeLabelMap.get(closestCandidate.crater) || null;

    // Effet commun : cercle Néon de sélection
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

// ─── Toggle Functions ───

function toggleGrid() {
  _showGrid = !_showGrid;
  gridGfx.visible = _showGrid;
  return _showGrid;
}

function toggleLabels() {
  _showLabels = !_showLabels;
  annotationsContainer.visible = _showLabels;
  return _showLabels;
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
  updateViewport,
  rebuildGeoJSON,
  rebuildNightMask,
  rebuildTerminator,
  rebuildGrid,
  rebuildAnchors,
  rebuildAnnotations,
  updateAnnotationsTransform,
  toggleGrid,
  toggleLabels,
  showLabels: isLabelsEnabled,
  getLayerColor,
  getPalette
};
