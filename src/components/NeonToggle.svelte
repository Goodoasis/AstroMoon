<script>
  /**
   * NeonToggle — Composant toggle (switch) unifié AstroMoon.
   * 
   * Variantes :
   *   "full"   — Layout large  : label (flex) + toggle
   *   "detail" — Layout compact : label (60px) + toggle
   *   "mini"   — Toggle seul   : pas de label, compact
   * 
   * Fonctionnalités :
   *   • initialValue : affiche un glow sur le label si value ≠ initialValue
   *   • bindable checked : synchronisation réactive
   *   • color : couleur d'accentuation (néon)
   */

  /** @type {{ 
   *    variant?: 'full' | 'detail' | 'mini', 
   *    label?: string, 
   *    checked?: boolean, 
   *    color?: string, 
   *    disabled?: boolean, 
   *    initialValue?: boolean,
   *    labelLeft?: boolean,
   *    onchange?: (v: boolean) => void 
   *  }} */
  let { 
    variant = 'detail', 
    label = '', 
    checked = $bindable(false), 
    color = '#00E5FF', 
    disabled = false,
    initialValue = undefined,
    labelLeft = false, // backward compat for placement, but variant usually dictates it
    onchange = null
  } = $props();

  let isModified = $derived(initialValue !== undefined && checked !== initialValue);

  function handleChange(e) {
    if (onchange) onchange(e.target.checked);
  }

  function handleContainerClick(e) {
    if (disabled) return;
    e.stopPropagation();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<label 
  class="nt-container nt-{variant}" 
  class:disabled 
  class:checked
  class:modified={isModified}
  class:label-left={labelLeft}
  style:--nt-color={color}
  onclick={handleContainerClick}
>
  <input 
    type="checkbox" 
    bind:checked 
    {disabled} 
    onchange={handleChange}
  />
  
  {#if label && (labelLeft || variant === 'full' || variant === 'detail')}
    <span class="nt-label">{label}</span>
  {/if}

  <div class="nt-track">
    <div class="nt-thumb"></div>
  </div>

  {#if label && !labelLeft && variant !== 'full' && variant !== 'detail'}
    <span class="nt-label">{label}</span>
  {/if}
</label>

<style>
  .nt-container {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
    transition: all 0.3s var(--transition-med);
  }

  /* ── Variants Layout ── */
  .nt-full {
    display: flex;
    width: 100%;
    justify-content: space-between;
  }

  .nt-detail {
    display: flex;
    align-items: center;
  }

  .nt-detail .nt-label {
    min-width: 32px;
    max-width: 60px;
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nt-mini.label-left .nt-label {
    max-width: 60px;
    text-align: right;
  }

  .nt-mini {
    gap: 6px;
  }

  /* ── States ── */
  .nt-container.disabled {
    opacity: 0.3;
    cursor: not-allowed;
    pointer-events: none;
  }

  .nt-container input {
    display: none;
  }

  /* label coloré quand modifié */
  .nt-container.modified .nt-label {
    color: var(--nt-color);
    text-shadow: 0 0 10px color-mix(in srgb, var(--nt-color) 60%, transparent);
    filter: brightness(1.1);
    transition: all 0.3s var(--transition-med);
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

  /* Standard Size (Detail / Full) */
  .nt-full .nt-track,
  .nt-detail .nt-track {
    width: 28px;
    height: 14px;
  }

  /* Mini Size */
  .nt-mini .nt-track {
    width: 22px;
    height: 12px;
  }

  /* ── Thumb ── */
  .nt-thumb {
    position: absolute;
    background: #5c667a;
    border-radius: 50%;
    transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }

  .nt-full .nt-thumb,
  .nt-detail .nt-thumb {
    top: 1px;
    left: 1px;
    width: 10px;
    height: 10px;
  }

  .nt-mini .nt-thumb {
    top: 1px;
    left: 1px;
    width: 8px;
    height: 8px;
  }

  /* Translation */
  input:checked ~ .nt-track .nt-thumb {
    background: var(--nt-color);
    box-shadow: 
      0 0 12px color-mix(in srgb, var(--nt-color) 70%, transparent),
      0 0 4px rgba(255, 255, 255, 0.4);
  }

  .nt-full input:checked ~ .nt-track .nt-thumb,
  .nt-detail input:checked ~ .nt-track .nt-thumb {
    transform: translateX(14px);
  }

  .nt-mini input:checked ~ .nt-track .nt-thumb {
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

  /* ── Label ── */
  .nt-label {
    font-size: 10px;
    font-weight: 500;
    color: var(--color-text-dim, #94a3b8);
    transition: all 0.3s ease;
  }

  input:checked ~ .nt-label {
    color: var(--nt-color);
    text-shadow: 0 0 12px color-mix(in srgb, var(--nt-color) 40%, transparent);
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
    filter: brightness(1.3);
  }

</style>

