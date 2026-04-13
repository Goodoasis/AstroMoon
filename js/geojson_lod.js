import { LOD } from './config.js';

/**
 * AstroMoon — GeoJSON LOD (Level of Detail) Module
 * 
 * Provides Douglas-Peucker simplification and multi-resolution LOD
 * generation for heavy GeoJSON polygon data.
 * 
 * Design constraints:
 *   - Pure module (no DOM, no PixiJS) → importable by Web Worker
 *   - Iterative DP (no recursion → safe on 337K+ point rings)
 *   - Zero external dependencies
 * 
 * LOD Levels:
 *   0 = full resolution (original data)
 *   1 = medium (ε ≈ 0.2 in degree-space, ~33% of vertices)
 *   2 = coarse (ε ≈ 0.6 in degree-space, ~10% of vertices)
 */

// ─── Douglas-Peucker (Iterative) ───

/**
 * Perpendicular distance from point P to line segment A→B.
 * @param {number} px 
 * @param {number} py 
 * @param {number} ax 
 * @param {number} ay 
 * @param {number} bx 
 * @param {number} by 
 * @returns {number}
 */
function perpendicularDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq < 1e-20) {
    // A and B are the same point
    const ex = px - ax;
    const ey = py - ay;
    return Math.sqrt(ex * ex + ey * ey);
  }

  // Project P onto line A→B, clamped to segment
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  const ex = px - projX;
  const ey = py - projY;
  return Math.sqrt(ex * ex + ey * ey);
}

/**
 * Iterative Douglas-Peucker simplification.
 * Avoids recursion to prevent stack overflow on very large rings (337K+ points).
 * 
 * @param {Array<[number, number]>} ring - Array of [lon, lat] or [x, y] coordinate pairs
 * @param {number} epsilon - Tolerance threshold (in same units as coordinates)
 * @returns {Array<[number, number]>} Simplified ring
 */
function douglasPeucker(ring, epsilon) {
  const n = ring.length;
  if (n <= 2) return ring.slice();

  // Boolean mask: true = keep this point
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;

  // Explicit stack replaces recursion: [startIndex, endIndex]
  const stack = [[0, n - 1]];

  while (stack.length > 0) {
    const [start, end] = stack.pop();

    if (end - start < 2) continue;

    const ax = ring[start][0], ay = ring[start][1];
    const bx = ring[end][0], by = ring[end][1];

    let maxDist = 0;
    let maxIdx = start;

    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistance(ring[i][0], ring[i][1], ax, ay, bx, by);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }

    if (maxDist > epsilon) {
      keep[maxIdx] = 1;
      // Push both halves onto stack (order doesn't matter for correctness)
      stack.push([start, maxIdx]);
      stack.push([maxIdx, end]);
    }
  }

  // Collect kept points
  const result = [];
  for (let i = 0; i < n; i++) {
    if (keep[i]) result.push(ring[i]);
  }
  return result;
}

// ─── LOD Generation ───

/**
 * Generate multi-level LOD coordinate arrays for a set of features.
 * 
 * Each feature receives a `lodCoords` property: an array of length `thresholds.length`,
 * where `lodCoords[level]` contains the simplified ring arrays for that LOD.
 * 
 * lodCoords[0] = original (epsilon=0, no simplification)
 * lodCoords[1] = medium simplification
 * lodCoords[2] = coarse simplification
 * 
 * @param {Array} features - Parsed GeoJSON features with `coords` property (array of rings)
 * @param {number[]} [thresholds] - Epsilon values per LOD level. Index 0 should be 0 (full res).
 * @returns {{ totalOriginal: number, totalPerLOD: number[] }} Statistics
 */
function generateLODs(features, thresholds = LOD.epsilons) {
  const numLevels = thresholds.length;
  const totalPerLOD = new Array(numLevels).fill(0);
  let totalOriginal = 0;

  for (const feature of features) {
    if (!feature.coords) continue;

    feature.lodCoords = new Array(numLevels);

    for (let level = 0; level < numLevels; level++) {
      const eps = thresholds[level];

      if (eps === 0) {
        // LOD 0 = original data, no copy needed (shared reference)
        feature.lodCoords[level] = feature.coords;
        for (const ring of feature.coords) {
          totalPerLOD[level] += ring.length;
          if (level === 0) totalOriginal += ring.length;
        }
      } else {
        // Simplify each ring independently
        const simplified = [];
        for (const ring of feature.coords) {
          const simRing = douglasPeucker(ring, eps);
          // Ensure closed polygon rings stay closed (first == last)
          if (feature.type === 'polygon' && simRing.length >= 3) {
            const first = simRing[0];
            const last = simRing[simRing.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
              simRing.push([first[0], first[1]]);
            }
          }
          // Don't degenerate: keep at least 3 points for polygons, 2 for lines
          const minPts = feature.type === 'polygon' ? 4 : 2; // 4 because closed = first+last same
          if (simRing.length >= minPts) {
            simplified.push(simRing);
          }
          // else: ring is too small at this LOD — drop it entirely (invisible at this zoom)
          totalPerLOD[level] += simRing.length >= minPts ? simRing.length : 0;
        }
        feature.lodCoords[level] = simplified;
      }
    }
  }

  return { totalOriginal, totalPerLOD };
}

// ─── LOD Selection ───

/**
 * Select the appropriate LOD level based on effective viewport scale.
 * 
 * @param {number} viewportScale - Current viewport.scale
 * @param {number} transformScale - Current Transform state.scale
 * @param {number} layerSize - Current Transform state.layerSize
 * @returns {number} LOD index (0 = full, 1 = medium, 2 = coarse)
 */
function selectLOD(viewportScale, transformScale, layerSize) {
  const effectiveScale = viewportScale * transformScale * layerSize;
  if (effectiveScale >= LOD.scaleThresholds[0]) return 0; // Full detail
  if (effectiveScale >= LOD.scaleThresholds[1]) return 1; // Medium
  return 2; // Coarse
}

// ─── Export ───

export const GeoJSONLod = {
  douglasPeucker,
  generateLODs,
  selectLOD
};
