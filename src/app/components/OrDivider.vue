<template>
  <div class="or" role="separator" aria-label="or">
    <span class="or__line" />
    <span class="or__text" aria-hidden="true">or</span>
    <span class="or__line" />
  </div>
</template>

<style scoped>
.or { display: flex; align-items: center; gap: 12px; width: 100%; }
.or__line { flex: 1 1 0; height: 1px; background: var(--nt-line); }
.or__text { font-size: 0.875rem; line-height: normal; color: var(--nt-muted); }
</style>
