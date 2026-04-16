/**
 * AstroMoon — Moon State Store (Svelte 5 Runes)
 * Replaces window.appMoonState global.
 */

export const moonState = $state({
  librationLon: 0,
  librationLat: 0,
  moonPhase360: 0,
  sunLon: 0,
  sunLat: 0,
  brightLimbPA: 0,
  terminatorGeoPoints: []
});
