/**
 * AstroMoon — Viewport & Interaction State Store (Svelte 5 Runes)
 * Replaces scattered viewport/interaction state from app.js.
 */

let _tx = $state(0);
let _ty = $state(0);
let _scale = $state(1);
let _mode = $state('navigate');
let _isAltAzMode = $state(false);
let _isDragging = $state(false);
let _dragType = $state(null);
let _fps = $state(0);
let _mouseX = $state(-1000);
let _mouseY = $state(-1000);
let _canvasW = $state(0);
let _canvasH = $state(0);
let _appReady = $state(false);
let _isMountVerified = $state(false);

export const viewportState = {
  /** Background image loaded (NOT reactive) */
  backgroundImage: null,

  get tx() { return _tx; }, set tx(v) { _tx = v; },
  get ty() { return _ty; }, set ty(v) { _ty = v; },
  get scale() { return _scale; }, set scale(v) { _scale = v; },
  get mode() { return _mode; }, set mode(v) { _mode = v; },
  get isAltAzMode() { return _isAltAzMode; }, set isAltAzMode(v) { _isAltAzMode = v; },
  get isDragging() { return _isDragging; }, set isDragging(v) { _isDragging = v; },
  get dragType() { return _dragType; }, set dragType(v) { _dragType = v; },
  get fps() { return _fps; }, set fps(v) { _fps = v; },
  get mouseX() { return _mouseX; }, set mouseX(v) { _mouseX = v; },
  get mouseY() { return _mouseY; }, set mouseY(v) { _mouseY = v; },
  get canvasW() { return _canvasW; }, set canvasW(v) { _canvasW = v; },
  get canvasH() { return _canvasH; }, set canvasH(v) { _canvasH = v; },
  get appReady() { return _appReady; }, set appReady(v) { _appReady = v; },
  get isMountVerified() { return _isMountVerified; }, set isMountVerified(v) { _isMountVerified = v; }
};
