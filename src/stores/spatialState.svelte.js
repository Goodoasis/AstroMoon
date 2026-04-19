/**
 * AstroMoon — Spatial / Location State Store (Svelte 5 Runes)
 * Replaces window.appSpatialLocation + location widget state from app.js.
 */

export const spatialState = $state({
  /** Current effective observation location */
  lat: 48.8584,
  lon: 2.2945,
  city: 'Eiffel Tower, Paris',
  /** Active source: 'geoloc' | 'exif-loc' | 'ville' */
  source: 'ville',
  /** User-entered manual location */
  userManualLocation: { lat: 48.85, lon: 2.35, name: '' },
  /** GPS from EXIF metadata */
  parsedExifGps: null,
  /** GPS from Geolocation API */
  geolocGps: null,
  /** Persistence flags */
  cityVerified: false
});
