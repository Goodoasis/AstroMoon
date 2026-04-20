/**
 * AstroMoon — Equipment State Store (Svelte 5 Runes)
 * Stores astrophotography hardware parameters and equipment selection.
 */

// --- Computed parameters (auto-filled or manual) ---
let _focalLength = $state(1000); // mm
let _pixelSize = $state(3.76); // µm
let _sensorWidth = $state(6248); // pixels (e.g., IMX571)
let _sensorHeight = $state(4176); // pixels
let _multiplier = $state(1.0); // Barlow/Reducer
let _aperture = $state(200); // mm (telescope aperture)

// Sentinel item for "no barlow" — shown as selected by default
export const BARLOW_NONE = Object.freeze({
  name: 'Aucun',
  brand: '',
  type: 'none',
  multiplier: 1.0
});

// --- Equipment selection ---
let _selectedTelescope = $state(null); // { name, brand, type, aperture, focal }
let _selectedCamera = $state(null);    // { name, brand, type, sensor, pixel_size, sensor_width, sensor_height, color }
let _selectedBarlow = $state(BARLOW_NONE); // Default: no barlow (×1.0)
let _isManualMode = $state(false);     // true = raw manual inputs, no autocomplete

// --- Custom equipment names (when "manual / not listed") ---
let _customTelescopeName = $state('');
let _customCameraName = $state('');
let _customBarlowName = $state('');

// Verification flags (persisted across phase changes)
let _focalVerified = $state(false);
let _pixelVerified = $state(false);
let _sensorVerified = $state(false);
let _multiplierVerified = $state(true); // "Aucun" (×1.0) is valid by default

export const equipmentState = {
  // --- Numeric parameters ---
  get focalLength() { return _focalLength; },
  set focalLength(v) { _focalLength = v; },
  
  get pixelSize() { return _pixelSize; },
  set pixelSize(v) { _pixelSize = v; },
  
  get sensorWidth() { return _sensorWidth; },
  set sensorWidth(v) { _sensorWidth = v; },
  
  get sensorHeight() { return _sensorHeight; },
  set sensorHeight(v) { _sensorHeight = v; },
  
  get multiplier() { return _multiplier; },
  set multiplier(v) { _multiplier = v; },

  get aperture() { return _aperture; },
  set aperture(v) { _aperture = v; },

  // --- Equipment selection ---
  get selectedTelescope() { return _selectedTelescope; },
  set selectedTelescope(v) { _selectedTelescope = v; },

  get selectedCamera() { return _selectedCamera; },
  set selectedCamera(v) { _selectedCamera = v; },

  get selectedBarlow() { return _selectedBarlow; },
  set selectedBarlow(v) { _selectedBarlow = v; },

  get isManualMode() { return _isManualMode; },
  set isManualMode(v) { _isManualMode = v; },

  // --- Custom names ---
  get customTelescopeName() { return _customTelescopeName; },
  set customTelescopeName(v) { _customTelescopeName = v; },

  get customCameraName() { return _customCameraName; },
  set customCameraName(v) { _customCameraName = v; },

  get customBarlowName() { return _customBarlowName; },
  set customBarlowName(v) { _customBarlowName = v; },

  // --- Verification flags ---
  get focalVerified() { return _focalVerified; },
  set focalVerified(v) { _focalVerified = v; },

  get pixelVerified() { return _pixelVerified; },
  set pixelVerified(v) { _pixelVerified = v; },

  get sensorVerified() { return _sensorVerified; },
  set sensorVerified(v) { _sensorVerified = v; },

  get multiplierVerified() { return _multiplierVerified; },
  set multiplierVerified(v) { _multiplierVerified = v; },
  
  /**
   * Computed effective focal length
   */
  get effectiveFocal() {
    return _focalLength * _multiplier;
  },

  /**
   * Computed F/D ratio
   */
  get fRatio() {
    if (_aperture <= 0) return 0;
    return Math.round(((_focalLength * _multiplier) / _aperture) * 10) / 10;
  },

  /**
   * Apply telescope selection — auto-fills focal and aperture
   */
  applyTelescope(item) {
    _selectedTelescope = item;
    _customTelescopeName = '';
    if (item) {
      _focalLength = item.focal;
      _aperture = item.aperture;
      _focalVerified = true;
    }
  },

  /**
   * Apply camera selection — auto-fills pixel size and sensor dimensions
   */
  applyCamera(item) {
    _selectedCamera = item;
    _customCameraName = '';
    if (item) {
      _pixelSize = item.pixel_size;
      _sensorWidth = item.sensor_width;
      _sensorHeight = item.sensor_height;
      _pixelVerified = true;
      _sensorVerified = true;
    }
  },

  /**
   * Apply barlow/reducer selection — auto-fills multiplier
   */
  applyBarlow(item) {
    _selectedBarlow = item;
    _customBarlowName = '';
    _multiplier = item ? item.multiplier : 1.0;
    _multiplierVerified = true;
  },

  /**
   * Switch to manual mode (clears equipment selections)
   */
  setManualMode(val) {
    _isManualMode = val;
    if (val) {
      _selectedTelescope = null;
      _selectedCamera = null;
      _selectedBarlow = null;
    }
  },

  resetVerification() {
    _focalVerified = false;
    _pixelVerified = false;
    _sensorVerified = false;
    _multiplierVerified = true; // Reset to "Aucun" (×1.0)
    _selectedTelescope = null;
    _selectedCamera = null;
    _selectedBarlow = BARLOW_NONE;
    _multiplier = 1.0;
    _customTelescopeName = '';
    _customCameraName = '';
    _customBarlowName = '';
    _isManualMode = false;
  }
};
