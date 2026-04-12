/**
 * AstroMoon — Global Affine Transform
 * Manages translation, scale, and rotation of the vector layer.
 */

const DEFAULT_LAYER_SIZE = 600;

let state = {
  tx: 0,
  ty: 0,
  scale: 1,
  rotation: 0,
  layerSize: DEFAULT_LAYER_SIZE,
  _cos: 1,  // cached cos(rotation)
  _sin: 0   // cached sin(rotation)
};

// Reusable output object for apply()/inverse() — avoids GC in hot loops
const _tmpOut = { x: 0, y: 0 };

function reset(canvasW, canvasH) {
  const size = Math.min(canvasW, canvasH) * 0.7;
  state.layerSize = size;
  state.scale = 1;
  state.rotation = 0;
  state._cos = 1;
  state._sin = 0;
  state.tx = (canvasW - size) / 2;
  state.ty = (canvasH - size) / 2;
}

function handleResize(oldW, oldH, newW, newH) {
  if (oldW === 0 || oldH === 0) {
    reset(newW, newH);
    return;
  }

  const oldCenterScreenX = state.tx + state.layerSize / 2;
  const oldCenterScreenY = state.ty + state.layerSize / 2;
  const relX = oldCenterScreenX / oldW;
  const relY = oldCenterScreenY / oldH;

  const newSize = Math.min(newW, newH) * 0.7;
  const sizeRatio = newSize / state.layerSize;

  state.scale *= sizeRatio;
  state.layerSize = newSize;

  state.tx = relX * newW - newSize / 2;
  state.ty = relY * newH - newSize / 2;
}

function getState() {
  return { ...state };
}

function setState(newState) {
  Object.assign(state, newState);
}

function apply(nx, ny, out) {
  const cx = state.layerSize / 2;
  const cy = state.layerSize / 2;
  const cos = state._cos;
  const sin = state._sin;
  const ls = state.layerSize;
  const sc = state.scale;

  const m00 = ls * cos * sc;
  const m01 = -ls * sin * sc;
  const m02 = cx - cx * cos * sc + cy * sin * sc + state.tx;

  const m10 = ls * sin * sc;
  const m11 = ls * cos * sc;
  const m12 = cy - cx * sin * sc - cy * cos * sc + state.ty;

  const o = out || _tmpOut;
  o.x = nx * m00 + ny * m01 + m02;
  o.y = nx * m10 + ny * m11 + m12;
  return o;
}

function inverse(sx, sy, out) {
  let x = sx - state.tx;
  let y = sy - state.ty;

  const cx = state.layerSize / 2;
  const cy = state.layerSize / 2;
  x = cx + (x - cx) / state.scale;
  y = cy + (y - cy) / state.scale;

  const cos = Math.cos(-state.rotation);
  const sin = Math.sin(-state.rotation);
  const dx = x - cx;
  const dy = y - cy;
  x = cx + dx * cos - dy * sin;
  y = cy + dx * sin + dy * cos;

  x /= state.layerSize;
  y /= state.layerSize;

  const o = out || _tmpOut;
  o.x = x;
  o.y = y;
  return o;
}

function applyBuffer(buffer, length = buffer.length) {
  const cx = state.layerSize / 2;
  const cy = state.layerSize / 2;
  const cos = state._cos;
  const sin = state._sin;
  const ls = state.layerSize;
  const sc = state.scale;
  const tx = state.tx;
  const ty = state.ty;

  const m00 = ls * cos * sc;
  const m01 = -ls * sin * sc;
  const m02 = cx - cx * cos * sc + cy * sin * sc + tx;

  const m10 = ls * sin * sc;
  const m11 = ls * cos * sc;
  const m12 = cy - cx * sin * sc - cy * cos * sc + ty;

  for (let ptr = 0; ptr < length; ptr += 2) {
    const nx = buffer[ptr];
    const ny = buffer[ptr + 1];

    if (isNaN(nx)) continue;

    buffer[ptr] = nx * m00 + ny * m01 + m02;
    buffer[ptr + 1] = nx * m10 + ny * m11 + m12;
  }
}

function getLayerCenter() {
  return apply(0.5, 0.5, { x: 0, y: 0 });
}

function translate(dx, dy) {
  state.tx += dx;
  state.ty += dy;
}

function zoom(factor, sx, sy) {
  const newScale = state.scale * factor;
  if (newScale < 0.05 || newScale > 50) return;

  const cx = state.layerSize / 2 + state.tx;
  const cy = state.layerSize / 2 + state.ty;

  state.tx += (sx - cx) * (1 - factor);
  state.ty += (sy - cy) * (1 - factor);
  state.scale = newScale;
}

function rotate(deltaRadians) {
  state.rotation += deltaRadians;
  state._cos = Math.cos(state.rotation);
  state._sin = Math.sin(state.rotation);
}

function setRotation(radians) {
  state.rotation = radians;
  state._cos = Math.cos(radians);
  state._sin = Math.sin(radians);
}

export const Transform = {
  reset,
  handleResize,
  getState,
  setState,
  apply,
  applyBuffer,
  inverse,
  getLayerCenter,
  translate,
  zoom,
  rotate,
  setRotation
};
