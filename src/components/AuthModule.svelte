<script>
  import NeonButton from './NeonButton.svelte';
  let isAuthenticated = $state(false);
  let username = "Tibzt 👨‍🚀";

  function handleAuth() {
    isAuthenticated = !isAuthenticated;
  }
</script>

<div class="auth-module">
  {#if !isAuthenticated}
    <NeonButton 
      variant="tab" 
      label="Connect Space ID" 
      color="#00E5FF" 
      onclick={handleAuth} 
    />
  {:else}
    <NeonButton 
      variant="tab" 
      label={username} 
      color="#00FF88" 
      onclick={handleAuth}
    >
      {#snippet icon()}
        <span class="online-indicator"></span>
      {/snippet}
    </NeonButton>
  {/if}
</div>

<style>
  .auth-module {
    display: flex;
    align-items: center;
  }

  .online-indicator {
    width: 6px;
    height: 6px;
    background: #00FF88;
    border-radius: 50%;
    box-shadow: 0 0 8px #00FF88;
  }
</style>
