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
import { setLastInteractionTime } from './renderLoop.js';

let dragStart = { x: 0, y: 0 };
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
  if (viewportState.isDragging) {
    document.body.classList.add(viewportState.dragType === 'rotate' ? 'cursor-rotate' : 'cursor-grabbing');
  } else if (viewportState.mode === 'anchor') {
    document.body.classList.add('cursor-crosshair');
  } else {
    document.body.classList.add('cursor-grab');
  }
}

export function onMouseDown(e) {
  setLastInteractionTime();
  if (!viewportState.backgroundImage) return;
  const mx = e.clientX, my = e.clientY;
  viewportState.isDragging = true; 
  dragStart = { x: mx, y: my };
  const locked = Anchors.count() > 0;

  if (e.button === 2 || (e.button === 0 && e.ctrlKey) || (e.button === 0 && viewportState.mode === 'navigate' && locked)) {
    viewportState.dragType = 'viewport'; 
    updateCursor(); 
    return;
  }
  if (e.button !== 0) { 
    viewportState.isDragging = false; 
    return; 
  }

  if (viewportState.mode === 'anchor') {
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
      dragAnchorId = Anchors.add(src.x, src.y, norm.x, norm.y);
      viewportState.dragType = 'anchor'; 
      layerState.layerTransformDirty = true; 
      layerState.anchorRevision++;
    }
  } else {
    if (e.shiftKey && !locked) {
      viewportState.dragType = 'rotate';
      const c = Transform.getLayerCenter();
      lastRotationAngle = Math.atan2(my - (c.y * viewportState.scale + viewportState.ty), mx - (c.x * viewportState.scale + viewportState.tx));
    } else if (e.shiftKey && locked) { 
      viewportState.isDragging = false; 
    } else {
      viewportState.dragType = 'translate';
    }
  }
  updateCursor();
}

export function onMouseMove(e) {
  if (!viewportState.backgroundImage) return;
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
    if (display) display.textContent = geo ? `Lat: ${geo.lat.toFixed(4)}° | Lon: ${geo.lon.toFixed(4)}°` : '---';
  }

  if (!viewportState.isDragging) return;
  const dx = mx - dragStart.x, dy = my - dragStart.y;
  
  if (viewportState.dragType === 'viewport') { 
    viewportState.tx += dx; 
    viewportState.ty += dy; 
  } else if (viewportState.dragType === 'translate') { 
    Transform.translate(dx / viewportState.scale, dy / viewportState.scale); 
    layerState.layerTransformDirty = true; 
  } else if (viewportState.dragType === 'rotate') {
    const c = Transform.getLayerCenter();
    const angle = Math.atan2(my - (c.y * viewportState.scale + viewportState.ty), mx - (c.x * viewportState.scale + viewportState.tx));
    Transform.rotate(angle - lastRotationAngle); 
    lastRotationAngle = angle; 
    layerState.layerTransformDirty = true;
  } else if (viewportState.dragType === 'anchor' && dragAnchorId !== null) {
    const norm = screenToNormalized(mx - dragAnchorOffset.x, my - dragAnchorOffset.y);
    Anchors.moveDestination(dragAnchorId, norm.x, norm.y); 
    layerState.layerTransformDirty = true;
  }
  dragStart = { x: mx, y: my };
}

export function onMouseUp() { 
  if (!viewportState.backgroundImage) return; 
  viewportState.isDragging = false; 
  viewportState.dragType = null; 
  updateCursor(); 
}

export function onWheel(e) {
  if (!viewportState.backgroundImage) return;
  setLastInteractionTime();
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  if (e.ctrlKey || Anchors.count() > 0) {
    viewportState.tx = e.clientX - (e.clientX - viewportState.tx) * factor;
    viewportState.ty = e.clientY - (e.clientY - viewportState.ty) * factor;
    viewportState.scale *= factor;
  } else {
    const w = screenToWorld(e.clientX, e.clientY);
    Transform.zoom(e.deltaY < 0 ? 1.08 : 1 / 1.08, w.x, w.y); 
    layerState.layerTransformDirty = true;
  }
  e.preventDefault();
}

export function onDoubleClick(e) {
  if (!viewportState.backgroundImage) return;
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
  if (!viewportState.backgroundImage) return;
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'a' || e.key === 'A') toggleAnchorMode();
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
}

export function bindInputHandlers(canvas) {
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('dblclick', onDoubleClick);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('keydown', onKeyDown);
}
