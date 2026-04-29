<script>
  /**
   * NeonSelect — A high-performance, Cyber-Vibrant themed dropdown.
   * Uses Svelte 5 portal logic to escape overflow constraints.
   */
  import { onMount, tick } from 'svelte';
  import { uiState } from '@/stores/uiState.svelte.js';

  let { 
    options = [], // Array of string values or objects { value, label }
    value = $bindable(), 
    onchange = () => {},
    color = '#00E5FF', // Default Cyan
    disabled = false,
    placeholder = 'Sélectionner...',
    fullWidth = true,
    ontoggle = () => {}
  } = $props();

  let isOpen = $state(false);
  let wrapperRef = $state(null);
  let dropdownRef = $state(null);

  // Normalize options to { value, label }
  let normalizedOptions = $derived(
    options.map(opt => {
      if (typeof opt === 'string') return { value: opt, label: opt };
      return opt;
    })
  );

  let selectedLabel = $derived(
    normalizedOptions.find(opt => opt.value === value)?.label || value || placeholder
  );

  /**
   * Svelte action: teleports element to document.body and positions it
   */
  function portal(node) {
    document.body.appendChild(node);
    positionDropdown(node);

    const handleResize = () => positionDropdown(node);
    const handleScroll = () => positionDropdown(node);
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return {
      destroy() {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll, true);
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

  function toggleDropdown(e) {
    if (disabled) return;
    e.stopPropagation();
    isOpen = !isOpen;
  }

  function selectOption(opt) {
    value = opt.value;
    isOpen = false;
    onchange(opt.value);
  }

  // Click outside listener
  $effect(() => {
    if (isOpen) {
      const handleClick = (e) => {
        if (dropdownRef && !dropdownRef.contains(e.target) && !wrapperRef.contains(e.target)) {
          isOpen = false;
        }
      };
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  });

  // Track open state for parent
  $effect(() => {
    if (isOpen) {
      ontoggle(true);
      return () => ontoggle(false);
    }
  });

  // Handle positioning when it opens
  $effect(() => {
    if (isOpen) {
      tick().then(() => {
        if (dropdownRef) positionDropdown(dropdownRef);
      });
    }
  });
</script>

<div 
  class="neon-select" 
  class:open={isOpen} 
  class:disabled 
  class:full-width={fullWidth}
  bind:this={wrapperRef}
  style:--accent-color={color}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="ns-trigger" onclick={toggleDropdown}>
    <span class="ns-value">{selectedLabel}</span>
    <div class="ns-chevron">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <polyline points="4,6 8,10 12,6"/>
      </svg>
    </div>
  </div>

  {#if isOpen}
    <div class="ns-dropdown" bind:this={dropdownRef} use:portal>
      <div class="ns-options">
        {#each normalizedOptions as opt}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div 
            class="ns-option" 
            class:selected={value === opt.value}
            onclick={() => selectOption(opt)}
          >
            {opt.label}
            {#if value === opt.value}
              <div class="ns-check">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <polyline points="3,8 6,11 13,4"/>
                </svg>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .neon-select {
    position: relative;
    font-family: var(--font-main, 'Inter', sans-serif);
    font-size: 10px;
    height: 24px;
    display: inline-flex;
    min-width: 80px;
    --accent-color: #00E5FF;
  }

  .neon-select.full-width {
    display: flex;
    flex: 1;
  }

  .ns-trigger {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: var(--color-text-dim, rgba(255, 255, 255, 0.7));
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    gap: 8px;
  }

  .neon-select:hover:not(.disabled) .ns-trigger {
    background: rgba(var(--accent-color-rgb, 0, 229, 255), 0.08);
    border-color: var(--accent-color);
    color: var(--color-text-bright, #fff);
    box-shadow: 0 0 10px rgba(var(--accent-color-rgb, 0, 229, 255), 0.1);
  }

  .neon-select.open .ns-trigger {
    border-color: var(--accent-color);
    background: rgba(var(--accent-color-rgb, 0, 229, 255), 0.12);
    color: var(--color-text-bright, #fff);
  }

  .ns-value {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
  }

  .ns-chevron {
    width: 12px;
    height: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 0.5;
  }

  .neon-select.open .ns-chevron {
    transform: rotate(180deg);
    opacity: 1;
    color: var(--accent-color);
  }

  .neon-select.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  /* Dropdown (Portal) */
  :global(.ns-dropdown) {
    position: fixed;
    z-index: 10000;
    background: rgba(10, 11, 16, 0.95);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    box-shadow: 
      0 10px 30px rgba(0, 0, 0, 0.7), 
      0 0 20px rgba(0, 0, 0, 0.4),
      0 0 10px rgba(var(--accent-color-rgb, 0, 229, 255), 0.1);
    overflow: hidden;
    animation: ns-drop-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes -global-ns-drop-in {
    from { opacity: 0; transform: translateY(-8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .ns-options {
    max-height: 200px;
    overflow-y: auto;
    padding: 4px;
    scrollbar-width: none;
  }

  .ns-options::-webkit-scrollbar { display: none; }

  .ns-option {
    padding: 7px 12px;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    font-size: 10px;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    gap: 12px;
    margin-bottom: 2px;
  }

  .ns-option:last-child {
    margin-bottom: 0;
  }

  .ns-option:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    padding-left: 14px;
  }

  .ns-option.selected {
    background: rgba(var(--accent-color-rgb, 0, 229, 255), 0.1);
    color: var(--accent-color);
    font-weight: 600;
  }

  .ns-check {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
  }

  /* Utility for RGB if needed, but we can use HEX directly if we don't need alpha via RGB */
  /* For now I'll just use the provided hex and fallback to fixed colors in CSS if needed */
</style>
