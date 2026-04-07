/**
 * AstroMoon — Thin Plate Spline (TPS) Implementation
 * 
 * The TPS is the standard method for "rubber sheeting" in cartography.
 * It produces a smooth (C¹) deformation that passes exactly through
 * all control points (anchors).
 * 
 * For N control points, we solve two (N+3)×(N+3) linear systems
 * (one for X displacements, one for Y displacements).
 * 
 * Kernel function: U(r) = r² · ln(r)  (with U(0) = 0)
 */

/**
 * Radial basis function for TPS.
 * @param {number} r - Distance
 * @returns {number}
 */
function kernelU(r) {
  if (r < 1e-10) return 0;
  return r * r * Math.log(r);
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
      const r = Math.sqrt(ddx * ddx + ddy * ddy);
      const u = kernelU(r);
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

  const weightsX = solveLinearSystem(L.slice(), bx, size);
  const weightsY = solveLinearSystem(L.slice(), by, size);

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
 * Apply TPS deformation to a point.
 * @param {number} x - Input X (normalized)
 * @param {number} y - Input Y (normalized)
 * @param {Object} tpsData - Result from solve()
 * @returns {{x: number, y: number}}
 */
function apply(x, y, tpsData) {
  if (!tpsData) return { x, y };

  const { weightsX, weightsY, n, srcPoints } = tpsData;

  let dispX = weightsX[n] + weightsX[n + 1] * x + weightsX[n + 2] * y;
  let dispY = weightsY[n] + weightsY[n + 1] * x + weightsY[n + 2] * y;

  for (let i = 0; i < n; i++) {
    const ddx = x - srcPoints[i].x;
    const ddy = y - srcPoints[i].y;
    const r = Math.sqrt(ddx * ddx + ddy * ddy);
    const u = kernelU(r);
    dispX += weightsX[i] * u;
    dispY += weightsY[i] * u;
  }

  return { x: x + dispX, y: y + dispY };
}

/**
 * Solve a linear system Ax = b using Gaussian elimination with partial pivoting.
 */
function solveLinearSystem(A, b, n) {
  const x = new Float64Array(n);

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

    if (maxVal < 1e-12) {
      A[col * n + col] += 1e-6;
    }

    if (maxRow !== col) {
      for (let j = col; j < n; j++) {
        const tmp = A[col * n + j];
        A[col * n + j] = A[maxRow * n + j];
        A[maxRow * n + j] = tmp;
      }
      const tmp = b[col];
      b[col] = b[maxRow];
      b[maxRow] = tmp;
    }

    const pivot = A[col * n + col];
    for (let row = col + 1; row < n; row++) {
      const factor = A[row * n + col] / pivot;
      for (let j = col; j < n; j++) {
        A[row * n + j] -= factor * A[col * n + j];
      }
      b[row] -= factor * b[col];
    }
  }

  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row];
    for (let j = row + 1; j < n; j++) {
      sum -= A[row * n + j] * x[j];
    }
    const diag = A[row * n + row];
    if (Math.abs(diag) < 1e-12) {
      x[row] = 0;
    } else {
      x[row] = sum / diag;
    }
  }

  return x;
}

export const TPS = { solve, apply, kernelU };
