/**
 * AstroMoon — Spatial / Location State Store (Svelte 5 Runes)
 * Replaces window.appSpatialLocation + location widget state from app.js.
 */

class SpatialState {
  /** Current effective observation location */
  lat = $state(48.8584);
  lon = $state(2.2945);
  city = $state('Eiffel Tower, Paris');
  
  /** Active source: 'geoloc' | 'exif-loc' | 'ville' */
  source = $state('ville');
  
  /** User-entered manual location */
  userManualLocation = $state({ lat: 48.85, lon: 2.35, name: '' });
  
  /** GPS from EXIF metadata */
  parsedExifGps = $state(null);
  
  /** GPS from Geolocation API */
  geolocGps = $state(null);
  
  /** Persistence flags */
  cityVerified = $state(false);

  reset() {
    this.lat = 48.8584;
    this.lon = 2.2945;
    this.city = 'Eiffel Tower, Paris';
    this.source = 'ville';
    this.userManualLocation = { lat: 48.85, lon: 2.35, name: '' };
    this.parsedExifGps = null;
    this.geolocGps = null;
    this.cityVerified = false;
  }
}

export const spatialState = new SpatialState();
