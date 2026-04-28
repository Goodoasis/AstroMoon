<script>
  /**
   * NeonButton — Composant bouton unifié AstroMoon (Design System Cyber-Vibrant).
   *
   * Variantes :
   *   "hero"    — Grand bouton d'action principale (style WelcomeOverlay). Padding généreux,
   *               uppercase, glassmorphism complet, shimmer au hover, lift translateY.
   *   "primary" — Bouton standard plein de taille médiane.
   *   "ghost"   — Bouton avec fond transparent, uniquement la bordure colorée.
   *   "icon"    — Bouton carré compact pour les actions icône seules (toolbar, panel).
   *
   * Props :
   *   label        — Texte du bouton (string)
   *   color        — Couleur hex d'accent. Défaut: #00E5FF (Electric Cyan)
   *   variant      — 'hero' | 'primary' | 'ghost' | 'icon' | 'tab' | 'panel' (défaut: 'primary')
   *   active       — Force l'état visuel actif (utile pour les onglets/phases)
   *   radius       — Rayon de bordure personnalisé (ex: '6px')
   *   bold         — Si le texte doit être en gras (défaut: true)
   *   disabled     — Désactive le bouton
   *   fullWidth    — Si le bouton doit occuper toute la largeur disponible
   *   useColorForText — Si true, utilise la couleur d'accent pour le texte
   *   type         — Attribut HTML type ('button' | 'submit' | 'reset')
   *   title        — Tooltip natif (utile pour variant='icon')
   *   animateIn    — Si true, applique l'animation d'entrée fade-in+slide (comme le Welcome)
   *   animateDelay — Délai de l'animation d'entrée (ex: '1.5s')
   *   onclick      — Handler click
   *
   * Slots :
   *   icon         — Snippet d'icône SVG affiché à gauche du label
   */

  let {
    label = '',
    color = '#00E5FF',
    variant = 'primary',
    active = false,
    radius = undefined,
    bold = true,
    disabled = false,
    type = 'button',
    title = undefined,
    animateIn = false,
    animateDelay = '0s',
    fullWidth = false,
    useColorForText = false,
    onclick = () => {},
    children = undefined,
    icon = undefined,
  } = $props();
</script>

<button
  {type}
  {disabled}
  {title}
  class="nb-btn nb-{variant}"
  class:nb-active={active}
  class:nb-animate-in={animateIn}
  class:nb-full-width={fullWidth}
  onclick={onclick}
  style:--nb-color={color}
  style:--nb-delay={animateDelay}
  style:--nb-radius={radius}
  style:--nb-font-weight={bold ? 700 : 500}
  style:--nb-text-color={ (variant === 'panel' || useColorForText) ? color : '#fff' }
>
  {#if icon}
    <span class="nb-icon-wrap">
      {@render icon()}
    </span>
  {/if}

  {#if label}
    <span class="nb-label">{label}</span>
  {/if}

  {#if children}
    {@render children()}
  {/if}
</button>

<style>
  /* ── Base ─────────────────────────────────────────────── */
  .nb-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    border-radius: var(--nb-radius, var(--radius-pill, 100px));
    border: 1px solid color-mix(in srgb, var(--nb-color, #00E5FF) 30%, transparent);
    background: rgba(10, 11, 16, 0.7);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    color: var(--nb-text-color, #fff);
    font-family: var(--font-main, 'Inter', sans-serif);
    font-weight: 600;
    letter-spacing: 0.5px;
    cursor: pointer;
    overflow: hidden;
    box-shadow:
      0 6px 24px rgba(0, 0, 0, 0.45),
      0 0 12px color-mix(in srgb, var(--nb-color, #00E5FF) 10%, transparent);
    outline: none;
    transition:
      transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
      box-shadow 0.35s ease,
      border-color 0.35s ease,
      background 0.35s ease,
      opacity 0.2s ease;
  }

  .nb-full-width {
    width: 100%;
    display: flex;
    flex: 1;
  }

  /* Shimmer sweep on hover */
  .nb-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent,
      color-mix(in srgb, var(--nb-color, #00E5FF) 22%, transparent),
      transparent
    );
    transform: translateX(-110%);
    transition: transform 0.55s ease;
    pointer-events: none;
  }

  .nb-btn:hover::before {
    transform: translateX(110%);
  }

  /* Hover */
  .nb-btn:hover:not(:disabled) {
    border-color: var(--nb-color, #00E5FF);
    background: color-mix(in srgb, var(--nb-color, #00E5FF) 12%, rgba(10, 11, 16, 0.8));
    box-shadow:
      0 10px 36px rgba(0, 0, 0, 0.55),
      0 0 22px color-mix(in srgb, var(--nb-color, #00E5FF) 40%, transparent),
      inset 0 0 10px color-mix(in srgb, var(--nb-color, #00E5FF) 15%, transparent);
  }

  /* Active press */
  .nb-btn:active:not(:disabled) {
    transform: scale(0.97) translateY(1px) !important;
    transition: transform 0.08s ease !important;
  }

  /* Disabled */
  .nb-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    filter: grayscale(0.4);
  }

  /* ── HERO variant ─────────────────────────────────────── */
  .nb-hero {
    padding: 16px 42px;
    font-size: 16px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
  }

  .nb-hero:hover:not(:disabled) {
    transform: translateY(-4px);
  }

  /* ── PRIMARY variant ──────────────────────────────────── */
  .nb-primary {
    padding: 10px 24px;
    font-size: 13px;
    text-transform: none;
  }

  .nb-primary:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  /* ── GHOST variant ────────────────────────────────────── */
  .nb-ghost {
    padding: 8px 20px;
    font-size: 12px;
    background: transparent;
    box-shadow: none;
  }

  .nb-ghost:hover:not(:disabled) {
    transform: translateY(-2px);
    background: color-mix(in srgb, var(--nb-color, #00E5FF) 8%, transparent);
    color: var(--nb-color, #fff);
    box-shadow: 0 0 14px color-mix(in srgb, var(--nb-color, #00E5FF) 30%, transparent);
  }

  /* ── ICON variant ─────────────────────────────────────── */
  .nb-icon {
    padding: 8px;
    border-radius: 50%;
    min-width: 36px;
    min-height: 36px;
    background: transparent;
  }

  .nb-icon:hover:not(:disabled) {
    transform: scale(1.1);
    box-shadow: 0 0 14px color-mix(in srgb, var(--nb-color, #00E5FF) 45%, transparent);
  }

  /* ── TAB variant ──────────────────────────────────────── */
  .nb-tab {
    padding: 6px 16px;
    font-size: 14px;
    font-family: var(--font-nav, 'Space Grotesk', sans-serif);
    font-weight: 600;
    min-width: 80px;
    background: transparent;
    border-color: transparent;
    box-shadow: none;
    color: rgba(255, 255, 255, 0.5);
  }

  .nb-tab:hover:not(:disabled):not(.nb-active) {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  /* ── ACTIVE state (Shared) ────────────────────────────── */
  .nb-active {
    border-color: var(--nb-color, #00E5FF) !important;
    background: color-mix(in srgb, var(--nb-color, #00E5FF) 8%, rgba(255, 255, 255, 0.05)) !important;
    color: var(--nb-color, #00E5FF) !important;
    font-weight: 700;
    box-shadow: 
      0 0 20px rgba(0, 0, 0, 0.4), 
      0 0 12px color-mix(in srgb, var(--nb-color, #00E5FF) 60%, transparent) !important;
    text-shadow: 0 0 8px color-mix(in srgb, var(--nb-color, #00E5FF) 50%, transparent);
  }

  .nb-tab.nb-active {
    filter: brightness(1.2);
  }

  /* ── Icon slot wrapper ────────────────────────────────── */
  .nb-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--nb-color, #00E5FF);
    filter: drop-shadow(0 0 6px color-mix(in srgb, var(--nb-color, #00E5FF) 70%, transparent));
  }

  /* ── Label ────────────────────────────────────────────── */
  .nb-label {
    white-space: nowrap;
    font-weight: inherit;
  }

  .nb-btn {
    font-weight: var(--nb-font-weight, 600);
  }

  /* ── PANEL variant ────────────────────────────────────── */
  .nb-panel {
    padding: 8px 16px;
    font-size: 12px;
    --nb-radius: 6px;
  }

  /* ── Animate-in (Welcome style) ───────────────────────── */
  .nb-animate-in {
    opacity: 0;
    transform: translateY(16px);
    animation: nb-fade-in 1s cubic-bezier(0.22, 1, 0.36, 1) var(--nb-delay, 0s) forwards;
  }

  @keyframes nb-fade-in {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
