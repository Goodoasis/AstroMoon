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
  refractionSquash: 1.0,
  zenithAngle: 0,
  _m00: 1, _m01: 0, _m02: 0,
  _m10: 0, _m11: 1, _m12: 0,
  _im00: 1, _im01: 0, _im02: 0,
  _im10: 0, _im11: 1, _im12: 0
};

// Reusable output object for apply()/inverse() — avoids GC in hot loops
const _tmpOut = { x: 0, y: 0 };

function reset(canvasW, canvasH) {
  const size = Math.min(canvasW, canvasH) * 0.7;
  state.layerSize = size;
  state.scale = 1;
  state.rotation = 0;
  state.refractionSquash = 1.0;
  state.zenithAngle = 0;
  state.tx = (canvasW - size) / 2;
  state.ty = (canvasH - size) / 2;
  updateMatrix();
}

function updateMatrix() {
  const cx = state.layerSize / 2;
  const cy = state.layerSize / 2;
  const cos = Math.cos(state.rotation);
  const sin = Math.sin(state.rotation);
  const ls = state.layerSize;
  const sc = state.scale;

  // 1. Base rotation and scale
  const r00 = ls * cos * sc;
  const r01 = -ls * sin * sc;
  const r10 = ls * sin * sc;
  const r11 = ls * cos * sc;

  // 2. Refraction Squash (Asymmetric scale along Zenith axis)
  const zCos = Math.cos(state.zenithAngle);
  const zSin = Math.sin(state.zenithAngle);
  const sq = state.refractionSquash;
  
  const sq_x = zCos*zCos + sq*zSin*zSin;
  const sq_xy = zCos*zSin*(1 - sq);
  const sq_y = zSin*zSin + sq*zCos*zCos;

  // 3. Combined 2x2 matrix
  const m00 = sq_x * r00 + sq_xy * r10;
  const m01 = sq_x * r01 + sq_xy * r11;
  const m10 = sq_xy * r00 + sq_y * r10;
  const m11 = sq_xy * r01 + sq_y * r11;

  // 4. Translation components
  // Origin shift: (nx*ls - cx), we distribute the offset
  // Offset to subtract from the rotated vector:
  const oX = cx / ls;
  const oY = cy / ls;
  const shiftX = -(m00 * oX + m01 * oY);
  const shiftY = -(m10 * oX + m11 * oY);

  const m02 = shiftX + cx + state.tx;
  const m12 = shiftY + cy + state.ty;

  state._m00 = m00; state._m01 = m01; state._m02 = m02;
  state._m10 = m10; state._m11 = m11; state._m12 = m12;

  // 5. Inverse Matrix (for hit detection etc.)
  const det = m00 * m11 - m01 * m10;
  if (Math.abs(det) > 1e-12) {
    const idet = 1 / det;
    state._im00 = m11 * idet;
    state._im01 = -m01 * idet;
    state._im10 = -m10 * idet;
    state._im11 = m00 * idet;
    state._im02 = (m01 * m12 - m11 * m02) * idet;
    state._im12 = (m10 * m02 - m00 * m12) * idet;
  }
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
  updateMatrix();
}

function getState() {
  return { ...state };
}

function setState(newState) {
  Object.assign(state, newState);
  updateMatrix();
}

function apply(nx, ny, out) {
  const o = out || _tmpOut;
  o.x = nx * state._m00 + ny * state._m01 + state._m02;
  o.y = nx * state._m10 + ny * state._m11 + state._m12;
  return o;
}

function inverse(sx, sy, out) {
  const o = out || _tmpOut;
  o.x = sx * state._im00 + sy * state._im01 + state._im02;
  o.y = sx * state._im10 + sy * state._im11 + state._im12;
  return o;
}

function applyBuffer(buffer, length = buffer.length) {
  const m00 = state._m00, m01 = state._m01, m02 = state._m02;
  const m10 = state._m10, m11 = state._m11, m12 = state._m12;

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
  updateMatrix();
}

function zoom(factor, sx, sy) {
  const newScale = state.scale * factor;
  if (newScale < 0.05 || newScale > 50) return;

  const cx = state.layerSize / 2 + state.tx;
  const cy = state.layerSize / 2 + state.ty;

  state.tx += (sx - cx) * (1 - factor);
  state.ty += (sy - cy) * (1 - factor);
  state.scale = newScale;
  updateMatrix();
}

function rotate(deltaRadians) {
  state.rotation += deltaRadians;
  updateMatrix();
}

function setRotation(radians) {
  state.rotation = radians;
  // Note: updateMatrix is called later when ephemeris sets refraction too.
  updateMatrix();
}

function setRefraction(squash, zenithAngle) {
  state.refractionSquash = squash;
  state.zenithAngle = zenithAngle;
  updateMatrix();
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
  setRotation,
  setRefraction
};
