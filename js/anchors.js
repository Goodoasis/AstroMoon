/**
 * AstroAz — Anchor (Pin) Management
 * Manages the creation, movement, and deletion of anchor points
 * used for TPS rubber-sheeting deformation.
 * 
 * Anchors live in normalized [0..1] space (pre-TPS).
 * Anchor rendering uses Global-only transform + viewport.
 * Hit-testing accounts for viewport transform.
 */

const Anchors = (() => {
  'use strict';

  let anchors = [];
  let nextId = 1;
  let tpsData = null;
  let dirty = true;

  const HIT_RADIUS = 14;

  /**
   * Add a new anchor. If dx/dy are not provided, assumes it hasn't moved.
   */
  function add(sx, sy, dx, dy) {
    if (dx === undefined) dx = sx;
    if (dy === undefined) dy = sy;
    
    const id = nextId++;
    anchors.push({ id, sx, sy, dx, dy });
    dirty = true;
    return id;
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
  }

  function clear() {
    anchors = [];
    nextId = 1;
    tpsData = null;
    dirty = true;
  }

  function getAll() {
    return anchors.map(a => ({ ...a }));
  }

  function count() {
    return anchors.length;
  }

  /**
   * Find an anchor near a screen position.
   * Accounts for viewport transform.
   */
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
      // Add 4 static dummy anchors far away.
      // This guarantees the system has at least 5 points (well-conditioned),
      // handles N < 3 without exploding, and creates a natural "rubber sheet"
      // that fades out at infinity.
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

  /**
   * Iteratively approximate the inverse TPS to find the true source
   * coordinate (sx, sy) that currently maps to (dx, dy).
   * Used when placing a new anchor on an already deformed mesh.
   */
  function inverseTPS(dx, dy) {
    const tps = getTPSData();
    if (!tps) return { x: dx, y: dy };
    
    let sx = dx;
    let sy = dy;
    
    // Fixed-point iteration converges quickly for smooth TPS deformations
    for (let i = 0; i < 20; i++) {
      const f = TPS.apply(sx, sy, tps);
      const ex = dx - f.x;
      const ey = dy - f.y;
      sx += ex;
      sy += ey;
      
      if (Math.abs(ex) < 1e-6 && Math.abs(ey) < 1e-6) break;
    }
    return { x: sx, y: sy };
  }

  /**
   * Build transform function for GeoJSON rendering: TPS → Global.
   */
  function getTransformFunction() {
    const tps = getTPSData();

    if (tps) {
      return (nx, ny) => {
        const deformed = TPS.apply(nx, ny, tps);
        return Transform.apply(deformed.x, deformed.y);
      };
    } else {
      return (nx, ny) => Transform.apply(nx, ny);
    }
  }

  function markDirty() {
    dirty = true;
  }

  return {
    add,
    moveDestination,
    remove,
    clear,
    getAll,
    count,
    findNear,
    getTPSData,
    getTransformFunction,
    markDirty,
    inverseTPS,
    HIT_RADIUS
  };
})();
