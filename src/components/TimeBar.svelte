<script>
  import { createEventDispatcher } from 'svelte';
  import { temporalState } from '@/stores/temporalState.svelte.js';
  import { viewportState } from '@/stores/viewportState.svelte.js';

  const dispatch = createEventDispatcher();

  function formatForDatetimeLocal(date) {
    if (!date || isNaN(date.getTime())) return '';
    const pad = n => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function setTimeSource(src) {
    if (src === 'name' && !temporalState.parsedNameDate) return;
    if (src === 'exif' && !temporalState.parsedExifDate) return;

    temporalState.source = src;
    if (src === 'manual') {
      temporalState.time = temporalState.userManualDate;
    } else if (src === 'name' && temporalState.parsedNameDate) {
      temporalState.time = temporalState.parsedNameDate;
    } else if (src === 'exif' && temporalState.parsedExifDate) {
      temporalState.time = temporalState.parsedExifDate;
    }
    dispatch('ephemerisUpdate');
  }

  function handleTimeChange(e) {
    if (temporalState.source === 'manual') {
      temporalState.userManualDate = new Date(e.target.value);
      temporalState.time = temporalState.userManualDate;
      dispatch('ephemerisUpdate');
    }
  }

  let displayValue = $derived(formatForDatetimeLocal(temporalState.time));
</script>

<div id="time-bar" class="hud-pill-bar" class:visible={viewportState.appReady}>
  <div class="time-sources">
    <button class="source-btn"
      class:active={temporalState.source === 'name'}
      class:disabled={!temporalState.parsedNameDate}
      onclick={() => setTimeSource('name')}>Nom</button>
    <button class="source-btn"
      class:active={temporalState.source === 'exif'}
      class:disabled={!temporalState.parsedExifDate}
      onclick={() => setTimeSource('exif')}>Exif</button>
    <button class="source-btn"
      class:active={temporalState.source === 'manual'}
      onclick={() => setTimeSource('manual')}>Manuel</button>
  </div>
  <div class="tb-sep"></div>
  <input type="datetime-local" id="time-input" name="timeInput"
    class:readonly={temporalState.source !== 'manual'}
    value={displayValue}
    onchange={handleTimeChange}
    aria-label="Date et heure de capture" />
</div>

<style>
  .hud-pill-bar {
    position: fixed;
    right: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--color-surface);
    backdrop-filter: blur(var(--blur));
    -webkit-backdrop-filter: blur(var(--blur));
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
    box-shadow: var(--shadow-card), var(--shadow-hud-glow);
    z-index: 100;
    transform: translateX(350px);
    opacity: 0;
    transition: transform 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.1s,
                opacity 0.7s ease-out 0.1s;
  }

  .hud-pill-bar.visible {
    transform: translateX(0);
    opacity: 1;
  }

  #time-bar { top: 56px; }

  .time-sources {
    display: flex;
    background: rgba(0, 0, 0, 0.3);
    border-radius: var(--radius-pill);
    padding: 3px;
  }

  .source-btn {
    border: none;
    background: transparent;
    color: var(--color-text-dim);
    font-family: var(--font-main);
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: var(--radius-pill);
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    transition: all var(--transition-fast);
  }

  .source-btn.disabled { opacity: 0.3; pointer-events: none; }

  .source-btn.active {
    background: var(--color-surface-hover);
    color: var(--color-text-bright);
    box-shadow: 0 0 10px rgba(0, 212, 255, 0.15);
    border: 1px solid var(--color-border);
  }

  .tb-sep { width: 1px; height: 24px; background: var(--color-border); margin: 0 4px; }

  #time-input {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-text-bright);
    background: transparent;
    border: none;
    outline: none;
    padding: 0 4px;
  }

  #time-input::-webkit-calendar-picker-indicator {
    filter: invert(1) opacity(0.8);
    cursor: pointer;
  }

  #time-input.readonly { opacity: 0.6; pointer-events: none; }
</style>
