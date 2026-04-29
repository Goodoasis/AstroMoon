<script>
  /**
   * NeonToggle - Premium Cyber-Vibrant Switch Component
   * Part of the AstroMoon design system.
   */
  let { 
    label = '', 
    checked = $bindable(false), 
    color = '#00E5FF', 
    disabled = false,
    size = 'md', // 'sm' | 'md'
    labelLeft = false,
    onchange = null
  } = $props();

  function handleChange(e) {
    if (onchange) onchange(e.target.checked);
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<label 
  class="nt-container nt-{size}" 
  class:disabled 
  class:checked
  class:label-left={labelLeft}
  style:--nt-color={color}
  onclick={(e) => e.stopPropagation()}
>
  <input 
    type="checkbox" 
    bind:checked 
    {disabled} 
    onchange={handleChange}
  />
  
  {#if label && labelLeft}
    <span class="nt-label">{label}</span>
  {/if}

  <div class="nt-track">
    <div class="nt-thumb"></div>
  </div>

  {#if label && !labelLeft}
    <span class="nt-label">{label}</span>
  {/if}
</label>

<style>
  .nt-container {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    user-select: none;
    transition: all 0.3s var(--transition-med);
  }

  .nt-container.label-left {
    gap: 10px;
  }

  .nt-container.disabled {
    opacity: 0.3;
    cursor: not-allowed;
    pointer-events: none;
  }

  .nt-container input {
    display: none;
  }

  /* ── Track ── */
  .nt-track {
    position: relative;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 999px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    flex-shrink: 0;
    box-sizing: border-box;
  }

  /* ── Thumb ── */
  .nt-thumb {
    position: absolute;
    background: #5c667a;
    border-radius: 50%;
    transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }

  /* Medium (Standard / HQ) */
  .nt-md .nt-track {
    width: 36px;
    height: 18px;
  }
  .nt-md .nt-thumb {
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
  }
  .nt-md input:checked ~ .nt-track .nt-thumb {
    transform: translateX(18px);
  }

  /* Small (Mini) */
  .nt-sm .nt-track {
    width: 24px;
    height: 14px;
  }
  .nt-sm .nt-thumb {
    top: 2px;
    left: 2px;
    width: 10px;
    height: 10px;
  }
  .nt-sm input:checked ~ .nt-track .nt-thumb {
    transform: translateX(10px);
  }

  /* ── Active State (Checked) ── */
  input:checked ~ .nt-track {
    background: color-mix(in srgb, var(--nt-color) 12%, rgba(255, 255, 255, 0.02));
    border-color: color-mix(in srgb, var(--nt-color) 40%, transparent);
    box-shadow: 
      inset 0 0 8px color-mix(in srgb, var(--nt-color) 15%, transparent),
      0 0 15px color-mix(in srgb, var(--nt-color) 10%, transparent);
  }

  input:checked ~ .nt-track .nt-thumb {
    background: var(--nt-color);
    box-shadow: 
      0 0 12px color-mix(in srgb, var(--nt-color) 70%, transparent),
      0 0 4px rgba(255, 255, 255, 0.4);
  }

  /* ── Label ── */
  .nt-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text-dim, #94a3b8);
    transition: all 0.3s ease;
  }

  input:checked ~ .nt-label {
    color: var(--nt-color);
    text-shadow: 0 0 10px color-mix(in srgb, var(--nt-color) 50%, transparent);
  }

  /* ── Hover ── */
  .nt-container:hover:not(.disabled) .nt-track {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
  }

  .nt-container.checked:hover:not(.disabled) .nt-track,
  .nt-container:hover:not(.disabled) input:checked ~ .nt-track {
    border-color: var(--nt-color);
    box-shadow: 
      inset 0 0 12px color-mix(in srgb, var(--nt-color) 25%, transparent),
      0 0 20px color-mix(in srgb, var(--nt-color) 20%, transparent);
  }

  .nt-container:hover .nt-label {
    color: var(--color-text-bright, #fff);
  }

  .nt-container.checked:hover .nt-label,
  .nt-container:hover input:checked ~ .nt-label {
    color: var(--nt-color);
    filter: brightness(1.2);
  }
</style>
