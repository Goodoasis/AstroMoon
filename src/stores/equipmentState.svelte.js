/**
 * AstroMoon — Equipment State Store (Svelte 5 Runes)
 * Stores astrophotography hardware parameters and equipment selection.
 */

// Sentinel item for "no barlow" — shown as selected by default
export const BARLOW_NONE = Object.freeze({
  name: 'Aucun',
  brand: '',
  type: 'none',
  multiplier: 1.0
});

class EquipmentState {
  // --- Computed parameters (auto-filled or manual) ---
  focalLength = $state(1000); // mm
  pixelSize = $state(3.76); // µm
  sensorWidth = $state(6248); // pixels (e.g., IMX571)
  sensorHeight = $state(4176); // pixels
  multiplier = $state(1.0); // Barlow/Reducer
  aperture = $state(200); // mm (telescope aperture)

  // --- Equipment selection ---
  selectedTelescope = $state(null); // { name, brand, type, aperture, focal }
  selectedCamera = $state(null);    // { name, brand, type, sensor, pixel_size, sensor_width, sensor_height, color }
  selectedBarlow = $state(BARLOW_NONE); // Default: no barlow (×1.0)
  isManualMode = $state(false);     // true = raw manual inputs, no autocomplete

  // --- Custom equipment names (when "manual / not listed") ---
  customTelescopeName = $state('');
  customCameraName = $state('');
  customBarlowName = $state('');

  // Verification flags (persisted across phase changes)
  focalVerified = $state(false);
  pixelVerified = $state(false);
  sensorVerified = $state(false);
  multiplierVerified = $state(true); // "Aucun" (×1.0) is valid by default

  /**
   * Computed effective focal length
   */
  get effectiveFocal() {
    return this.focalLength * this.multiplier;
  }

  /**
   * Computed F/D ratio
   */
  get fRatio() {
    if (this.aperture <= 0) return 0;
    return Math.round(((this.focalLength * this.multiplier) / this.aperture) * 10) / 10;
  }

  /**
   * Apply telescope selection — auto-fills focal and aperture
   */
  applyTelescope(item) {
    this.selectedTelescope = item;
    this.customTelescopeName = '';
    if (item) {
      this.focalLength = item.focal;
      this.aperture = item.aperture;
      this.focalVerified = true;
    }
  }

  /**
   * Apply camera selection — auto-fills pixel size and sensor dimensions
   */
  applyCamera(item) {
    this.selectedCamera = item;
    this.customCameraName = '';
    if (item) {
      this.pixelSize = item.pixel_size;
      this.sensorWidth = item.sensor_width;
      this.sensorHeight = item.sensor_height;
      this.pixelVerified = true;
      this.sensorVerified = true;
    }
  }

  /**
   * Apply barlow/reducer selection — auto-fills multiplier
   */
  applyBarlow(item) {
    this.selectedBarlow = item;
    this.customBarlowName = '';
    this.multiplier = item ? item.multiplier : 1.0;
    this.multiplierVerified = true;
  }

  /**
   * Switch to manual mode (clears equipment selections)
   */
  setManualMode(val) {
    this.isManualMode = val;
    if (val) {
      this.selectedTelescope = null;
      this.selectedCamera = null;
      this.selectedBarlow = null;
    }
  }

  resetVerification() {
    this.focalVerified = false;
    this.pixelVerified = false;
    this.sensorVerified = false;
    this.multiplierVerified = true; // Reset to "Aucun" (×1.0)
    
    // We also reset selection objects based on the new class structure naming
    // The previous implementation did this inside resetVerification, so we stick to it
    this.selectedTelescope = null;
    this.selectedCamera = null;
    this.selectedBarlow = BARLOW_NONE;
    this.multiplier = 1.0;
    this.customTelescopeName = '';
    this.customCameraName = '';
    this.customBarlowName = '';
    this.isManualMode = false;
  }
}

export const equipmentState = new EquipmentState();
