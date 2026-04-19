<script>
  /**
   * EquipmentSearch — Reusable autocomplete search for equipment databases.
   * Used for telescopes, cameras, and barlows/reducers.
   * 
   * Props:
   *   items     — Array of equipment objects
   *   placeholder — Input placeholder text
   *   value     — Currently selected item (or null)
   *   customName — Custom name when in manual/unlisted mode
   *   onSelect  — Callback(item) when an item is selected
   *   onManual  — Callback() when user chooses "Saisie manuelle"
   *   icon      — Emoji icon string (optional)
   *   label     — Section label (optional)
   */

  /** @type {Array} */
  let { 
    items = [], 
    placeholder = 'Rechercher...', 
    value = null, 
    customName = '',
    onSelect = () => {}, 
    onManual = () => {},
    icon = '🔭',
    label = ''
  } = $props();

  let query = $state('');
  let isDropdownOpen = $state(false);
  let highlightIdx = $state(-1);
  let inputRef = $state(null);
  let dropdownRef = $state(null);
  let wrapperRef = $state(null);
  let dropdownStyle = $state('');

  // Display value: selected item name, custom name, or empty
  let displayValue = $derived(
    value ? value.name : (customName || '')
  );

  // Filter items by query (substring, case-insensitive)
  let filtered = $derived.by(() => {
    if (!query || query.length < 1) return items.slice(0, 12); // Show first 12 when empty
    const q = query.toLowerCase();
    return items.filter(item => 
      item.name.toLowerCase().includes(q) || 
      item.brand.toLowerCase().includes(q) ||
      (item.sensor && item.sensor.toLowerCase().includes(q))
    ).slice(0, 10);
  });

  // Group filtered results by brand for display
  let groupedResults = $derived.by(() => {
    const groups = {};
    for (const item of filtered) {
      const brand = item.brand || '—';
      if (!groups[brand]) groups[brand] = [];
      groups[brand].push(item);
    }
    return groups;
  });

  let flatResults = $derived(filtered);

  /**
   * Svelte action: teleports element to document.body and positions it
   * relative to the wrapperRef bounding rect. Escapes all parent overflow.
   */
  function portal(node) {
    document.body.appendChild(node);
    positionDropdown(node);

    return {
      destroy() {
        if (node.parentNode) node.parentNode.removeChild(node);
      }
    };
  }

  function positionDropdown(node) {
    if (!wrapperRef || !node) return;
    const rect = wrapperRef.getBoundingClientRect();
    node.style.top = `${rect.bottom + 4}px`;
    node.style.left = `${rect.left}px`;
    node.style.width = `${rect.width}px`;
  }

  function handleFocus() {
    query = '';
    isDropdownOpen = true;
    highlightIdx = -1;
  }

  function handleBlur(e) {
    // Delay to allow click on dropdown item
    setTimeout(() => {
      // Check if focus moved inside dropdown
      if (dropdownRef && dropdownRef.contains(document.activeElement)) return;
      isDropdownOpen = false;
      query = '';
    }, 200);
  }

  function handleInput(e) {
    query = e.target.value;
    isDropdownOpen = true;
    highlightIdx = -1;
  }

  function handleKeydown(e) {
    if (!isDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        isDropdownOpen = true;
        highlightIdx = -1;
      }
      return;
    }

    // +1 for the "Saisie manuelle" entry at the end
    const totalItems = flatResults.length + 1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightIdx = (highlightIdx + 1) % totalItems;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightIdx = highlightIdx <= 0 ? totalItems - 1 : highlightIdx - 1;
    } else if (e.key === 'Enter' && highlightIdx >= 0) {
      e.preventDefault();
      if (highlightIdx === flatResults.length) {
        // Manual entry selected
        selectManual();
      } else if (flatResults[highlightIdx]) {
        selectItem(flatResults[highlightIdx]);
      }
    } else if (e.key === 'Escape') {
      isDropdownOpen = false;
      query = '';
      inputRef?.blur();
    }
  }

  function selectItem(item) {
    onSelect(item);
    query = '';
    isDropdownOpen = false;
    highlightIdx = -1;
  }

  function selectManual() {
    onManual();
    query = '';
    isDropdownOpen = false;
    highlightIdx = -1;
  }

  function clearSelection(e) {
    e.stopPropagation();
    onSelect(null);
    query = '';
    // Re-focus input for immediate new search
    setTimeout(() => inputRef?.focus(), 50);
  }

  /**
   * Format subtitle based on item type
   */
  function getSubtitle(item) {
    if (item.focal) return `${item.aperture}mm f/${(item.focal / item.aperture).toFixed(1)}`;
    if (item.pixel_size) return `${item.pixel_size}µm — ${item.sensor_width}×${item.sensor_height}`;
    if (item.multiplier !== undefined) return `×${item.multiplier}`;
    return '';
  }

  /**
   * Format type badge
   */  
  function getTypeBadge(item) {
    const map = {
      'refractor': 'Lunette',
      'reflector': 'Newton',
      'catadioptric': 'SC/Mak',
      'rc': 'RC',
      'astro': 'Astro',
      'dslr': 'DSLR',
      'mirrorless': 'Hybride',
      'barlow': 'Barlow',
      'reducer': 'Réducteur',
      'none': '—'
    };
    return map[item.type] || item.type;
  }
</script>

<div class="eq-search" class:has-value={!!value}>
  {#if label}
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <label class="eq-label">
      <span class="eq-icon">{icon}</span> {label}
    </label>
  {/if}

  <div class="eq-input-wrapper" bind:this={wrapperRef}>
    {#if value}
      <!-- Selected state: show name with clear button -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="eq-selected" onclick={() => { clearSelection(event); }}>
        <span class="eq-selected-name" title={value.name}>{value.name}</span>
        <span class="eq-selected-sub">{getSubtitle(value)}</span>
        <button class="eq-clear" onclick={clearSelection} title="Effacer">×</button>
      </div>
    {:else if customName}
      <!-- Custom manual entry state -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="eq-selected manual" onclick={() => { clearSelection(event); }}>
        <span class="eq-selected-name">{customName}</span>
        <span class="eq-selected-sub">Manuel</span>
        <button class="eq-clear" onclick={clearSelection} title="Effacer">×</button>
      </div>
    {:else}
      <!-- Search input -->
      <input
        bind:this={inputRef}
        type="text"
        class="eq-input"
        {placeholder}
        value={query}
        onfocus={handleFocus}
        onblur={handleBlur}
        oninput={handleInput}
        onkeydown={handleKeydown}
        autocomplete="off"
      />
      <span class="eq-search-icon">⌕</span>
    {/if}
  </div>

  {#if isDropdownOpen && !value}
    <div class="eq-dropdown" bind:this={dropdownRef} use:portal>
      <div class="eq-dropdown-scroll">
        {#each flatResults as item, i}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div 
            class="eq-item" 
            class:highlighted={highlightIdx === i}
            onclick={() => selectItem(item)}
            onmouseenter={() => highlightIdx = i}
          >
            <div class="eq-item-main">
              <span class="eq-item-name">{item.name}</span>
              <span class="eq-item-badge">{getTypeBadge(item)}</span>
            </div>
            <div class="eq-item-sub">{getSubtitle(item)}</div>
          </div>
        {/each}

        {#if flatResults.length === 0}
          <div class="eq-empty">Aucun résultat</div>
        {/if}

        <!-- Always-visible manual entry option -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div 
          class="eq-item eq-manual" 
          class:highlighted={highlightIdx === flatResults.length}
          onclick={selectManual}
          onmouseenter={() => highlightIdx = flatResults.length}
        >
          <div class="eq-item-main">
            <span class="eq-item-name">⚙️ Saisie manuelle</span>
          </div>
          <div class="eq-item-sub">Mon matériel n'est pas listé</div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .eq-search {
    margin-bottom: 10px;
    position: relative;
  }

  .eq-label {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    font-weight: 600;
    color: var(--color-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 5px;
  }

  .eq-icon {
    font-size: 12px;
    filter: grayscale(0.3);
  }

  .eq-input-wrapper {
    position: relative;
  }

  .eq-input {
    width: 100%;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    color: #fff;
    font-family: 'Inter', sans-serif;
    font-size: 11px;
    padding: 7px 10px 7px 26px;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.25s, box-shadow 0.25s;
  }

  .eq-input:focus {
    border-color: rgba(0, 229, 255, 0.5);
    box-shadow: 0 0 8px rgba(0, 229, 255, 0.12);
  }

  .eq-input::placeholder {
    color: rgba(255, 255, 255, 0.2);
  }

  .eq-search-icon {
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 13px;
    color: rgba(255, 255, 255, 0.15);
    pointer-events: none;
  }

  /* Selected state */
  .eq-selected {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(0, 229, 255, 0.06);
    border: 1px solid rgba(0, 229, 255, 0.2);
    border-radius: 8px;
    padding: 5px 8px;
    cursor: pointer;
    transition: all 0.2s;
    min-height: 30px;
  }

  .eq-selected:hover {
    border-color: rgba(0, 229, 255, 0.4);
    background: rgba(0, 229, 255, 0.1);
  }

  .eq-selected.manual {
    border-color: rgba(124, 77, 255, 0.3);
    background: rgba(124, 77, 255, 0.06);
  }

  .eq-selected-name {
    font-family: 'Inter', sans-serif;
    font-size: 11px;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .eq-selected-sub {
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--color-cyan);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .eq-selected.manual .eq-selected-sub {
    color: var(--color-purple, #7C4DFF);
  }

  .eq-clear {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.3);
    font-size: 14px;
    cursor: pointer;
    padding: 0 2px;
    line-height: 1;
    transition: color 0.2s;
    flex-shrink: 0;
  }

  .eq-clear:hover {
    color: var(--color-pink, #FF4081);
  }

  /* Dropdown — portaled to body, must be :global */
  :global(.eq-dropdown) {
    position: fixed;
    z-index: 9999;
    background: rgba(10, 11, 16, 0.96);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(0, 229, 255, 0.15);
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 12px rgba(0, 229, 255, 0.08);
    overflow: hidden;
    animation: eqDropIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes -global-eqDropIn {
    from { opacity: 0; transform: translateY(-6px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  :global(.eq-dropdown-scroll) {
    max-height: 220px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 229, 255, 0.15) transparent;
  }

  :global(.eq-dropdown-scroll::-webkit-scrollbar) {
    width: 4px;
  }

  :global(.eq-dropdown-scroll::-webkit-scrollbar-thumb) {
    background: rgba(0, 229, 255, 0.2);
    border-radius: 4px;
  }

  :global(.eq-dropdown .eq-item) {
    padding: 7px 10px;
    cursor: pointer;
    transition: background 0.15s;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  }

  :global(.eq-dropdown .eq-item:last-child) {
    border-bottom: none;
  }

  :global(.eq-dropdown .eq-item:hover),
  :global(.eq-dropdown .eq-item.highlighted) {
    background: rgba(0, 229, 255, 0.08);
  }

  :global(.eq-dropdown .eq-item.highlighted) {
    border-left: 2px solid var(--color-cyan, #00E5FF);
    padding-left: 8px;
  }

  :global(.eq-dropdown .eq-item-main) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  :global(.eq-dropdown .eq-item-name) {
    font-family: 'Inter', sans-serif;
    font-size: 11px;
    font-weight: 500;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(.eq-dropdown .eq-item-badge) {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-cyan, #00E5FF);
    background: rgba(0, 229, 255, 0.08);
    padding: 1px 5px;
    border-radius: 4px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  :global(.eq-dropdown .eq-item-sub) {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 9px;
    color: rgba(255, 255, 255, 0.3);
    margin-top: 1px;
  }

  :global(.eq-dropdown .eq-empty) {
    padding: 12px 10px;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.2);
    text-align: center;
    font-style: italic;
  }

  :global(.eq-dropdown .eq-manual) {
    border-top: 1px solid rgba(124, 77, 255, 0.15);
    background: rgba(124, 77, 255, 0.03);
  }

  :global(.eq-dropdown .eq-manual:hover),
  :global(.eq-dropdown .eq-manual.highlighted) {
    background: rgba(124, 77, 255, 0.1);
  }

  :global(.eq-dropdown .eq-manual.highlighted) {
    border-left-color: var(--color-purple, #7C4DFF);
  }

  :global(.eq-dropdown .eq-manual .eq-item-sub) {
    color: rgba(124, 77, 255, 0.5);
  }
</style>
