<script setup>
// The frame shared by the rolling pickers: a readout on top, a small action button, and the wheels
// below under one lit band. Colours come from --navy, --sand and --cream on the page.
defineOptions({ name: "WheelShell" });
defineProps({
  readout: { type: String, default: "" },
  action: { type: String, default: "" }, // label of the quick button, e.g. "Now" or "Today"
  label: { type: String, default: "" },
});
const emit = defineEmits(["action"]);
</script>

<template>
  <div class="ws" role="group" :aria-label="label || undefined">
    <div class="ws__top">
      <slot name="top">
        <p class="ws__read" aria-live="polite">{{ readout }}</p>
        <button v-if="action" type="button" class="ws__action" @click="emit('action')">{{ action }}</button>
      </slot>
    </div>
    <div class="ws__dial">
      <span class="ws__band" aria-hidden="true"></span>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.ws {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px 14px;
  background: #fffdf8;
  border: 1.5px solid var(--sand, #e9d9b8);
  border-bottom-width: 4px;
  border-radius: 20px;
}
.ws__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.ws__read {
  margin: 0;
  font-family: var(--nt-serif, inherit);
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--navy, #243560);
}
.ws__action {
  padding: 4px 12px;
  background: transparent;
  border: 1.5px solid var(--navy, #243560);
  border-radius: 999px;
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--navy, #243560);
  cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease;
}
.ws__action:hover {
  background: var(--navy, #243560);
  color: #fff;
}
.ws__action:focus-visible {
  outline: 3px solid var(--navy, #243560);
  outline-offset: 2px;
}
.ws__dial {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
}
/* The row in the middle is lit, so it is clear what the value will be. */
.ws__band {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 40px;
  margin-top: -20px;
  background: rgb(233 217 184 / 85%);
  border: 1.5px solid var(--navy, #243560);
  border-radius: 14px;
  pointer-events: none;
  transition: background-color 200ms ease;
}
.ws__dial:focus-within .ws__band {
  background: #e9d9b8;
}
</style>
