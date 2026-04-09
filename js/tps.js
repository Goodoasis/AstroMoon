/**
 * AstroMoon — Thin Plate Spline (TPS) Implementation
 * 
 * The TPS is the standard method for "rubber sheeting" in cartography.
 * It produces a smooth (C¹) deformation that passes exactly through
 * all control points (anchors).
 * 
 * For N control points, we solve an (N+3)×(N+3) linear system
 * simultaneously for X and Y displacements to halve matrix pivoting work.
 */

/**
 * Radial basis function for TPS, mathematically optimized.
 * U(r) = r² · ln(r)
 * U(r) = r² · ln( (r²)^0.5 ) = 0.5 · r² · ln(r²)
 * This safely completely avoids calling Math.sqrt().
 * @param {number} r2 - Distance squared
 * @returns {number}
 */
function kernelU_r2(r2) {
  if (r2 < 1e-20) return 0;
  return 0.5 * r2 * Math.log(r2);
}

/**
 * Legacy wrapper if needed fallback
 */
function kernelU(r) {
  return kernelU_r2(r * r);
}

/**
 * Solve the TPS system for a set of control points.
 * 
 * @param {Array<{sx: number, sy: number, dx: number, dy: number}>} controlPoints
 *   sx, sy = source position (in normalized layer coords [0..1])
 *   dx, dy = destination position (in normalized layer coords [0..1])
 * @returns {{ weightsX: Float64Array, weightsY: Float64Array, n: number, srcPoints: Array } | null}
 */
function solve(controlPoints) {
  const n = controlPoints.length;
  if (n === 0) return null;

  const size = n + 3;
  const L = new Float64Array(size * size);
  const bx = new Float64Array(size);
  const by = new Float64Array(size);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const ddx = controlPoints[i].sx - controlPoints[j].sx;
      const ddy = controlPoints[i].sy - controlPoints[j].sy;
      const r2 = ddx * ddx + ddy * ddy; // Direct squared distance
      const u = kernelU_r2(r2);
      L[i * size + j] = u;
      L[j * size + i] = u;
    }
    L[i * size + i] = 0;
  }

  for (let i = 0; i < n; i++) {
    L[i * size + n] = 1;
    L[i * size + n + 1] = controlPoints[i].sx;
    L[i * size + n + 2] = controlPoints[i].sy;

    L[n * size + i] = 1;
    L[(n + 1) * size + i] = controlPoints[i].sx;
    L[(n + 2) * size + i] = controlPoints[i].sy;
  }

  for (let i = 0; i < n; i++) {
    bx[i] = controlPoints[i].dx - controlPoints[i].sx;
    by[i] = controlPoints[i].dy - controlPoints[i].sy;
  }

  // Solves both X and Y linear combinations against the same symmetric matrix L at once!
  // Slashes the O(N^3) portion of the algorithm exactly in half.
  const { x: weightsX, y: weightsY } = solveLinearSystemMultipleRHS(L, bx, by, size);

  if (!weightsX || !weightsY) {
    console.warn('TPS: Failed to solve linear system');
    return null;
  }

  return {
    weightsX,
    weightsY,
    n,
    srcPoints: controlPoints.map(p => ({ x: p.sx, y: p.sy }))
  };
}

/**
 * Apply TPS deformation to a point. Modulates the base point by the calculated weights.
 * @param {number} x - Input X (normalized)
 * @param {number} y - Input Y (normalized)
 * @param {Object} tpsData - Result from solve()
 * @returns {{x: number, y: number}} (Caution: allocates objects, causes GC overhead in render loop)
 */
function apply(x, y, tpsData) {
  if (!tpsData) return { x, y };

  const { weightsX, weightsY, n, srcPoints } = tpsData;

  let dispX = weightsX[n] + weightsX[n + 1] * x + weightsX[n + 2] * y;
  let dispY = weightsY[n] + weightsY[n + 1] * x + weightsY[n + 2] * y;

  for (let i = 0; i < n; i++) {
    const ddx = x - srcPoints[i].x;
    const ddy = y - srcPoints[i].y;
    const r2 = ddx * ddx + ddy * ddy;
    const u = kernelU_r2(r2);
    dispX += weightsX[i] * u;
    dispY += weightsY[i] * u;
  }

  return { x: x + dispX, y: y + dispY };
}

/**
 * Apply TPS deformation in-place onto a sequence of floats [x0, y0, x1, y1, ...]
 * @param {Float32Array|Float64Array|Array} buffer - the buffer to deform
 * @param {Object} tpsData - Result from solve()
 * @param {number} [length] - Optional boundary index to stop at
 */
function applyBuffer(buffer, tpsData, length = buffer.length) {
  if (!tpsData) return;

  const { weightsX, weightsY, n, srcPoints } = tpsData;
  const wx_n = weightsX[n], wx_n1 = weightsX[n + 1], wx_n2 = weightsX[n + 2];
  const wy_n = weightsY[n], wy_n1 = weightsY[n + 1], wy_n2 = weightsY[n + 2];

  for (let ptr = 0; ptr < length; ptr += 2) {
    const x = buffer[ptr];
    const y = buffer[ptr + 1];
    
    // Quick skip for NaNs (frequently used to split graphic paths in WebGL)
    if (isNaN(x)) continue;

    let dispX = wx_n + wx_n1 * x + wx_n2 * y;
    let dispY = wy_n + wy_n1 * x + wy_n2 * y;

    for (let i = 0; i < n; i++) {
      const ddx = x - srcPoints[i].x;
      const ddy = y - srcPoints[i].y;
      const r2 = ddx * ddx + ddy * ddy;
      
      let u = 0;
      if (r2 >= 1e-20) u = 0.5 * r2 * Math.log(r2);
      
      dispX += weightsX[i] * u;
      dispY += weightsY[i] * u;
    }

    buffer[ptr] = x + dispX;
    buffer[ptr + 1] = y + dispY;
  }
}

/**
 * Solve a linear system A * [X, Y] = [BX, BY] using Gaussian elimination
 * with partial pivoting. Bx and By evaluate sequentially alongside the active row matrix.
 */
function solveLinearSystemMultipleRHS(A, bx, by, n) {
  const x = new Float64Array(n);
  const y = new Float64Array(n);

  for (let col = 0; col < n; col++) {
    let maxVal = Math.abs(A[col * n + col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      const v = Math.abs(A[row * n + col]);
      if (v > maxVal) {
        maxVal = v;
        maxRow = row;
      }
    }

    // Singularity protection
    if (maxVal < 1e-12) {
      A[col * n + col] += 1e-6;
    }

    if (maxRow !== col) {
      for (let j = col; j < n; j++) {
        const tmp = A[col * n + j];
        A[col * n + j] = A[maxRow * n + j];
        A[maxRow * n + j] = tmp;
      }
      
      const tmpBx = bx[col];
      bx[col] = bx[maxRow];
      bx[maxRow] = tmpBx;
      
      const tmpBy = by[col];
      by[col] = by[maxRow];
      by[maxRow] = tmpBy;
    }

    const pivot = A[col * n + col];
    for (let row = col + 1; row < n; row++) {
      const factor = A[row * n + col] / pivot;
      for (let j = col; j < n; j++) {
        A[row * n + j] -= factor * A[col * n + j];
      }
      bx[row] -= factor * bx[col];
      by[row] -= factor * by[col];
    }
  }

  // Back substitution phase
  for (let row = n - 1; row >= 0; row--) {
    let sumX = bx[row];
    let sumY = by[row];
    for (let j = row + 1; j < n; j++) {
      const AVal = A[row * n + j];
      sumX -= AVal * x[j];
      sumY -= AVal * y[j];
    }
    const diag = A[row * n + row];
    if (Math.abs(diag) < 1e-12) {
      x[row] = 0;
      y[row] = 0;
    } else {
      x[row] = sumX / diag;
      y[row] = sumY / diag;
    }
  }

  return { x, y };
}

export const TPS = { solve, apply, applyBuffer, kernelU, kernelU_r2 };
