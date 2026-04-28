<script>
  import { onMount } from 'svelte';
  import { viewportState } from '@/stores/viewportState.svelte.js';

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

<!-- Welcome Overlay -->
<div id="welcome-overlay"
  class:active-drop={isDraggingFile}
  role="region"
  aria-label="Zone de dépôt d'image">
  <div class="welcome-content">
    <h1>AstroMoon</h1>
    <div class="welcome-actions">
      <button class="welcome-btn welcome-btn-delayed" onclick={handleUpload}>
        <span class="btn-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
        </span>
        Charger votre photo lunaire
      </button>
      <p class="welcome-drop-hint welcome-btn-delayed">ou glissez-déposez une image ici</p>
    </div>
  </div>
</div>

<style>
  #welcome-overlay {
    position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: transparent; z-index: 300; transition: opacity 0.8s ease-out, visibility 0.8s;
    pointer-events: none;
  }
  
  #welcome-overlay.active-drop {
    pointer-events: auto;
    background: rgba(0, 229, 255, 0.08);
    box-shadow: inset 0 0 80px rgba(0, 229, 255, 0.15), 
                inset 0 0 20px rgba(0, 229, 255, 0.3);
    border: 2px dashed rgba(0, 229, 255, 0.6);
  }

  .welcome-content { text-align: center; max-width: 600px; pointer-events: auto; display: flex; flex-direction: column; align-items: center; }

  .welcome-content h1 {
    font-size: 92px; font-weight: 700;
    background: linear-gradient(135deg, #ffffff 0%, #00E5FF 50%, #7C4DFF 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    margin-bottom: 48px; letter-spacing: 2px;
    opacity: 0;
    animation: title-fade-in 1.5s cubic-bezier(0.22, 1, 0.36, 1) forwards, hero-glow 4s ease-in-out infinite alternate 1.5s;
  }

  .welcome-actions { display: flex; flex-direction: column; align-items: center; gap: 24px; }

  .welcome-btn {
    position: relative;
    display: flex; align-items: center; gap: 12px; padding: 16px 42px;
    border: 1px solid rgba(0, 229, 255, 0.3); border-radius: var(--radius-pill);
    background: rgba(10, 11, 16, 0.7);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    color: #fff; font-family: var(--font-main); font-size: 16px; font-weight: 600;
    letter-spacing: 1px; text-transform: uppercase;
    cursor: pointer; 
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 229, 255, 0.1);
    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
                box-shadow 0.4s ease,
                border-color 0.4s ease,
                background 0.4s ease;
    overflow: hidden;
  }
  
  .welcome-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(0, 229, 255, 0.2), transparent);
    transform: translateX(-100%);
    transition: transform 0.6s ease;
  }

  .welcome-btn:hover { 
    transform: translateY(-4px);
    background: rgba(0, 229, 255, 0.15); 
    border-color: #00E5FF; 
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6), 0 0 25px rgba(0, 229, 255, 0.4), inset 0 0 12px rgba(0, 229, 255, 0.2); 
  }
  
  .welcome-btn:hover::before {
    transform: translateX(100%);
  }

  .welcome-btn:active {
    transform: translateY(0) scale(0.98);
    transition: transform 0.1s ease;
  }

  .welcome-btn .btn-icon { 
    display: flex;
    align-items: center;
    justify-content: center;
    color: #00E5FF;
    filter: drop-shadow(0 0 8px rgba(0, 229, 255, 0.8)); 
  }

  .welcome-drop-hint {
    color: rgba(255, 255, 255, 0.7); font-size: 14px; font-weight: 500; letter-spacing: 0.5px;
    background: rgba(10, 11, 16, 0.6); padding: 8px 20px; border-radius: var(--radius-pill);
    border: 1px solid rgba(124, 77, 255, 0.2); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(10px);
  }

  .welcome-btn-delayed { opacity: 0; transform: translateY(16px); animation: welcome-fade-in 1s cubic-bezier(0.22, 1, 0.36, 1) 1.5s forwards; }
  .welcome-drop-hint.welcome-btn-delayed { animation-delay: 1.8s; }
</style>
