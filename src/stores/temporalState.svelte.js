/**
 * AstroMoon — Temporal State Store (Svelte 5 Runes)
 * Replaces window.appTemporalTime + time widget state scattered in app.js.
 */

export const temporalState = $state({
  /** Current effective observation time */
  time: new Date(),
  /** Active source: 'name' | 'exif' | 'manual' */
  source: 'manual',
  /** Manually entered date */
  userManualDate: new Date(),
  /** Date parsed from image filename */
  parsedNameDate: null,
  /** Date parsed from EXIF metadata */
  parsedExifDate: null,
  /** Persistence flags */
  timeVerified: false
});
