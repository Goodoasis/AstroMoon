/**
 * AstroMoon — Central Configuration
 * 
 * All tunable performance, rendering, and display constants live here.
 * Import this module wherever magic numbers were previously hardcoded.
 * 
 * Sections:
 *   LOD      – Level of Detail thresholds & Douglas-Peucker epsilons
 *   GRID     – Selenographic grid density per LOD
 *   LABELS   – Crater annotation limits and layout
 *   CULLING  – Viewport margin for pre-culling
 *   RENDER   – Line widths, stroke, and fill defaults
 *   PERF     – Debounce timers and throttles
 */

// ─── LOD ───────────────────────────────────────────────

export const LOD = {
  /** Douglas-Peucker epsilon per level (degree-space).
   *  Index 0 = no simplification (original), higher = more aggressive. */
  epsilons: [0.15, 0.3, 0.5],

  /** effectiveScale thresholds (viewport.scale × transform.scale × layerSize).
   *  [0] = min scale for LOD 0 (full), [1] = min scale for LOD 1 (medium).
   *  Below [1] → LOD 2 (coarse). */
  scaleThresholds: [3000, 1200],
};

// ─── GRID ──────────────────────────────────────────────

export const GRID = {
  /** Grid line spacing in degrees per LOD level.
   *  LOD 0 = dense, LOD 2 = sparse. */
  spacingByLOD: [10, 15, 30],

  /** Sampling step along each grid line (degrees).
   *  Lower = smoother curves, higher = fewer points. */
  sampleStep: 2,

  /** Grid line stroke */
  lineWidth: 1.5,
  lineColor: 0xffffff,
  lineAlpha: 0.7,

  /** Horizon circle */
  horizonWidth: 1.5,
  horizonColor: 0xffffff,
  horizonAlpha: 0.6,
  horizonStep: 5, // degrees per segment
};

// ─── LABELS ────────────────────────────────────────────

export const LABELS = {
  /** Maximum visible crater dots on screen */
  maxDots: 250,

  /** Maximum text labels rendered simultaneously */
  maxLabels: 150,

  /** Label anti-overlap hitbox padding (screen pixels) */
  overlapPadding: 30,

  /** Minimum crater diameter (screen px) to show hover tooltip */
  hoverMinScreenDiameter: 4,

  /** Dot visual radius range (screen px, clamped via sqrt) */
  dotRadiusMin: 2.0,
  dotRadiusMax: 3.0,
  dotRadiusScale: 0.35,

  /** Sun incidence opacity */
  nightOpacity: 0.25,
  nightTransitionCosI: 0.1,

  /** Frustum cull margin for crater dots (screen px) */
  cullMargin: 200,

  /** Label offset above the dot (screen px, used as invScale multiplier) */
  labelOffsetY: 10,
};

// ─── CULLING ───────────────────────────────────────────

export const CULLING = {
  /** Viewport margin ratio for GeoJSON pre-culling (0.3 = 30% beyond screen) */
  viewportMargin: 0.3,
};

// ─── RENDER ────────────────────────────────────────────

export const RENDER = {
  /** GeoJSON polygon/line stroke width (world units, scaled by invScale) */
  geoStrokeWidth: 1.5,

  /** GeoJSON point marker radius (world units) */
  geoPointRadius: 3,

  /** Terminator glow line width */
  terminatorGlowWidth: 3.0,
  terminatorGlowColor: 0xe0faff,

  /** Terminator core line width */
  terminatorCoreWidth: 1.5,
  terminatorCoreColor: 0xffffff,

  /** Night mask fill */
  nightMaskColor: 0x06060c,
  nightMaskAlpha: 0.75,

  /** Anchor visuals */
  anchorSrcRadius: 5,
  anchorSrcColor: 0xff6b35,
  anchorDstRadius: 7,
  anchorDstActiveRadius: 9,
  anchorDstColor: 0x00ff88,
  anchorHaloRadius: 18,
  anchorHaloAlpha: 0.12,
  anchorLineWidth: 1,
  anchorLineAlpha: 0.3,
};

// ─── PERF ──────────────────────────────────────────────

export const PERF = {
  /** Debounce delay before triggering a quality rebuild (ms) */
  rebuildDebounceMs: 150,

  /** Duration after pan/zoom to consider "interacting" for label fade (ms) */
  interactionFadeMs: 150,

  /** Nominatim search debounce (ms) */
  searchDebounceMs: 400,

  /** Minimum search query length for predictions */
  searchMinChars: 3,
};

// ─── LAYER PALETTE ─────────────────────────────────────

export const LAYER_PALETTE = [
  { stroke: 0x00d4ff, alpha: 0.75, fill: 0x00d4ff, fillAlpha: 0.06, name: 'Cyan' },
  { stroke: 0xff6b35, alpha: 0.75, fill: 0xff6b35, fillAlpha: 0.06, name: 'Orange' },
  { stroke: 0xa36aff, alpha: 0.75, fill: 0xa36aff, fillAlpha: 0.06, name: 'Violet' },
  { stroke: 0xffd700, alpha: 0.75, fill: 0xffd700, fillAlpha: 0.06, name: 'Gold' },
  { stroke: 0x00ff88, alpha: 0.75, fill: 0x00ff88, fillAlpha: 0.06, name: 'Vert' },
  { stroke: 0xff69b4, alpha: 0.75, fill: 0xff69b4, fillAlpha: 0.06, name: 'Rose' },
  { stroke: 0x64c8ff, alpha: 0.75, fill: 0x64c8ff, fillAlpha: 0.06, name: 'Bleu clair' },
  { stroke: 0xffa050, alpha: 0.75, fill: 0xffa050, fillAlpha: 0.06, name: 'Pêche' },
];
