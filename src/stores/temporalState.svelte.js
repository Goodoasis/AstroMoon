/**
 * AstroMoon — Temporal State Store (Svelte 5 Runes)
 * Replaces window.appTemporalTime + time widget state scattered in app.js.
 */

class TemporalState {
  /** Current effective observation time */
  time = $state(new Date());
  
  /** Active source: 'name' | 'exif' | 'manual' */
  source = $state('manual');
  
  /** Manually entered date */
  userManualDate = $state(new Date());
  
  /** Date parsed from image filename */
  parsedNameDate = $state(null);
  
  /** Date parsed from EXIF metadata */
  parsedExifDate = $state(null);
  
  /** Persistence flags */
  timeVerified = $state(false);

  reset() {
    this.time = new Date();
    this.source = 'manual';
    this.userManualDate = new Date();
    this.parsedNameDate = null;
    this.parsedExifDate = null;
    this.timeVerified = false;
  }
}

export const temporalState = new TemporalState();
