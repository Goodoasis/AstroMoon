<script>
  import { onMount } from 'svelte';
  import { uiState } from '../stores/uiState.svelte.js';

  let starfieldEl;

  onMount(() => {
    const count = 150; // Plus d'étoiles pour la profondeur
    for (let i = 0; i < count; i++) {
      const star = document.createElement('span');
      
      const rand = Math.random();
      if (rand < 0.04) {
        star.className = 'star nova';
      } else if (rand < 0.15) {
        star.className = 'star bright';
      } else {
        star.className = 'star';
      }
      
      star.style.left = Math.random() * 100 + '%';
      star.style.top = Math.random() * 100 + '%';
      
      const isNova = star.classList.contains('nova');
      star.style.setProperty('--twinkle-dur', (isNova ? 3 + Math.random() * 4 : 2 + Math.random() * 4).toFixed(1) + 's');
      star.style.setProperty('--twinkle-delay', (Math.random() * 5).toFixed(1) + 's');
      star.style.setProperty('--twinkle-peak', (isNova ? 1 : 0.3 + Math.random() * 0.5).toFixed(2));
      
      starfieldEl.appendChild(star);
    }

    const shootInterval = setInterval(() => {
      if (Math.random() > 0.2) return; // Plus fréquent pour être vu: 80% de chance
      
      const meteor = document.createElement('span');
      meteor.className = 'shooting-star';
      
      // Spawn sur un bord (0=Haut, 1=Droite, 2=Bas, 3=Gauche)
      const edge = Math.floor(Math.random() * 4);
      let sx, sy;
      if (edge === 0) { sx = Math.random() * 100; sy = -10; }
      else if (edge === 1) { sx = 110; sy = Math.random() * 100; }
      else if (edge === 2) { sx = Math.random() * 100; sy = 110; }
      else { sx = -10; sy = Math.random() * 100; }

      // Cible au centre (25% à 75%)
      const tx = 25 + Math.random() * 50;
      const ty = 25 + Math.random() * 50;

      const angleDeg = Math.atan2(ty - sy, tx - sx) * 180 / Math.PI;

      meteor.style.left = sx + '%';
      meteor.style.top = sy + '%';
      meteor.style.setProperty('--angle', `${angleDeg}deg`);
      
      const duration = 1.0 + Math.random() * 1.5; // Temps de vol
      
      meteor.classList.add('subtle');
      
      // Sélection de la couleur
      const colorRand = Math.random();
      let mainColor = '#00E5FF'; // Default Cyan
      let glowColor = 'rgba(0, 229, 255, 1)';
      
      if (colorRand < 0.4) { // 40% Blanc
        mainColor = '#ffffff';
        glowColor = 'rgba(255, 255, 255, 0.8)';
      } else if (colorRand < 0.8) { // 40% Cyan (déjà par défaut)
        mainColor = '#00E5FF';
        glowColor = 'rgba(0, 229, 255, 1)';
      } else if (colorRand < 0.85) { // 5% Violet
        mainColor = '#7C4DFF';
        glowColor = 'rgba(124, 77, 255, 1)';
      } else if (colorRand < 0.90) { // 5% Pink
        mainColor = '#FF4081';
        glowColor = 'rgba(255, 64, 129, 1)';
      } else if (colorRand < 0.95) { // 5% Gold/Orange
        mainColor = '#FF8C00';
        glowColor = 'rgba(255, 140, 0, 1)';
      } else { // 5% Green
        mainColor = '#00FF88';
        glowColor = 'rgba(0, 255, 136, 1)';
      }

      meteor.style.setProperty('--meteor-color', mainColor);
      meteor.style.setProperty('--glow-color', glowColor);

      const tailLen = 30 + Math.random() * 40; // Queue plus courte
      meteor.style.setProperty('--tail-len', `${tailLen}px`);
      
      // Spawn particles along the trajectory
      const pCount = 80 + Math.floor(Math.random() * 40);
      for (let i = 1; i <= pCount; i++) {
        const baseT = i / pCount;
        const t = Math.max(0, Math.min(1, baseT + (Math.random() * 0.02 - 0.01)));
        
        const p = document.createElement('span');
        p.className = 'meteor-particle';
        p.style.left = sx + '%';
        p.style.top = sy + '%';
        p.style.setProperty('--angle', `${angleDeg}deg`);
        p.style.setProperty('--particle-color', mainColor);
        p.style.setProperty('--particle-glow', glowColor);
        
        // La particule pop exactement au niveau de la tête du météore
        p.style.setProperty('--travel-dist', `calc(${t * 150}vw + ${tailLen}px)`);
          
          // Dérive latérale et friction (recul)
          const scatterVal = (Math.random() - 0.5) * 20; // Dérive jusqu'à 10px
          p.style.setProperty('--scatter', `${scatterVal}px`);
          const friction = Math.random() * 30 + 10; // Recule de 10 à 40px
          p.style.setProperty('--friction', `-${friction}px`);
          
          // Délai d'animation géré par CSS pour être parfaitement synchronisé avec le météore
          p.style.animationDelay = `${t * duration}s`;
          // Durée de vie aléatoire pour casser l'effet stroboscopique
          const pDur = 0.5 + Math.random() * 0.7;
          p.style.animationDuration = `${pDur}s`;
          
          starfieldEl.appendChild(p);
          
          setTimeout(() => {
            if (p.parentNode) p.remove();
          }, (t * duration + pDur + 0.1) * 1000); // Nettoyage après le fondu
        }

      meteor.style.setProperty('--travel-dist', `150vw`);
      meteor.style.setProperty('--duration', `${duration}s`);
      
      starfieldEl.appendChild(meteor);
      
      setTimeout(() => {
        if (starfieldEl && starfieldEl.contains(meteor)) {
          meteor.remove();
        }
      }, duration * 1000 + 500);
    }, 1500); // Check toutes les 1.5s

    return () => {
      clearInterval(shootInterval);
    };
  });
</script>
<div id="starfield" bind:this={starfieldEl} style="opacity: {uiState.currentPhase === 'IMPORT' ? 1 : 0};"></div>

<style>
  #starfield { position: fixed; inset: 0; z-index: -1; pointer-events: none; transition: opacity 1.2s ease-out; }
  
  #starfield :global(.star) { 
    position: absolute; width: 2px; height: 2px; 
    background: #ffffff; border-radius: 50%; 
    animation: twinkle var(--twinkle-dur, 3s) ease-in-out infinite; 
    animation-delay: var(--twinkle-delay, 0s); opacity: 0; 
  }
  
  #starfield :global(.star.bright) { 
    width: 3px; height: 3px; background: #e0f7fa; 
    box-shadow: 0 0 8px rgba(0, 229, 255, 0.9), 0 0 3px rgba(0, 229, 255, 0.5); 
    filter: blur(0.3px);
  }

  #starfield :global(.star.nova) { 
    width: 4px; height: 4px; background: #ffffff; 
    box-shadow: 0 0 20px rgba(124, 77, 255, 1), 0 0 10px rgba(0, 229, 255, 0.8), 0 0 3px #fff; 
    filter: blur(0.5px);
    animation: twinkle-nova var(--twinkle-dur, 4s) ease-in-out infinite alternate;
    animation-delay: var(--twinkle-delay, 0s);
  }

  @keyframes -global-twinkle-nova {
    0% { opacity: 0.1; transform: scale(0.6); }
    50% { opacity: 0.5; transform: scale(0.9); }
    100% { opacity: 1; transform: scale(1.6); filter: blur(0.8px); }
  }

  #starfield :global(.shooting-star) {
    position: absolute;
    width: var(--tail-len, 100px);
    height: 2px;
    background: linear-gradient(to left, #ffffff 0%, rgba(0, 229, 255, 1) 20%, transparent 100%);
    border-radius: 999px;
    box-shadow: 2px 0 10px rgba(0, 229, 255, 1);
    transform: rotate(var(--angle));
    transform-origin: left center;
    animation: shoot var(--duration, 1.5s) ease-in forwards;
    opacity: 0;
    pointer-events: none;
    z-index: 2;
  }

  #starfield :global(.shooting-star.subtle) {
    height: 1px;
    background: linear-gradient(to left, #ffffff 0%, rgba(0, 229, 255, 0.4) 30%, transparent 100%);
    box-shadow: 1px 0 4px rgba(0, 229, 255, 0.3);
    animation: shoot var(--duration, 1.5s) linear forwards;
  }

  #starfield :global(.meteor-particle) {
    position: absolute;
    width: 2px;
    height: 2px;
    background: #00E5FF;
    border-radius: 50%;
    box-shadow: 0 0 6px rgba(0, 229, 255, 0.9), 0 0 2px #fff;
    transform: rotate(var(--angle)) translateX(var(--travel-dist)) translateY(0px);
    transform-origin: left center;
    opacity: 0;
    animation: particle-fade 1.0s ease-out forwards;
    pointer-events: none;
    z-index: 1;
  }

  @keyframes -global-particle-fade {
    0% { opacity: 1; transform: rotate(var(--angle)) translateX(var(--travel-dist)) translateY(0px) scale(1.2); }
    100% { opacity: 0; transform: rotate(var(--angle)) translateX(calc(var(--travel-dist) + var(--friction, -20px))) translateY(var(--scatter, 0px)) scale(0); }
  }

  @keyframes -global-shoot {
    0% { transform: rotate(var(--angle)) translateX(0); opacity: 0; }
    15% { opacity: 1; }
    70% { opacity: 1; }
    100% { transform: rotate(var(--angle)) translateX(var(--travel-dist, 150vw)); opacity: 0; }
  }
</style>
