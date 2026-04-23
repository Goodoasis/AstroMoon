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
  layerSmooth = $state({});       // { 'marias.geojson': false, ... }

  // ─── Grid ───
  gridVisible = $state(false);
  gridInterval = $state(10);
  gridThickness = $state(1.5);
  gridColor = $state('#ffffff');

  // ─── Terminator ───
  terminatorVisible = $state(true);
  terminatorThickness = $state(2.5);
  terminatorColor = $state('#4FF2FF');

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

  /**
   * Initialize layer maps from loaded layer names.
   * @param {string[]} layerNames
   */
  initLayers(layerNames) {
    for (const name of layerNames) {
      if (!(name in this.layerVisibility)) {
        this.layerVisibility[name] = true;
        this.layerOpacity[name] = 1.0;
        this.layerBlendMode[name] = 'normal';
        this.layerColor[name] = 0;
        this.layerGlow[name] = 0.5;
        this.layerSmooth[name] = false;
      }
    }
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
    this.layerSmooth = {};
    this.gridVisible = false;
    this.gridInterval = 10;
    this.gridThickness = 1.5;
    this.gridColor = '#ffffff';
    this.terminatorVisible = true;
    this.terminatorThickness = 2.5;
    this.terminatorColor = '#4FF2FF';
    this.showCompass = false;
    this.dynamicShadow = false;
    this.pinnedCraters = new Set();
    this.customLabels = [];
    this.nextLabelId = 1;
    this.limbGlow = false;
    this.limbGlowIntensity = STUDIO.limbGlowDefault;
    this.limbGlowType = 'diffraction';
  }
}

export const studioState = new StudioState();
