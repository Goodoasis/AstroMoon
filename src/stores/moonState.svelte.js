/**
 * AstroMoon — Moon State Store (Svelte 5 Runes)
 * Replaces window.appMoonState global.
 */

class MoonState {
  librationLon = $state(0);
  librationLat = $state(0);
  moonPhase360 = $state(0);
  sunLon = $state(0);
  sunLat = $state(0);
  brightLimbPA = $state(0);
  terminatorGeoPoints = $state([]);

  reset() {
    this.librationLon = 0;
    this.librationLat = 0;
    this.moonPhase360 = 0;
    this.sunLon = 0;
    this.sunLat = 0;
    this.brightLimbPA = 0;
    this.terminatorGeoPoints = [];
  }
}

export const moonState = new MoonState();
