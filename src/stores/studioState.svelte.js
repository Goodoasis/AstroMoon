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
  cropRatio = $state('free'); // 'free', '16:9', '4:3', '1:1', '3:2'

  // ─── Layer Visibility & Style (keyed by layer filename) ───
  layerVisibility = $state({});   // { 'marias.geojson': true, ... }
  layerOpacity = $state({});      // { 'marias.geojson': 1.0, ... }
  layerBlendMode = $state({});    // { 'marias.geojson': 'normal', ... }
  layerColor = $state({});        // { 'marias.geojson': 0, ... } (palette index)
  layerGlow = $state({});         // { 'marias.geojson': 0.5, ... }
  layerFine = $state({});         // { 'marias.geojson': 1.5, ... }
  layerSmooth = $state({});       // { 'marias.geojson': false, ... }

  // ─── Grid ───
  gridVisible = $state(false);
  gridInterval = $state(10);
  gridThickness = $state(1.5);
  gridColor = $state(8);
  gridOpacity = $state(1.0);
  gridBlendMode = $state('normal');
  gridGlow = $state(0.0);

  // ─── Terminator ───
  terminatorVisible = $state(true);
  terminatorThickness = $state(2.5);
  terminatorColor = $state(8);
  terminatorOpacity = $state(1.0);
  terminatorBlendMode = $state('normal');
  terminatorGlow = $state(1.0);

  // ─── Night Mask ───
  nightMaskVisible = $state(true);
  nightMaskColor = $state(9); // Noir
  nightMaskOpacity = $state(0.75);
  nightMaskBlendMode = $state('normal');
  nightMaskBlur = $state(0);

  // ─── Labels & Annotations ───
  showCompass = $state(false);
  dynamicShadow = $state(false);
  /** @type {Set<string>} Crater names pinned visible regardless of zoom */
  pinnedCraters = $state(new Set());
  /** @type {Array<{id: number, text: string, x: number, y: number}>} */
  customLabels = $state([]);
  nextLabelId = $state(1);

  // ─── Effects ───
  limbGlow = $state(false);
  limbGlowIntensity = $state(STUDIO.limbGlowDefault);
  limbGlowType = $state('diffraction'); // 'diffraction', 'neon', 'pulse'
  useShaderGlow = $state(true); // Global toggle for pixi-filters Shader Glow (High Quality)

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
        this.layerSmooth[name] = false;
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
    this.cropRatio = 'free';
    this.layerVisibility = {};
    this.layerOpacity = {};
    this.layerBlendMode = {};
    this.layerColor = {};
    this.layerGlow = {};
    this.layerFine = {};
    this.layerSmooth = {};
    this.gridVisible = false;
    this.gridInterval = 10;
    this.gridThickness = 1.5;
    this.gridColor = 8;
    this.gridOpacity = 1.0;
    this.gridBlendMode = 'normal';
    this.gridGlow = 0.0;
    
    this.terminatorVisible = true;
    this.terminatorThickness = 2.5;
    this.terminatorColor = 8;
    this.terminatorOpacity = 1.0;
    this.terminatorBlendMode = 'normal';
    this.terminatorGlow = 1.0;

    this.nightMaskVisible = true;
    this.nightMaskColor = 9; // Index of 'Noir' in LAYER_PALETTE
    this.nightMaskOpacity = 0.75;
    this.nightMaskBlendMode = 'normal';
    this.nightMaskBlur = 0;

    this.showCompass = false;
    this.dynamicShadow = false;
    this.pinnedCraters = new Set();
    this.customLabels = [];
    this.nextLabelId = 1;
    this.limbGlow = false;
    this.limbGlowIntensity = STUDIO.limbGlowDefault;
    this.limbGlowType = 'diffraction';
    this.useShaderGlow = true;
  }
}

export const studioState = new StudioState();
