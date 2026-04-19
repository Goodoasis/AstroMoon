<script>
  let isAuthenticated = $state(false);
  let username = "Tibzt 👨‍🚀";

  function handleAuth() {
    isAuthenticated = !isAuthenticated;
  }
</script>

<div class="auth-module">
  {#if !isAuthenticated}
    <button class="btn-primary" onclick={handleAuth}>Connect Space ID</button>
  {:else}
    <button class="btn-user" onclick={handleAuth}>
      <span class="online-indicator"></span>
      {username}
    </button>
  {/if}
</div>

<style>
  .auth-module {
    display: flex;
    align-items: center;
  }
  
  .btn-primary, .btn-user {
    background: transparent;
    color: #00E5FF;
    border: 1px solid rgba(0, 229, 255, 0.4);
    padding: 6px 16px;
    border-radius: 9999px;
    font-family: 'Space Grotesk', sans-serif;
    font-weight: bold;
    font-size: 13px;
    cursor: pointer;
    box-shadow: 0 0 10px rgba(0, 229, 255, 0.1);
    transition: all 0.3s ease;
    white-space: nowrap;
  }

  .btn-user {
    color: #00FF88; /* Neon Green when connected */
    border-color: rgba(0, 255, 136, 0.4);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-primary:hover {
    background: rgba(0, 229, 255, 0.1);
    box-shadow: 0 0 15px rgba(0, 229, 255, 0.4);
    border-color: #00E5FF;
  }

  .btn-user:hover {
    background: rgba(0, 255, 136, 0.1);
    box-shadow: 0 0 15px rgba(0, 255, 136, 0.4);
    border-color: #00FF88;
  }

  .online-indicator {
    width: 6px;
    height: 6px;
    background: #00FF88;
    border-radius: 50%;
    box-shadow: 0 0 8px #00FF88;
  }
</style>
