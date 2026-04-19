<script>
  import { viewportState } from '@/stores/viewportState.svelte.js';
</script>

<div id="info-bar" class="visible">
  <div class="info-hint"><kbd>Drag</kbd> Calque</div>
  <div class="info-hint"><kbd>Scroll</kbd> Zoom calque</div>
  <div class="info-hint"><kbd>Shift</kbd>+<kbd>Drag</kbd> Rotation</div>
  <div class="info-hint hint-sep"></div>
  <div class="info-hint"><kbd>Clic-droit</kbd> Naviguer</div>
  <div class="info-hint"><kbd>Ctrl</kbd>+<kbd>Scroll</kbd> Zoom vue</div>
  <div class="info-hint"><kbd>F</kbd> Recentrer</div>
  <div class="info-hint hint-sep"></div>
  <div class="info-hint"><kbd>A</kbd> Ancrage</div>
  <div class="info-hint"><kbd>G</kbd> Grille</div>
</div>

<style>
  #info-bar {
    position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%) translateY(80px);
    display: flex; align-items: center; gap: 10px; padding: 8px 18px;
    background: var(--color-surface); backdrop-filter: blur(var(--blur)); -webkit-backdrop-filter: blur(var(--blur));
    border: 1px solid var(--color-border); border-radius: var(--radius-pill);
    box-shadow: var(--shadow-card), var(--shadow-hud-glow); opacity: 0; z-index: 90;
    font-size: 12px; color: var(--color-text-dim);
    transition: transform 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.1s, opacity 0.7s ease-out 0.1s;
  }
  #info-bar.visible { transform: translateX(-50%) translateY(0); opacity: 1; }
  .info-hint { display: flex; align-items: center; gap: 6px; }
  .info-hint.hint-sep { width: 1px; height: 16px; background: var(--color-border); padding: 0; margin: 0 2px; }
  .info-hint kbd { display: inline-flex; align-items: center; justify-content: center; padding: 2px 7px; background: rgba(255, 255, 255, 0.06); border: 1px solid var(--color-border); border-radius: 4px; font-family: var(--font-mono); font-size: 11px; font-weight: 500; color: var(--color-text); line-height: 1; }
</style>
