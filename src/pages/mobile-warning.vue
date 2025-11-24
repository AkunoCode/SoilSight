<template>
  <div class="mobile-warning-page">
    <div class="content">
      <h1>Unsupported Screen Size</h1>
      <p>This application is not available on small screens. Please open SoilSight on a tablet or desktop for the full experience.</p>
      <p class="muted">Layout and interactive charts require a larger viewport.</p>
    </div>
  </div>
</template>

<script setup>
// Intentionally empty - this is a static, non-dismissible warning page.
</script>

<style scoped>
.mobile-warning-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg,#ffffff,#f4f6f9);
  padding: 2rem;
}
.mobile-warning-page .content {
  max-width: 720px;
  text-align: center;
  background: #fff;
  padding: 2.5rem 2rem;
  border-radius: 10px;
  box-shadow: 0 6px 24px rgba(16,24,40,0.08);
}
.mobile-warning-page h1 { margin: 0 0 0.5rem; font-size: 1.5rem; }
.mobile-warning-page p { margin: 0.5rem 0; color: #333; }
.mobile-warning-page .muted { color: #666; margin-top: 1rem; font-size: 0.95rem }
</style>
