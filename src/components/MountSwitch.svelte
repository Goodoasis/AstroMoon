<script>
  import { createEventDispatcher } from 'svelte';
  import { viewportState } from '@/stores/viewportState.svelte.js';

  const dispatch = createEventDispatcher();

  function toggle() {
    viewportState.isAltAzMode = !viewportState.isAltAzMode;
    dispatch('ephemerisUpdate');
  }
</script>

<div id="mount-bar" class="hud-pill-bar" class:visible={viewportState.appReady}>
  <span class="mount-label" class:active={!viewportState.isAltAzMode}>Équatoriale</span>
  <label class="switch" title="Bascule Équatoriale / Alt-Az (O)">
    <input type="checkbox" id="mount-toggle" name="mountToggle" checked={viewportState.isAltAzMode} onchange={toggle} />
    <span class="switch-slider"></span>
  </label>
  <span class="mount-label" class:active={viewportState.isAltAzMode}>Trépied</span>
</div>

<style>
  .hud-pill-bar {
    position: fixed; right: 16px; display: flex; align-items: center; gap: 8px; padding: 6px 12px;
    background: var(--color-surface); backdrop-filter: blur(var(--blur)); -webkit-backdrop-filter: blur(var(--blur));
    border: 1px solid var(--color-border); border-radius: var(--radius-pill);
    box-shadow: var(--shadow-card), var(--shadow-hud-glow); z-index: 100;
    transform: translateX(350px); opacity: 0;
    transition: transform 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.05s, opacity 0.7s ease-out 0.05s;
  }
  .hud-pill-bar.visible { transform: translateX(0); opacity: 1; }
  #mount-bar { top: 16px; }
  .mount-label { font-family: var(--font-main); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-text-dim); transition: color var(--transition-fast); }
  .mount-label.active { color: var(--color-cyan); text-shadow: 0 0 8px rgba(0, 212, 255, 0.4); }
  .switch { position: relative; display: inline-block; width: 40px; height: 20px; cursor: pointer; }
  .switch input { opacity: 0; width: 0; height: 0; }
  .switch-slider { position: absolute; inset: 0; background: rgba(255, 255, 255, 0.08); border: 1px solid var(--color-border); border-radius: var(--radius-pill); transition: all var(--transition-fast); }
  .switch-slider::before { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; background: var(--color-text-dim); border-radius: 50%; transition: all var(--transition-fast); box-shadow: 0 0 4px rgba(0, 0, 0, 0.3); }
  .switch input:checked + .switch-slider { background: rgba(0, 212, 255, 0.15); border-color: rgba(0, 212, 255, 0.4); box-shadow: 0 0 10px rgba(0, 212, 255, 0.15); }
  .switch input:checked + .switch-slider::before { left: 22px; background: var(--color-cyan); box-shadow: 0 0 8px rgba(0, 212, 255, 0.5); }
</style>
