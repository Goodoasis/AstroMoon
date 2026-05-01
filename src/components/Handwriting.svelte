<script>
    import { onMount } from 'svelte';
    import { loadModel, generatePath } from '../engine/handwritingEngine.js';

    let { text = "AstroMoon", styleId = 21, bias = 0.75, modelStrokeWidth = 0.75, triggerSeed = 0, fill = "none", stroke = "#00E5FF", strokeWidth = "1.5", class: className = "" } = $props();

    let isLoaded = $state(false);

    onMount(async () => {
        try {
            await loadModel('/handwriting_model.bin');
            isLoaded = true;
        } catch (error) {
            console.error("Erreur lors du chargement du modèle RNN :", error);
        }
    });

    // Génération réactive (synchronisée) du chemin SVG - Inclut le triggerSeed pour forcer le recalcul
    let svgData = $derived(isLoaded && text.trim() !== "" ? (triggerSeed, generatePath(text, styleId, bias, modelStrokeWidth)) : { d: "", viewBox: "0 0 100 100" });
</script>

<svg 
    viewBox={svgData.viewBox} 
    class="handwriting-canvas {className}"
    xmlns="http://www.w3.org/2000/svg"
>
    {#if svgData.d}
        <path 
            d={svgData.d} 
            fill={fill} 
            stroke={stroke} 
            stroke-width={strokeWidth} 
            stroke-linecap="round"
            stroke-linejoin="round"
        />
    {/if}
</svg>

<style>
    .handwriting-canvas {
        display: block;
        width: 100%;
        height: auto;
        /* Animation subtile de lueur propre au design Cyber-Vibrant */
        filter: drop-shadow(0 0 4px var(--neon-cyan, rgba(0, 229, 255, 0.4)));
    }
</style>
