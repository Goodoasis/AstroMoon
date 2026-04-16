<script>
  let { message = '', visible = false } = $props();
</script>

<div id="status-toast" class:show={visible}>{message}</div>

<style>
  #status-toast {
    position: fixed; bottom: 60px; left: 50%; transform: translateX(-50%) translateY(20px);
    padding: 10px 20px; background: var(--color-surface); backdrop-filter: blur(var(--blur)); -webkit-backdrop-filter: blur(var(--blur));
    border: 1px solid var(--color-border); border-radius: var(--radius-md);
    box-shadow: var(--shadow-card), var(--shadow-hud-glow);
    font-size: 13px; font-weight: 500; color: var(--color-text); z-index: 200;
    opacity: 0; pointer-events: none; transition: all var(--transition-med);
  }
  #status-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
</style>
