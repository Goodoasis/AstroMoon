/**
 * AstroMoon — User Input Handlers
 * Extracts mouse and keyboard events from app orchestration
 */

import { viewportState } from '../stores/viewportState.svelte.js';
import { layerState } from '../stores/layerState.svelte.js';
import { Transform } from './transform.js';
import { Anchors } from './anchors.js';
import { PixiRenderer } from './pixi_renderer.js';
import { GeoJSON } from './geojson.js';
import { uiState } from '../stores/uiState.svelte.js';
import { studioState } from '../stores/studioState.svelte.js';
import { setLastInteractionTime } from './renderLoop.js';

let dragStart = { x: 0, y: 0 };
let initialDragStart = { x: 0, y: 0 };
let dragAnchorId = null;
let dragAnchorOffset = { x: 0, y: 0 };
let lastRotationAngle = 0;

export function screenToWorld(sx, sy) {
  return { x: (sx - viewportState.tx) / viewportState.scale, y: (sy - viewportState.ty) / viewportState.scale };
}

export function screenToNormalized(sx, sy) {
  const world = screenToWorld(sx, sy);
  return Transform.inverse(world.x, world.y);
}

export function toggleAnchorMode() {
  viewportState.mode = viewportState.mode === 'anchor' ? 'navigate' : 'anchor';
  updateCursor();
  // We'll rely on Svelte's reactivity to handle the "Toast" feedback in App.svelte
}

export function updateCursor() {
  document.body.classList.remove('cursor-grab', 'cursor-grabbing', 'cursor-crosshair', 'cursor-rotate');
  if (viewportState.isRKeyDown) {
    document.body.classList.add('cursor-rotate');
  } else if (viewportState.isDragging) {
    document.body.classList.add('cursor-grabbing');
  } else if (viewportState.mode === 'anchor') {
    document.body.classList.add('cursor-crosshair');
  } else {
    document.body.classList.add('cursor-grab');
  }
}

export function onMouseDown(e) {
  setLastInteractionTime();
  const mx = e.clientX, my = e.clientY;
  viewportState.isDragging = true; 
  dragStart = { x: mx, y: my };
  initialDragStart = { x: mx, y: my };
  const locked = Anchors.count() > 0;
  const isStudioExport = uiState.currentPhase === 'STUDIO' || uiState.currentPhase === 'EXPORT';

  if (e.button === 2 || (e.button === 0 && e.ctrlKey) || isStudioExport || (e.button === 0 && viewportState.mode === 'navigate' && locked)) {
    viewportState.dragType = 'viewport'; 
    updateCursor(); 
    return;
  }
  if (e.button !== 0) { 
    viewportState.isDragging = false; 
    return; 
  }

  if (viewportState.mode === 'anchor') {
    // Emergency mode: place/move PIVOT anchor (single, no TPS)
    if (uiState.emergencyMode) {
      const norm = screenToNormalized(mx, my);
      const geo = GeoJSON.inverseProject(norm.x, norm.y);
      if (geo) {
        // Detect crater name
        const craters = layerState.cratersDB;
        let pivotName = null;
        if (craters) {
          let bestDiam = Infinity;
          const MOON_D = 3474.8;
          for (const c of craters) {
            if (c.nx === null) continue;
            const dx = norm.x - c.nx, dy = norm.y - c.ny;
            const dSq = dx * dx + dy * dy;
            const rN = (c.diameter / 2) / MOON_D * 1.5;
            if (dSq < rN * rN && c.diameter < bestDiam) {
              pivotName = c.name;
              bestDiam = c.diameter;
            }
          }
        }
        uiState.pivotAnchor = {
          nx: norm.x,
          ny: norm.y,
          geoLon: geo.lon,
          geoLat: geo.lat,
          name: pivotName
        };
        layerState.layerTransformDirty = true;
        // Auto-exit anchor mode — pivot is placed, user can now navigate
        toggleAnchorMode();
      }
      viewportState.isDragging = false;
    } else {
      // Normal mode: TPS anchors
      const near = Anchors.findNear(mx, my, viewportState);
      if (near) {
        viewportState.dragType = 'anchor'; 
        dragAnchorId = near.id;
        const w = Transform.apply(near.dx, near.dy);
        dragAnchorOffset = { 
          x: mx - (w.x * viewportState.scale + viewportState.tx), 
          y: my - (w.y * viewportState.scale + viewportState.ty) 
        };
      } else if (layerState.projectedFeatures) {
        const norm = screenToNormalized(mx, my);
        const src = Anchors.inverseTPS(norm.x, norm.y);
        const newId = Anchors.add(src.x, src.y, norm.x, norm.y);
        if (newId !== null) {
          dragAnchorId = newId;
          viewportState.dragType = 'anchor'; 
          layerState.layerTransformDirty = true; 
          layerState.anchorRevision++;
        } else {
          viewportState.isDragging = false;
        }
      }
    }
  } else {
    if (viewportState.isRKeyDown) { 
      viewportState.isDragging = false; 
    } else {
      viewportState.dragType = 'translate';
    }
  }
  updateCursor();
}

export function onMouseMove(e) {
  setLastInteractionTime();
  const mx = e.clientX, my = e.clientY;
  viewportState.mouseX = mx; 
  viewportState.mouseY = my;

  if (layerState.projectedFeatures) {
    const norm = screenToNormalized(mx, my);
    const src = Anchors.inverseTPS(norm.x, norm.y);
    const geo = GeoJSON.inverseProject(src.x, src.y);
    // Ideally we dispatch this to a UI component instead of direct DOM manipulation
    const display = document.getElementById('coords-display');
    if (display) {
      if (geo) {
        const latStr = geo.lat.toFixed(4).padStart(8, ' ');
        const lonStr = geo.lon.toFixed(4).padStart(9, ' ');
        display.textContent = `Lat: ${latStr}°\nLon: ${lonStr}°`;
      } else {
        display.textContent = 'En attente';
      }
    }
  }

  const locked = Anchors.count() > 0;

  if (viewportState.isRKeyDown && !locked) {
    const c = Transform.getLayerCenter();
    const angle = Math.atan2(my - (c.y * viewportState.scale + viewportState.ty), mx - (c.x * viewportState.scale + viewportState.tx));
    
    let deltaAngle = angle - lastRotationAngle;
    
    // Normalize wrap-around at PI / -PI boundary
    if (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    if (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;

    // Apply precision modifier
    if (e.shiftKey) {
      deltaAngle *= 0.1;
    }

    Transform.rotate(deltaAngle); 
    lastRotationAngle = angle; 
    layerState.layerTransformDirty = true;
    return;
  }

  if (!viewportState.isDragging) return;
  const dx = mx - dragStart.x, dy = my - dragStart.y;
  
  if (viewportState.dragType === 'viewport') { 
    viewportState.tx += dx; 
    viewportState.ty += dy; 
  } else if (viewportState.dragType === 'translate') { 
    let moveX = dx / viewportState.scale;
    let moveY = dy / viewportState.scale;
    if (e.shiftKey) {
      moveX *= 0.1;
      moveY *= 0.1;
    }
    Transform.translate(moveX, moveY); 
    layerState.layerTransformDirty = true; 
  } else if (viewportState.dragType === 'anchor' && dragAnchorId !== null) {
    const norm = screenToNormalized(mx - dragAnchorOffset.x, my - dragAnchorOffset.y);
    Anchors.moveDestination(dragAnchorId, norm.x, norm.y); 
    layerState.layerTransformDirty = true;
  }
  dragStart = { x: mx, y: my };
}

export function onMouseUp(e) {
  // Detect simple click (no significant drag)
  if (viewportState.isDragging && e && e.clientX !== undefined) {
    const dx = e.clientX - initialDragStart.x;
    const dy = e.clientY - initialDragStart.y;
    const distSq = dx * dx + dy * dy;

    if (distSq < 10) { // Tolérance de 3 pixels (3*3=9)
      if (uiState.currentPhase === 'STUDIO') {
        const hoveredCrater = PixiRenderer.getHoveredCrater();
        if (hoveredCrater) {
          studioState.togglePinnedCrater(hoveredCrater.name);
          layerState.layerTransformDirty = true;
        }
      }
    }
  }

  viewportState.isDragging = false; 
  viewportState.dragType = null; 
  updateCursor(); 
}

export function onWheel(e) {
  setLastInteractionTime();
  
  // Precision mode if SHIFT is held
  const zoomStep = e.shiftKey ? 0.008 : 0.08;
  const factor = e.deltaY < 0 ? (1 + zoomStep) : 1 / (1 + zoomStep);
  
  const isStudioExport = uiState.currentPhase === 'STUDIO' || uiState.currentPhase === 'EXPORT';

  if (e.ctrlKey || isStudioExport || Anchors.count() > 0) {
    // Zoom the GLOBAL viewport (photo + layer)
    viewportState.tx = e.clientX - (e.clientX - viewportState.tx) * factor;
    viewportState.ty = e.clientY - (e.clientY - viewportState.ty) * factor;
    viewportState.scale *= factor;
  } else {
    // Zoom only the LAYER (vector overlay)
    const w = screenToWorld(e.clientX, e.clientY);
    Transform.zoom(factor, w.x, w.y); 
    layerState.layerTransformDirty = true;
  }
}

export function onDoubleClick(e) {
  if (viewportState.mode === 'anchor') {
    const near = Anchors.findNear(e.clientX, e.clientY, viewportState);
    if (near) { 
      Anchors.remove(near.id); 
      layerState.layerTransformDirty = true; 
      layerState.anchorRevision++;
    }
  }
}

export function onKeyDown(e) {
  if (e.target.tagName === 'INPUT' && (e.target.type === 'text' || e.target.type === 'search' || e.target.type === 'number')) return;
  if (e.target.tagName === 'TEXTAREA') return;
  if ((e.key === 'a' || e.key === 'A') && uiState.currentPhase === 'ALIGN') toggleAnchorMode();
  if (e.key === 'g' || e.key === 'G') {
    const on = PixiRenderer.toggleGrid();
    if (on) { 
      layerState.dirtyGrid = true; 
      layerState.layerTransformDirty = true; 
    }
  }
  if (e.key === 'l' || e.key === 'L') {
    const on = PixiRenderer.toggleLabels();
    if (on) {
      layerState.layerTransformDirty = true;
    }
  }
  if (e.key === 'o' || e.key === 'O') {
    viewportState.isAltAzMode = !viewportState.isAltAzMode;
    // Need ephemeris update
    layerState.dirtyEphemeris = true;
  }
  if (e.key === 'f' || e.key === 'F') {
    viewportState.tx = 0;
    viewportState.ty = 0;
    viewportState.scale = 1;
  }
  if (e.key === 'Escape' && viewportState.mode === 'anchor') {
    toggleAnchorMode();
  }
  if (e.key === 'r' || e.key === 'R') {
    if (!viewportState.isRKeyDown) {
      viewportState.isRKeyDown = true;
      const c = Transform.getLayerCenter();
      lastRotationAngle = Math.atan2(viewportState.mouseY - (c.y * viewportState.scale + viewportState.ty), viewportState.mouseX - (c.x * viewportState.scale + viewportState.tx));
      updateCursor();
    }
  }
}

export function onKeyUp(e) {
  if (e.key === 'r' || e.key === 'R') {
    viewportState.isRKeyDown = false;
    updateCursor();
  }
}

export function bindInputHandlers(canvas) {
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: true });
  canvas.addEventListener('dblclick', onDoubleClick);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
}
