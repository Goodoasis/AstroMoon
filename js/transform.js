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
  layerSize: DEFAULT_LAYER_SIZE
};

function reset(canvasW, canvasH) {
  const size = Math.min(canvasW, canvasH) * 0.7;
  state.layerSize = size;
  state.scale = 1;
  state.rotation = 0;
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

function apply(nx, ny) {
  let x = nx * state.layerSize;
  let y = ny * state.layerSize;

  const cx = state.layerSize / 2;
  const cy = state.layerSize / 2;
  const cos = Math.cos(state.rotation);
  const sin = Math.sin(state.rotation);
  const dx = x - cx;
  const dy = y - cy;
  x = cx + dx * cos - dy * sin;
  y = cy + dx * sin + dy * cos;

  x = cx + (x - cx) * state.scale;
  y = cy + (y - cy) * state.scale;

  x += state.tx;
  y += state.ty;

  return { x, y };
}

function inverse(sx, sy) {
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

  return { x, y };
}

function applyBuffer(buffer, length = buffer.length) {
  const cx = state.layerSize / 2;
  const cy = state.layerSize / 2;
  const cos = Math.cos(state.rotation);
  const sin = Math.sin(state.rotation);
  const ls = state.layerSize;
  const sc = state.scale;
  const tx = state.tx;
  const ty = state.ty;

  for (let ptr = 0; ptr < length; ptr += 2) {
    let nx = buffer[ptr];
    let ny = buffer[ptr + 1];

    if (isNaN(nx)) continue;

    let x = nx * ls;
    let y = ny * ls;

    const dx = x - cx;
    const dy = y - cy;
    x = cx + dx * cos - dy * sin;
    y = cy + dx * sin + dy * cos;

    x = cx + (x - cx) * sc;
    y = cy + (y - cy) * sc;

    x += tx;
    y += ty;

    buffer[ptr] = x;
    buffer[ptr + 1] = y;
  }
}

function getLayerCenter() {
  return apply(0.5, 0.5);
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
}

function setRotation(radians) {
  state.rotation = radians;
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
