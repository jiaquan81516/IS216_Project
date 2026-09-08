<script setup>
defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: "" },
});
defineEmits(["close"]);
</script>

<template>
  <div
    v-if="open"
    class="modal-backdrop"
    role="presentation"
    @click.self="$emit('close')"
  >
    <section
      class="app-modal"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
    >
      <header>
        <h2>{{ title }}</h2>
        <button type="button" aria-label="Close" @click="$emit('close')">
          ×
        </button>
      </header>
      <slot />
    </section>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: #0008;
}
.app-modal {
  width: min(32rem, 100%);
  padding: 1.25rem;
  background: #fff;
  border-radius: 0.75rem;
}
.app-modal header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.app-modal h2 {
  margin: 0;
}
</style>
