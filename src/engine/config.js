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
   *  4 levels: 0=original, 1=fine, 2=medium, 3=coarse. */
  epsilons: [0, 0.03, 0.08, 0.25],

  /** Heavy layers (e.g. marias) override the default epsilons for smoother details. */
  layerOverrides: {
    'marias.geojson': [0.008, 0.03, 0.08, 0.25]
  },

  /** effectiveScale thresholds (viewport.scale × transform.scale × layerSize).
   *  [0] = min scale for LOD 0, [1] = min for LOD 1, [2] = min for LOD 2.
   *  Below [2] → LOD 3 (coarsest). */
  scaleThresholds: [3400, 2200, 1200],
};

// ─── GRID ──────────────────────────────────────────────

export const GRID = {
  /** Grid line spacing in degrees per LOD level.
   *  LOD 0 = dense, LOD 3 = sparse. */
  spacingByLOD: [5, 10, 15, 15],

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
  maxDots: 600,

  /** Maximum text labels rendered simultaneously */
  maxLabels: 500,

  /** Speed of label fade-in after a drag (0.01 = very slow, 0.2 = fast) */
  fadeInSpeed: 0.05,

  /** Label anti-overlap hitbox padding (screen pixels) */
  overlapPadding: 30,

  /** Minimum crater diameter (screen px) to show hover tooltip */
  hoverMinScreenDiameter: 4,

  /** Dot visual radius range (screen px, clamped via sqrt) */
  dotRadiusMin: 2.0,
  dotRadiusMax: 2.5,
  dotRadiusScale: 0.35,

  /** Sun incidence opacity */
  nightOpacity: 0.25,
  nightTransitionCosI: 0.1,

  /** Frustum cull margin for crater dots (screen px) */
  cullMargin: 500,

  /** Label offset above the dot (screen px, used as invScale multiplier) */
  labelOffsetY: 10,
};

// ─── CULLING ───────────────────────────────────────────

export const CULLING = {
  /** Viewport margin ratio for GeoJSON pre-culling (1.5 = 150% beyond screen) */
  viewportMargin: 1.5,
};

// ─── RENDER ────────────────────────────────────────────

export const RENDER = {
  /** GeoJSON polygon/line stroke width (world units, scaled by invScale) */
  geoStrokeWidth: 1.5,

  /** GeoJSON point marker radius (world units) */
  geoPointRadius: 3,

  /** Terminator glow line width */
  terminatorGlowWidth: 6.5,
  terminatorGlowColor: 0x4FF2FF,
  terminatorGlowAlpha: 0.4,

  /** Terminator core line width */
  terminatorCoreWidth: 2.5,
  terminatorCoreColor: 0xFFFFFF,

  /** Night mask fill 0x06060c*/
  nightMaskColor: 0x0B0B12,
  nightMaskAlpha: 0.7,

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

  /** Maximum number of anchor pins allowed */
  anchorMaxCount: 10,

  /** Crater detection radius multiplier (1.0 = exact crater radius) */
  anchorCraterDetectMul: 1.5,
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

// ─── GOTO ──────────────────────────────────────────────

export const GOTO = {
  /** Fraction of canvas width the crater should fill (0.6 = 60%) */
  fillFactor: 0.6,

  /** Mean Earth–Moon distance (km) */
  lunarDistKm: 384400,

  /** Lunar diameter (km) */
  lunarDiamKm: 3474.8,

  /** Zoom clamp bounds */
  minZoom: 0.5,
  maxZoom: 30,

  /** Smooth animation duration (ms) */
  animationMs: 400,

  /** Max autocomplete results */
  searchMaxResults: 8,

  /** Min characters before searching */
  searchMinChars: 1,
};

// ─── EMERGENCY ─────────────────────────────────────────

export const EMERGENCY = {
  /** Libration slider ranges (degrees) — real max ~8°, extra margin for combined errors */
  libLatMin: -15,
  libLatMax: 15,
  libLonMin: -15,
  libLonMax: 15,
  libStep: 0.1,

  /** Rotation / Barillet slider range (degrees) */
  rotationMin: -180,
  rotationMax: 180,
  rotationStep: 0.5,

  /** Refraction slider ranges */
  refractionSquashMin: 0.900,
  refractionSquashMax: 1.100,
  refractionSquashStep: 0.002,
  refractionAngleMin: 0,
  refractionAngleMax: 180,
  refractionAngleStep: 0.5,

  /** Sun longitude slider (terminator) */
  sunLonMin: 0,
  sunLonMax: 360,
  sunLonStep: 1,

  /** Pivot anchor visuals */
  pivotColor: 0xFF8C00,
  pivotRadius: 10,
  pivotActiveRadius: 12,
  pivotHaloRadius: 24,
  pivotHaloAlpha: 0.18,
  pivotLineWidth: 2,
  pivotDiamondSize: 8,
};

// ─── STUDIO ────────────────────────────────────────────

export const STUDIO = {
  /** Image adjustment ranges */
  brightnessMin: 0.1, brightnessMax: 3.0, brightnessStep: 0.05, brightnessDefault: 1.0,
  contrastMin: 0.1, contrastMax: 3.0, contrastStep: 0.05, contrastDefault: 1.0,
  clarityMin: -1.0, clarityMax: 1.0, clarityStep: 0.05, clarityDefault: 0.0,
  sharpnessMin: 0, sharpnessMax: 2.0, sharpnessStep: 0.1, sharpnessDefault: 0.0,
  denoisingMin: 0, denoisingMax: 1.0, denoisingStep: 0.05, denoisingDefault: 0.0,

  /** Vignette */
  vignetteMin: 0, vignetteMax: 1.0, vignetteStep: 0.05, vignetteDefault: 0.0,
  vignetteFeatherMin: 0.1, vignetteFeatherMax: 1.0, vignetteFeatherStep: 0.05, vignetteFeatherDefault: 0.5,

  /** Limb glow */
  limbGlowOpacityMin: 0, limbGlowOpacityMax: 1.0, limbGlowOpacityStep: 0.05, limbGlowOpacityDefault: 0.8,
  limbGlowThicknessMin: 0.5, limbGlowThicknessMax: 10, limbGlowThicknessStep: 0.5, limbGlowThicknessDefault: 1.5,
  limbGlowSpreadMin: 0, limbGlowSpreadMax: 50, limbGlowSpreadStep: 1, limbGlowSpreadDefault: 22, // Offset
  limbGlowBlurMin: 0, limbGlowBlurMax: 20, limbGlowBlurStep: 1, limbGlowBlurDefault: 12,

  /** Layer style ranges */
  layerOpacityMin: 0, layerOpacityMax: 1.0, layerOpacityStep: 0.05,
  layerGlowMin: 0, layerGlowMax: 2.0, layerGlowStep: 0.1,
  layerFineMin: 0.5, layerFineMax: 5.0, layerFineStep: 0.1,

  /** Grid ranges */
  gridIntervalMin: 5, gridIntervalMax: 30, gridIntervalStep: 5,
  gridThicknessMin: 0.5, gridThicknessMax: 5.0, gridThicknessStep: 0.5,

  /** Terminator ranges */
  terminatorThicknessMin: 0.5, terminatorThicknessMax: 8.0, terminatorThicknessStep: 0.5,

  /** Night Mask ranges */
  nightMaskOpacityMin: 0.0, nightMaskOpacityMax: 1.0, nightMaskOpacityStep: 0.05,
  nightMaskBlurMin: 0, nightMaskBlurMax: 50, nightMaskBlurStep: 1,

  /** Day Mask ranges */
  dayMaskOpacityMin: 0.0, dayMaskOpacityMax: 0.4, dayMaskOpacityStep: 0.05,
  dayMaskBlurMin: 0, dayMaskBlurMax: 50, dayMaskBlurStep: 1,

  /** Labels ranges */
  labelFontSizeMin: 8, labelFontSizeMax: 36, labelFontSizeStep: 1, labelFontSizeDefault: 14,
  labelSizeMin: 0, labelSizeMax: 1500, labelSizeStep: 10, labelSizeDefaultMin: 0, labelSizeDefaultMax: 1500,
  labelCountMin: 0, labelCountMax: 500, labelCountStep: 10, labelCountDefault: 150,

  /** Rotation */
  rotationMin: -180, rotationMax: 180, rotationStep: 0.5,

  /** Blending modes available */
  blendModes: ['normal', 'add', 'screen', 'multiply', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion'],
  blendModeLabels: {
    normal: 'Normal',
    add: 'Addition',
    screen: 'Écran',
    multiply: 'Produit',
    overlay: 'Incrustation ⚠️',
    darken: 'Obscurcir ⚠️',
    lighten: 'Éclaircir ⚠️',
    'color-dodge': 'Densité - ⚠️',
    'color-burn': 'Densité + ⚠️',
    'hard-light': 'Lumière Dure ⚠️',
    'soft-light': 'Lumière Douce ⚠️',
    difference: 'Différence ⚠️',
    exclusion: 'Exclusion ⚠️',
  },


  /** Limb glow types */
  limbGlowTypes: ['diffraction', 'neon', 'pulse'],
  limbGlowTypeLabels: { diffraction: 'Diffraction', neon: 'Néon', pulse: 'Pulse' },
};

// ─── WEATHER ───────────────────────────────────────────

export const WEATHER = {
  /** OpenWeatherMap API Key (chargée depuis les variables d'environnement) */
  owmApiKey: import.meta.env.VITE_OWM_API_KEY,

  /** Visual Crossing API Key (chargée depuis les variables d'environnement) */
  visualCrossingApiKey: import.meta.env.VITE_VISUAL_CROSSING_API_KEY,

  /** Age threshold in days before falling back to Visual Crossing */
  owmMaxAgeDays: 45,

  /** Age threshold in days to strictly use Visual Crossing */
  vcForceAgeDays: 47,
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
  { stroke: 0xffffff, alpha: 0.75, fill: 0xffffff, fillAlpha: 0.06, name: 'Blanc' },
  { stroke: 0x06060c, alpha: 0.90, fill: 0x06060c, fillAlpha: 0.90, name: 'Noir' },
];

// ─── CONFIG EVENTS ─────────────────────────────────────

export const configEvents = new EventTarget();

/**
 * Updates a configuration value and triggers a 'configChanged' event.
 * @param {string} section - e.g. 'RENDER', 'GRID'
 * @param {string} key - e.g. 'geoStrokeWidth'
 * @param {any} value - The new value
 */
export function updateConfig(section, key, value) {
  let confObj;
  switch (section) {
    case 'LOD': confObj = LOD; break;
    case 'GRID': confObj = GRID; break;
    case 'LABELS': confObj = LABELS; break;
    case 'CULLING': confObj = CULLING; break;
    case 'RENDER': confObj = RENDER; break;
    case 'PERF': confObj = PERF; break;
    default: return false;
  }
  
  if (confObj && key in confObj) {
    const oldValue = confObj[key];
    confObj[key] = value;
    
    // Dispatch event so that listeners (like renderer) can partially redraw
    const event = new CustomEvent('configChanged', {
      detail: { section, key, oldValue, newValue: value }
    });
    configEvents.dispatchEvent(event);
    return true;
  }
  return false;
}

// Expose for console testing
if (typeof window !== 'undefined') {
  window.AppConfig = { updateConfig };
}
