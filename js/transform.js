/**
 * AstroAz — Global Affine Transform
 * Manages translation, scale, and rotation of the vector layer.
 */

const Transform = (() => {
  'use strict';

  // Default layer size (the GeoJSON is projected into a [0..1] square,
  // which is then scaled to this size in pixels before affine transforms)
  const DEFAULT_LAYER_SIZE = 600;

  /** @type {{ tx: number, ty: number, scale: number, rotation: number, layerSize: number }} */
  let state = {
    tx: 0,
    ty: 0,
    scale: 1,
    rotation: 0,
    layerSize: DEFAULT_LAYER_SIZE
  };

  /**
   * Reset transform to center the layer in the canvas.
   * @param {number} canvasW
   * @param {number} canvasH
   */
  function reset(canvasW, canvasH) {
    const size = Math.min(canvasW, canvasH) * 0.7;
    state.layerSize = size;
    state.scale = 1;
    state.rotation = 0;
    state.tx = (canvasW - size) / 2;
    state.ty = (canvasH - size) / 2;
  }

  /**
   * Handle canvas resize without losing current transform.
   * Adjusts translation so the layer center stays at the same relative position.
   * @param {number} oldW - Previous canvas width
   * @param {number} oldH - Previous canvas height
   * @param {number} newW - New canvas width
   * @param {number} newH - New canvas height
   */
  function handleResize(oldW, oldH, newW, newH) {
    if (oldW === 0 || oldH === 0) {
      // First call, just reset
      reset(newW, newH);
      return;
    }

    // Compute where the layer center was in relative terms [0..1]
    const oldCenterScreenX = state.tx + state.layerSize / 2;
    const oldCenterScreenY = state.ty + state.layerSize / 2;
    const relX = oldCenterScreenX / oldW;
    const relY = oldCenterScreenY / oldH;

    // Recompute layer size based on new canvas dimensions
    const newSize = Math.min(newW, newH) * 0.7;
    const sizeRatio = newSize / state.layerSize;

    // Scale the scale factor proportionally
    state.scale *= sizeRatio;
    state.layerSize = newSize;

    // Position center at the same relative screen position
    state.tx = relX * newW - newSize / 2;
    state.ty = relY * newH - newSize / 2;
  }

  /**
   * Get current state (read-only copy).
   */
  function getState() {
    return { ...state };
  }

  /**
   * Set state directly (for undo/redo, etc.)
   */
  function setState(newState) {
    Object.assign(state, newState);
  }

  /**
   * Apply global affine transform to a normalized [0..1] coordinate.
   * Returns screen pixel position.
   * @param {number} nx - Normalized X [0..1]
   * @param {number} ny - Normalized Y [0..1]
   * @returns {{x: number, y: number}}
   */
  function apply(nx, ny) {
    // Scale to layer pixel size
    let x = nx * state.layerSize;
    let y = ny * state.layerSize;

    // Rotate around the center of the layer
    const cx = state.layerSize / 2;
    const cy = state.layerSize / 2;
    const cos = Math.cos(state.rotation);
    const sin = Math.sin(state.rotation);
    const dx = x - cx;
    const dy = y - cy;
    x = cx + dx * cos - dy * sin;
    y = cy + dx * sin + dy * cos;

    // Scale around center
    x = cx + (x - cx) * state.scale;
    y = cy + (y - cy) * state.scale;

    // Translate
    x += state.tx;
    y += state.ty;

    return { x, y };
  }

  /**
   * Inverse transform: screen pixel → normalized [0..1] coordinate.
   * @param {number} sx - Screen X
   * @param {number} sy - Screen Y
   * @returns {{x: number, y: number}} Normalized coords
   */
  function inverse(sx, sy) {
    // Undo translate
    let x = sx - state.tx;
    let y = sy - state.ty;

    // Undo scale
    const cx = state.layerSize / 2;
    const cy = state.layerSize / 2;
    x = cx + (x - cx) / state.scale;
    y = cy + (y - cy) / state.scale;

    // Undo rotate
    const cos = Math.cos(-state.rotation);
    const sin = Math.sin(-state.rotation);
    const dx = x - cx;
    const dy = y - cy;
    x = cx + dx * cos - dy * sin;
    y = cy + dx * sin + dy * cos;

    // Undo layer size
    x /= state.layerSize;
    y /= state.layerSize;

    return { x, y };
  }

  /**
   * Get the center of the layer in screen coordinates.
   */
  function getLayerCenter() {
    return apply(0.5, 0.5);
  }

  /**
   * Translate by delta pixels.
   */
  function translate(dx, dy) {
    state.tx += dx;
    state.ty += dy;
  }

  /**
   * Zoom (scale) centered on a screen point.
   * @param {number} factor - Multiplicative factor (>1 zoom in, <1 zoom out)
   * @param {number} sx - Screen X center point
   * @param {number} sy - Screen Y center point
   */
  function zoom(factor, sx, sy) {
    const newScale = state.scale * factor;
    // Clamp
    if (newScale < 0.05 || newScale > 50) return;

    // Adjust translation to keep the point under cursor fixed
    const cx = state.layerSize / 2 + state.tx;
    const cy = state.layerSize / 2 + state.ty;

    state.tx += (sx - cx) * (1 - factor);
    state.ty += (sy - cy) * (1 - factor);
    state.scale = newScale;
  }

  /**
   * Rotate around the layer center by delta radians.
   */
  function rotate(deltaRadians) {
    state.rotation += deltaRadians;
  }

  return {
    reset,
    handleResize,
    getState,
    setState,
    apply,
    inverse,
    getLayerCenter,
    translate,
    zoom,
    rotate
  };
})();
