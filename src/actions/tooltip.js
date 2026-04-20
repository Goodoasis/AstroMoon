/**
 * tooltip.js — Svelte action
 * Portail DOM vers document.body pour échapper à tout overflow:hidden/auto parent.
 * Usage: <span use:tooltip={"Mon texte"}>?</span>
 */

const OFFSET = 10; // px entre l'élément et le tooltip

export function tooltip(node, text) {
  let tip = null;

  function show(e) {
    if (!text) return;

    tip = document.createElement('div');
    tip.className = 'astro-tooltip-portal';
    tip.textContent = text;
    document.body.appendChild(tip);
    position(e);
  }

  function position(e) {
    if (!tip) return;
    const rect = node.getBoundingClientRect();

    // Positionnement préféré : au-dessus, aligné à droite de l'icône
    tip.style.left = '0px';
    tip.style.top = '0px';
    tip.style.visibility = 'hidden';
    tip.style.display = 'block';

    // Laisser le browser calculer la taille réelle
    requestAnimationFrame(() => {
      if (!tip) return;
      const tipRect = tip.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Position X : aligné à droite de l'icône, recalé si déborde à droite
      let x = rect.right - tipRect.width;
      if (x < 8) x = 8;
      if (x + tipRect.width > vw - 8) x = vw - tipRect.width - 8;

      // Position Y : au-dessus de l'icône, recalé si déborde en haut
      let y = rect.top - tipRect.height - OFFSET;
      if (y < 8) y = rect.bottom + OFFSET; // bascule en-dessous

      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
      tip.style.visibility = 'visible';
    });
  }

  function hide() {
    if (tip) {
      tip.remove();
      tip = null;
    }
  }

  node.addEventListener('mouseenter', show);
  node.addEventListener('mouseleave', hide);

  return {
    update(newText) {
      text = newText;
    },
    destroy() {
      hide();
      node.removeEventListener('mouseenter', show);
      node.removeEventListener('mouseleave', hide);
    }
  };
}
