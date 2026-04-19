<script>
  import { onMount } from 'svelte';
  import { viewportState } from '@/stores/viewportState.svelte.js';

  let starfieldEl;

  onMount(() => {
    const count = 90;
    for (let i = 0; i < count; i++) {
      const star = document.createElement('span');
      star.className = 'star' + (Math.random() < 0.12 ? ' bright' : '');
      star.style.left = Math.random() * 100 + '%';
      star.style.top = Math.random() * 100 + '%';
      star.style.setProperty('--twinkle-dur', (2 + Math.random() * 4).toFixed(1) + 's');
      star.style.setProperty('--twinkle-delay', (Math.random() * 5).toFixed(1) + 's');
      star.style.setProperty('--twinkle-peak', (0.3 + Math.random() * 0.5).toFixed(2));
      starfieldEl.appendChild(star);
    }
  });

  let isDraggingFile = $state(false);

  function handleUpload() {
    const input = document.getElementById('input-image');
    if (input) input.click();
  }

  function handleDrop(e) {
    e.preventDefault();
    isDraggingFile = false;
    
    // Extraction du fichier
    const files = e.dataTransfer.files;
    if (files && files.length > 0 && files[0].type.startsWith('image/')) {
      const input = document.getElementById('input-image');
      if (input) {
        // Transfert via DataTransfer (requis pour modifier input.files)
        const dt = new DataTransfer();
        dt.items.add(files[0]);
        input.files = dt.files;
        // Déclenchement manuel de l'événement change pour Svelte
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }

  function handleDragLeave(e) {
    // Si on quitte vraiment la fenêtre (pas juste un survol d'élément enfant)
    if (!e.relatedTarget || e.relatedTarget === null) {
      isDraggingFile = false;
    }
  }
</script>

<svelte:window 
  ondragenter={() => { isDraggingFile = true; }}
  ondragleave={handleDragLeave}
  ondragover={e => e.preventDefault()}
  ondrop={handleDrop}
/>

<!-- Starfield -->
<div id="starfield" bind:this={starfieldEl}></div>

<!-- Welcome Overlay -->
<div id="welcome-overlay"
  class:active-drop={isDraggingFile}
  role="region"
  aria-label="Zone de dépôt d'image">
  <div class="welcome-content">
    <h1>🌙 AstroMoon</h1>
    <div class="welcome-actions">
      <button class="welcome-btn welcome-btn-delayed" onclick={handleUpload}>
        <span class="btn-icon">🖼️</span>
        Charger votre photo lunaire
      </button>
      <p class="welcome-drop-hint welcome-btn-delayed">ou glissez-déposez une image ici</p>
    </div>
  </div>
</div>

<style>
  #starfield { position: fixed; inset: 0; z-index: 1; pointer-events: none; transition: opacity 1.2s ease-out; }
  #starfield :global(.star) { position: absolute; width: 2px; height: 2px; background: #ffffff; border-radius: 50%; animation: twinkle var(--twinkle-dur, 3s) ease-in-out infinite; animation-delay: var(--twinkle-delay, 0s); opacity: 0; }
  #starfield :global(.star.bright) { width: 3px; height: 3px; box-shadow: 0 0 4px rgba(180, 210, 255, 0.6); }

  #welcome-overlay {
    position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: transparent; z-index: 300; transition: opacity 0.8s ease-out, visibility 0.8s;
    pointer-events: none; /* Laisse passer les clics vers PixiJS par défaut */
  }
  
  #welcome-overlay.active-drop {
    pointer-events: auto;
    background: rgba(0, 229, 255, 0.08); /* Feedback visuel au survol d'un fichier */
    box-shadow: inset 0 0 50px rgba(0, 229, 255, 0.2), 
                inset 0 0 10px rgba(0, 229, 255, 0.4);
    border: 2px dashed rgba(0, 229, 255, 0.5);
    outline: 10px solid rgba(0, 229, 255, 0.05);
    outline-offset: -12px;
  }

  .welcome-content { text-align: center; max-width: 520px; pointer-events: auto; }

  .welcome-content h1 {
    font-size: 84px; font-weight: 700;
    background: var(--color-accent-grad); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    margin-bottom: 40px; letter-spacing: 2px;
    filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.8)) drop-shadow(0 0 40px rgba(0, 212, 255, 0.4)) drop-shadow(0 0 80px rgba(123, 47, 247, 0.3));
    opacity: 0;
    animation: title-fade-in 1.5s cubic-bezier(0.22, 1, 0.36, 1) forwards, hero-glow 4s ease-in-out infinite alternate 1.5s;
  }

  .welcome-actions { display: flex; flex-direction: column; align-items: center; gap: 14px; }

  .welcome-btn {
    display: flex; align-items: center; gap: 10px; padding: 14px 32px;
    border: 1px solid var(--color-border); border-radius: var(--radius-pill);
    background: var(--color-surface); backdrop-filter: blur(var(--blur)); -webkit-backdrop-filter: blur(var(--blur));
    color: var(--color-text); font-family: var(--font-main); font-size: 15px; font-weight: 500;
    cursor: pointer; box-shadow: var(--shadow-card), var(--shadow-hud-glow); transition: all var(--transition-fast);
  }
  .welcome-btn:hover { background: var(--color-surface-hover); border-color: var(--color-cyan); box-shadow: var(--shadow-card), var(--shadow-glow-cyan); transform: translateY(-3px) scale(1.02); }
  .welcome-btn .btn-icon { font-size: 22px; }

  .welcome-drop-hint {
    color: var(--color-text-bright); font-size: 13px; font-weight: 500; letter-spacing: 0.5px;
    background: rgba(0, 0, 0, 0.6); padding: 6px 16px; border-radius: var(--radius-pill);
    border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .welcome-btn-delayed { opacity: 0; transform: translateY(12px); animation: welcome-fade-in 0.8s ease-out 1.5s forwards; }
  .welcome-drop-hint.welcome-btn-delayed { animation-delay: 2s; }
</style>
