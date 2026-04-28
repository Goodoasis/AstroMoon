<script>
  /**
   * RangeSlider — Composant slider unifié AstroMoon.
   *
   * Variantes :
   *   "full"   — Layout large  : label (62px) + track (flex) + number input éditable
   *   "detail" — Layout compact : label (72px) + track (flex) + number input éditable
   *   "mini"   — Slider inline seul, pas de label ni de valeur
   *              (réservé aux sliders d'opacité en header de calque)
   *
   * Comportements communs (full & detail) :
   *   • Molette : ±1 step  (Shift = ×0.1 précision)
   *   • Double-clic : reset à initialValue
   *   • Label coloré quand valeur ≠ initialValue (état modifié)
   *   • Valeur numérique cliquable/éditable au clavier à droite
   */

  /** @type {'full' | 'detail' | 'mini'} */
  let {
    variant = 'detail',
    value = $bindable(0),
    min = 0,
    max = 1,
    step = 0.01,
    label = '',
    color = '#FF4081',
    suffix = '',
    fixed = 2,
    initialValue = undefined,
    oninput = () => {},
    onwheel = undefined,
    stopPropagation = false,
  } = $props();

  let isModified = $derived(initialValue !== undefined && value !== initialValue);

  function handleInput(e) {
    const v = parseFloat(e.target.value);
    value = v;
    oninput(v);
  }

  function handleNumberChange(e) {
    const v = parseFloat(e.target.value);
    if (!isNaN(v)) {
      const clamped = Math.max(min, Math.min(max, v));
      value = clamped;
      oninput(clamped);
    }
  }

  function handleWheel(e) {
    if (onwheel) {
      onwheel(e);
      return;
    }
    e.preventDefault();
    const mult = e.shiftKey ? 0.1 : 1;
    const delta = e.deltaY > 0 ? -step * mult : step * mult;
    const newVal = Math.max(min, Math.min(max, value + delta));
    value = newVal;
    oninput(newVal);
  }

  function handleDblClick() {
    if (initialValue !== undefined) {
      value = initialValue;
      oninput(initialValue);
    }
  }

  function handleClick(e) {
    if (stopPropagation) e.stopPropagation();
  }
</script>

{#if variant === 'full' || variant === 'detail'}
  <!-- Full / Detail : label + track + number input éditable -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="rs-row"
    class:rs-full={variant === 'full'}
    class:rs-detail={variant === 'detail'}
    class:modified={isModified}
    onwheel={handleWheel}
    ondblclick={handleDblClick}
    title={initialValue !== undefined ? 'Double-clic pour réinitialiser' : undefined}
    style:--rs-color={color}
  >
    <span class="rs-label">{label}</span>
    <input
      type="range"
      class="rs-track"
      {min}
      {max}
      {step}
      {value}
      oninput={handleInput}
    />
    <div class="rs-val-wrapper">
      <input
        type="number"
        {min}
        {max}
        {step}
        value={Number(value).toFixed(fixed)}
        onchange={handleNumberChange}
        class="rs-number"
      />
      {#if suffix}<span class="rs-suffix">{suffix}</span>{/if}
    </div>
  </div>

{:else if variant === 'mini'}
  <!-- Mini : slider inline seul (opacité des calques) -->
  <input
    type="range"
    class="rs-track rs-mini"
    {min}
    {max}
    {step}
    {value}
    oninput={handleInput}
    onclick={handleClick}
    style:--rs-color={color}
  />
{/if}

<style>
  /* ── Row containers ── */
  .rs-row {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
  }

  .rs-full {
    margin-bottom: 6px;
  }

  /* label coloré quand modifié — pas de dot, juste la couleur */
  .rs-row.modified .rs-label {
    color: var(--rs-color, #FF4081);
    transition: color 0.2s;
  }

  /* ── Label ── */
  .rs-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
    transition: color 0.2s;
  }

  .rs-full .rs-label {
    min-width: 58px;
    max-width: 62px;
  }

  .rs-detail .rs-label {
    min-width: 44px;
    max-width: 60px;
  }

  /* ── Track (range input) ── */
  .rs-track {
    flex: 1;
    min-width: 0;
    -webkit-appearance: none;
    appearance: none;
    outline: none;
    cursor: pointer;
    border-radius: 2px;
    background: color-mix(in srgb, var(--rs-color, #FF4081) 15%, transparent);
  }

  .rs-full .rs-track  { height: 4px; }
  .rs-detail .rs-track { height: 3px; }

  /* Webkit thumb */
  .rs-track::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    border-radius: 50%;
    background: var(--rs-color, #FF4081);
    border: 2px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
    box-shadow: 0 0 6px color-mix(in srgb, var(--rs-color, #FF4081) 50%, transparent);
    transition: box-shadow 0.2s;
  }

  .rs-full .rs-track::-webkit-slider-thumb  { width: 14px; height: 14px; }
  .rs-detail .rs-track::-webkit-slider-thumb { width: 12px; height: 12px; border-width: 1.5px; }

  .rs-track::-webkit-slider-thumb:hover {
    box-shadow: 0 0 12px color-mix(in srgb, var(--rs-color, #FF4081) 80%, transparent);
  }

  /* Firefox thumb */
  .rs-track::-moz-range-thumb {
    border-radius: 50%;
    background: var(--rs-color, #FF4081);
    border: 2px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
    box-shadow: 0 0 6px color-mix(in srgb, var(--rs-color, #FF4081) 50%, transparent);
  }

  .rs-full .rs-track::-moz-range-thumb  { width: 14px; height: 14px; }
  .rs-detail .rs-track::-moz-range-thumb { width: 12px; height: 12px; border-width: 1.5px; }

  /* ── Value wrapper (number input + suffix) ── */
  .rs-val-wrapper {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 1px;
    flex-shrink: 0;
  }

  .rs-full .rs-val-wrapper  { width: 44px; }
  .rs-detail .rs-val-wrapper { width: 36px; }

  .rs-number {
    background: transparent;
    border: none;
    color: var(--rs-color, #FF4081);
    font-family: var(--font-mono);
    font-size: 10px;
    width: 100%;
    text-align: right;
    padding: 0;
    margin: 0;
    outline: none;
    line-height: 1;
    -moz-appearance: textfield;
    appearance: textfield;
    transition: background 0.15s, color 0.15s;
    cursor: text;
  }

  .rs-number::-webkit-outer-spin-button,
  .rs-number::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .rs-number:hover {
    color: var(--color-text-bright, #fff);
  }

  .rs-number:focus {
    color: #fff;
    background: color-mix(in srgb, var(--rs-color, #FF4081) 18%, transparent);
    border-radius: 2px;
    padding: 0 2px;
  }

  .rs-suffix {
    color: var(--rs-color, #FF4081);
    font-family: var(--font-mono);
    font-size: 10px;
    flex-shrink: 0;
  }

  /* ── MINI variant (opacité inline des calques) ── */
  .rs-mini {
    width: 60px;
    height: 3px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    flex-shrink: 0;
  }

  .rs-mini::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--rs-color, #FF4081);
    border: 1.5px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
    box-shadow: 0 0 4px var(--rs-color, rgba(255, 64, 129, 0.4));
    transition: box-shadow 0.2s;
  }

  .rs-mini::-webkit-slider-thumb:hover {
    box-shadow: 0 0 8px var(--rs-color, rgba(255, 64, 129, 0.7));
  }

  .rs-mini::-moz-range-thumb {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--rs-color, #FF4081);
    border: 1.5px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
  }
</style>
