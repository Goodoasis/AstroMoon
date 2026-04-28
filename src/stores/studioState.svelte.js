/**
 * AstroMoon — Studio Phase State Store (Svelte 5 Runes)
 * Holds all Studio panel UI state. Reset on project unload.
 * Heavy render data (textures, buffers) must NOT use $state.
 */

import { STUDIO } from '@/engine/config.js';

class StudioState {
  // ─── Image Adjustments ───
  brightness = $state(STUDIO.brightnessDefault);
  contrast = $state(STUDIO.contrastDefault);
  clarity = $state(STUDIO.clarityDefault);
  sharpness = $state(STUDIO.sharpnessDefault);
  denoising = $state(STUDIO.denoisingDefault);
  grayscale = $state(false);

  // ─── Vignette ───
  vignette = $state(STUDIO.vignetteDefault);
  vignetteFeather = $state(STUDIO.vignetteFeatherDefault);

  // ─── Transform ───
  rotation = $state(0);
  flipH = $state(false);
  flipV = $state(false);

  // ─── Layer Visibility & Style (keyed by layer filename) ───
  layerVisibility = $state({});   // { 'marias.geojson': true, ... }
  layerOpacity = $state({});      // { 'marias.geojson': 1.0, ... }
  layerBlendMode = $state({});    // { 'marias.geojson': 'normal', ... }
  layerColor = $state({});        // { 'marias.geojson': 0, ... } (palette index)
  layerGlow = $state({});         // { 'marias.geojson': 0.5, ... }
  layerFine = $state({});         // { 'marias.geojson': 1.5, ... }
  layerSmooth = $state({});       // { 'marias.geojson': false, ... }
  layerBlur = $state({});         // { 'marias.geojson': 0, ... }

  // ─── Grid ───
  gridVisible = $state(false);
  gridInterval = $state(10);
  gridThickness = $state(1.5);
  gridColor = $state(8);
  gridOpacity = $state(1.0);
  gridBlendMode = $state('normal');
  gridGlow = $state(0.0);
  gridBlur = $state(0.0);

  // ─── Terminator ───
  terminatorVisible = $state(true);
  terminatorThickness = $state(2.5);
  terminatorColor = $state(8);
  terminatorOpacity = $state(1.0);
  terminatorBlendMode = $state('normal');
  terminatorGlow = $state(1.0);
  terminatorBlur = $state(0.0);

  // ─── Night Mask ───
  nightMaskVisible = $state(true);
  nightMaskColor = $state(9); // Noir
  nightMaskOpacity = $state(0.75);
  nightMaskBlendMode = $state('normal');
  nightMaskBlur = $state(0);

  // ─── Day Mask ───
  dayMaskVisible = $state(true);
  dayMaskColor = $state(4); // Vert
  dayMaskOpacity = $state(0.05);
  dayMaskBlendMode = $state('normal');
  dayMaskBlur = $state(25);

  // ─── Labels & Annotations ───
  showCompass = $state(false);
  dynamicShadow = $state(false);
  /** @type {Set<string>} Crater names pinned visible regardless of zoom */
  pinnedCraters = $state(new Set());
  /** @type {Array<{id: number, text: string, x: number, y: number}>} */
  customLabels = $state([]);
  nextLabelId = $state(1);

  // Label UI parameters
  labelFontSize = $state(14);
  labelMinSize = $state(0);
  labelMaxSize = $state(1500);
  labelCount = $state(150);
  labelHiddenTypes = $state(new Set());
  labelColorPoints = $state(3);
  labelColorText = $state(8);

  // ─── Effects ───
  limbGlow = $state(true);
  limbGlowColor = $state(0); // Index in LAYER_PALETTE
  limbGlowOpacity = $state(STUDIO.limbGlowOpacityDefault);
  limbGlowThickness = $state(STUDIO.limbGlowThicknessDefault);
  limbGlowSpread = $state(STUDIO.limbGlowSpreadDefault);
  limbGlowBlur = $state(STUDIO.limbGlowBlurDefault);
  useShaderGlow = $state(true); // Global toggle for pixi-filters Shader Glow (High Quality)

  /**
   * Toggle pinned state for a crater label.
   * @param {string} name Crater name
   */
  togglePinnedCrater(name) {
    if (this.pinnedCraters.has(name)) {
      this.pinnedCraters.delete(name);
    } else {
      this.pinnedCraters.add(name);
    }
    this.pinnedCraters = new Set(this.pinnedCraters);
  }

  /**
   * Initialize layer maps from loaded layer names.
   * @param {string[]} layerNames
   */
  initLayers(layerNames) {
    layerNames.forEach((name, index) => {
      if (!(name in this.layerVisibility)) {
        this.layerVisibility[name] = true;
        this.layerOpacity[name] = 1.0;
        this.layerBlendMode[name] = 'normal';
        this.layerColor[name] = index;
        this.layerGlow[name] = 0.0;
        this.layerFine[name] = 1.5;
        this.layerSmooth[name] = true; // Enabled by default in Studio
        this.layerBlur[name] = 0;
      }
    });
  }

  reset() {
    this.brightness = STUDIO.brightnessDefault;
    this.contrast = STUDIO.contrastDefault;
    this.clarity = STUDIO.clarityDefault;
    this.sharpness = STUDIO.sharpnessDefault;
    this.denoising = STUDIO.denoisingDefault;
    this.grayscale = false;
    this.vignette = STUDIO.vignetteDefault;
    this.vignetteFeather = STUDIO.vignetteFeatherDefault;
    this.rotation = 0;
    this.flipH = false;
    this.flipV = false;
    this.layerVisibility = {};
    this.layerOpacity = {};
    this.layerBlendMode = {};
    this.layerColor = {};
    this.layerGlow = {};
    this.layerFine = {};
    this.layerSmooth = {};
    this.layerBlur = {};
    this.gridVisible = false;
    this.gridInterval = 10;
    this.gridThickness = 1.5;
    this.gridColor = 8;
    this.gridOpacity = 1.0;
    this.gridBlendMode = 'normal';
    this.gridGlow = 0.0;
    this.gridBlur = 0.0;
    
    this.terminatorVisible = true;
    this.terminatorThickness = 2.5;
    this.terminatorColor = 8;
    this.terminatorOpacity = 1.0;
    this.terminatorBlendMode = 'normal';
    this.terminatorGlow = 1.0;
    this.terminatorBlur = 0.0;

    this.nightMaskVisible = true;
    this.nightMaskColor = 9; // Index of 'Noir' in LAYER_PALETTE
    this.nightMaskOpacity = 0.75;
    this.nightMaskBlendMode = 'normal';
    this.nightMaskBlur = 0;

    this.dayMaskVisible = true;
    this.dayMaskColor = 4;
    this.dayMaskOpacity = 0.05;
    this.dayMaskBlendMode = 'normal';
    this.dayMaskBlur = 25;

    this.showCompass = false;
    this.dynamicShadow = false;
    this.pinnedCraters = new Set();
    this.customLabels = [];
    this.nextLabelId = 1;

    this.labelFontSize = STUDIO.labelFontSizeDefault;
    this.labelMinSize = STUDIO.labelSizeDefaultMin;
    this.labelMaxSize = STUDIO.labelSizeDefaultMax;
    this.labelCount = STUDIO.labelCountDefault;
    this.labelHiddenTypes = new Set();
    this.labelColorPoints = 3;
    this.labelColorText = 8;
    this.limbGlow = true;
    this.limbGlowColor = 0;
    this.limbGlowOpacity = STUDIO.limbGlowOpacityDefault;
    this.limbGlowThickness = STUDIO.limbGlowThicknessDefault;
    this.limbGlowSpread = STUDIO.limbGlowSpreadDefault;
    this.limbGlowBlur = STUDIO.limbGlowBlurDefault;
    this.useShaderGlow = true;
  }
}

export const studioState = new StudioState();
