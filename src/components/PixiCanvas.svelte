<script>
  import { onMount, onDestroy, createEventDispatcher } from "svelte";
  import { PixiRenderer } from "@/engine/pixi_renderer.js";

  const dispatch = createEventDispatcher();
  let container;

  onMount(async () => {
    const app = await PixiRenderer.init(container);
    dispatch("ready", { app });
  });
</script>

<div bind:this={container} id="pixi-container"></div>

<style>
  #pixi-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    background: var(--color-bg);
  }

  #pixi-container :global(canvas) {
    display: block;
  }
</style>
