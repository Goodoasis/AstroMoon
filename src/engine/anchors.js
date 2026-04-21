/**
 * AstroMoon — Anchor (Pin) Management
 * Manages the creation, movement, and deletion of anchor points
 * used for TPS rubber-sheeting deformation.
 * 
 * Anchors live in normalized [0..1] space (pre-TPS).
 * Anchor rendering uses Global-only transform + viewport.
 * Hit-testing accounts for viewport transform.
 * 
 * Each anchor carries an optional `name` (auto-detected crater name).
 */

import { Transform } from './transform.js';
import { TPS } from './tps.js';
import { layerState } from '../stores/layerState.svelte.js';
import { RENDER } from './config.js';
import { GeoJSON } from './geojson.js';

let anchors = [];
let nextId = 1;
let tpsData = null;
let dirty = true;

const HIT_RADIUS = 14;

/** Moon diameter (km) — used for crater containment in ortho projection */
const MOON_DIAMETER_KM = 3474.8;

// Scratch objects for zero-alloc transform closures
const _deformPt = { x: 0, y: 0 };
const _invPt = { x: 0, y: 0 };

/**
 * Detect the nearest containing crater at a given normalized position.
 * Uses cratersDB projected positions (nx, ny) and diameter-based radius.
 * Returns the crater name if inside, otherwise null.
 * When multiple craters overlap, picks the smallest (most specific).
 */
function detectCraterAt(nx, ny) {
  const craters = layerState.cratersDB;
  if (!craters) return null;

  let bestName = null;
  let bestDiam = Infinity;
  const mul = RENDER.anchorCraterDetectMul;

  for (const crater of craters) {
    if (crater.nx === null || crater.ny === null) continue;

    const dx = nx - crater.nx;
    const dy = ny - crater.ny;
    const distSq = dx * dx + dy * dy;

    // Crater radius in normalized space:
    // Full disc = 1.0 norm units = MOON_DIAMETER_KM
    // Crater radius = (diameter / 2) / MOON_DIAMETER_KM
    const craterRadiusNorm = (crater.diameter / 2) / MOON_DIAMETER_KM * mul;
    const rSq = craterRadiusNorm * craterRadiusNorm;

    if (distSq < rSq && crater.diameter < bestDiam) {
      bestName = crater.name;
      bestDiam = crater.diameter;
    }
  }

  return bestName;
}

function add(sx, sy, dx, dy) {
  if (anchors.length >= RENDER.anchorMaxCount) return null;

  if (dx === undefined) dx = sx;
  if (dy === undefined) dy = sy;
  
  const id = nextId++;

  // Auto-detect crater name from source position
  const name = detectCraterAt(sx, sy);

  anchors.push({ id, sx, sy, dx, dy, name });
  dirty = true;
  layerState.anchorCount = anchors.length;
  return id;
}

function setName(id, name) {
  const anchor = anchors.find(a => a.id === id);
  if (anchor) anchor.name = name;
}

function moveDestination(id, nx, ny) {
  const anchor = anchors.find(a => a.id === id);
  if (anchor) {
    anchor.dx = nx;
    anchor.dy = ny;
    dirty = true;
  }
}

function remove(id) {
  anchors = anchors.filter(a => a.id !== id);
  dirty = true;
  layerState.anchorCount = anchors.length;
}

function clear() {
  anchors = [];
  nextId = 1;
  tpsData = null;
  dirty = true;
  layerState.anchorCount = 0;
}

function getAll() {
  return anchors;
}

function count() {
  return anchors.length;
}

function findNear(screenX, screenY, vp) {
  let closest = null;
  let closestDist = HIT_RADIUS;

  for (const a of anchors) {
    const world = Transform.apply(a.dx, a.dy);
    const scrX = world.x * vp.scale + vp.tx;
    const scrY = world.y * vp.scale + vp.ty;
    const d = Math.hypot(scrX - screenX, scrY - screenY);
    if (d < closestDist) {
      closestDist = d;
      closest = a;
    }
  }

  return closest;
}

function getTPSData() {
  if (!dirty) return tpsData;

  if (anchors.length === 0) {
    tpsData = null;
  } else {
    const pad = 10.0;
    const augmentedAnchors = [
      ...anchors,
      { id: -1, sx: -pad, sy: -pad, dx: -pad, dy: -pad },
      { id: -2, sx: 1+pad, sy: -pad, dx: 1+pad, dy: -pad },
      { id: -3, sx: 1+pad, sy: 1+pad, dx: 1+pad, dy: 1+pad },
      { id: -4, sx: -pad, sy: 1+pad, dx: -pad, dy: 1+pad }
    ];
    tpsData = TPS.solve(augmentedAnchors);
  }
  dirty = false;
  return tpsData;
}

function inverseTPS(dx, dy) {
  const tps = getTPSData();
  if (!tps) return { x: dx, y: dy };
  
  let sx = dx;
  let sy = dy;
  
  for (let i = 0; i < 20; i++) {
    const f = TPS.apply(sx, sy, tps, _invPt);
    const ex = dx - f.x;
    const ey = dy - f.y;
    sx += ex;
    sy += ey;
    
    if (Math.abs(ex) < 1e-6 && Math.abs(ey) < 1e-6) break;
  }
  return { x: sx, y: sy };
}

function getTransformFunction() {
  const tps = getTPSData();

  if (tps) {
    return (nx, ny) => {
      const deformed = TPS.apply(nx, ny, tps, _deformPt);
      return Transform.apply(deformed.x, deformed.y);
    };
  } else {
    return (nx, ny) => Transform.apply(nx, ny);
  }
}

function applyBuffer(buffer, length = buffer.length) {
  const tps = getTPSData();
  if (tps) {
    TPS.applyBuffer(buffer, tps, length);
  }
  Transform.applyBuffer(buffer, length);
}

function markDirty() {
  dirty = true;
}

export const Anchors = {
  add,
  setName,
  moveDestination,
  remove,
  clear,
  getAll,
  count,
  findNear,
  getTPSData,
  getTransformFunction,
  applyBuffer,
  markDirty,
  inverseTPS,
  HIT_RADIUS
};
