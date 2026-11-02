<script setup>
import Icon from "@/app/components/Icon.vue";

// The button that shows a chosen date or time and opens its rolling picker underneath.
defineOptions({ name: "PickField" });
defineProps({
  label: { type: String, required: true },
  value: { type: String, default: "" },
  icon: { type: String, default: "calendar" },
  open: { type: Boolean, default: false },
  placeholder: { type: String, default: "Choose" },
});
const emit = defineEmits(["toggle"]);
</script>

<template>
  <button type="button" class="pf" :class="{ 'pf--open': open, 'pf--empty': !value }" :aria-expanded="open ? 'true' : 'false'" @click="emit('toggle')">
    <Icon :name="icon" :size="18" class="pf__ico" />
    <span class="pf__text">
      <span class="pf__label">{{ label }}</span>
      <span class="pf__value">{{ value || placeholder }}</span>
    </span>
    <Icon name="chevron-down" :size="16" class="pf__chev" />
  </button>
</template>

<style scoped>
.pf {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  background: #fffdf8;
  border: 1.5px solid var(--sand, #e9d9b8);
  border-radius: 14px;
  font-family: inherit;
  text-align: left;
  color: var(--navy, #243560);
  cursor: pointer;
  transition: border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease;
}
.pf:hover {
  background: #fff;
  border-color: var(--navy, #243560);
}
.pf--open {
  border-color: var(--navy, #243560);
  box-shadow: 0 0 0 3px rgb(36 53 96 / 12%);
}
.pf:focus-visible {
  outline: 3px solid var(--navy, #243560);
  outline-offset: 2px;
}
.pf__ico {
  flex: none;
}
.pf__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}
.pf__label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #5b6692;
}
.pf__value {
  overflow: hidden;
  font-size: 0.9375rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pf--empty .pf__value {
  font-weight: 500;
  color: #5b6692;
}
.pf__chev {
  flex: none;
  transition: transform 220ms cubic-bezier(0.34, 1.4, 0.64, 1);
}
.pf--open .pf__chev {
  transform: rotate(180deg);
}
@media (prefers-reduced-motion: reduce) {
  .pf,
  .pf__chev {
    transition: none;
  }
}
</style>
