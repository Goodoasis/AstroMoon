/**
 * AstroMoon — Viewport & Interaction State Store (Svelte 5 Runes)
 * Replaces scattered viewport/interaction state from app.js.
 */

class ViewportState {
  // --- Reactive properties ---
  tx = $state(0);
  ty = $state(0);
  scale = $state(1);
  mode = $state('navigate');
  isAltAzMode = $state(false);
  isDragging = $state(false);
  dragType = $state(null);
  fps = $state(0);
  mouseX = $state(-1000);
  mouseY = $state(-1000);
  canvasW = $state(0);
  canvasH = $state(0);
  appReady = $state(false);
  isMountVerified = $state(false);

  // --- Non-reactive properties ---
  /** Background image loaded (NOT reactive) */
  backgroundImage = null;

  reset() {
    this.tx = 0;
    this.ty = 0;
    this.scale = 1;
    this.mode = 'navigate';
    this.isAltAzMode = false;
    this.isDragging = false;
    this.dragType = null;
    this.fps = 0;
    this.mouseX = -1000;
    this.mouseY = -1000;
    // We explicitly do not reset canvasW/H as they are tied to window dimensions
    this.appReady = false;
    this.isMountVerified = false;
    this.backgroundImage = null;
  }
}

export const viewportState = new ViewportState();
