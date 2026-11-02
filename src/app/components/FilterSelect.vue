<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, computed } from "vue";
import Icon from "@/app/components/Icon.vue";

// A filter that opens as a small menu. It takes its colours from --navy, --cream and --sand,
// so it matches whichever page it sits on. Arrow keys, Home/End and Esc work as in any menu.
defineOptions({ name: "FilterSelect" });
const props = defineProps({
  modelValue: { type: String, required: true },
  options: { type: Array, required: true }, // [{ key, label }]
  label: { type: String, default: "Filter" },
});
const emit = defineEmits(["update:modelValue"]);

const open = ref(false);
const root = ref(null);
const button = ref(null);
const items = ref([]);
const current = computed(() => props.options.find((o) => o.key === props.modelValue) ?? props.options[0]);

function focusItem(index) {
  const list = items.value.filter(Boolean);
  if (!list.length) return;
  list[(index + list.length) % list.length]?.focus();
}
async function openMenu(focusAt = "current") {
  open.value = true;
  await nextTick();
  const at = focusAt === "last" ? props.options.length - 1 : Math.max(0, props.options.findIndex((o) => o.key === props.modelValue));
  focusItem(focusAt === "first" ? 0 : at);
}
function close(restoreFocus = false) {
  if (!open.value) return;
  open.value = false;
  if (restoreFocus) button.value?.focus();
}
function pick(key) {
  emit("update:modelValue", key);
  close(true);
}
function onButtonKey(event) {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    openMenu(event.key === "ArrowUp" ? "last" : "current");
  }
}
function onMenuKey(event) {
  const list = items.value.filter(Boolean);
  const at = list.indexOf(document.activeElement);
  if (event.key === "ArrowDown") (event.preventDefault(), focusItem(at + 1));
  else if (event.key === "ArrowUp") (event.preventDefault(), focusItem(at - 1));
  else if (event.key === "Home") (event.preventDefault(), focusItem(0));
  else if (event.key === "End") (event.preventDefault(), focusItem(list.length - 1));
  else if (event.key === "Escape") (event.stopPropagation(), close(true));
  else if (event.key === "Tab") close();
}
function onPointer(event) {
  if (open.value && !root.value?.contains(event.target)) close();
}
onMounted(() => document.addEventListener("pointerdown", onPointer));
onBeforeUnmount(() => document.removeEventListener("pointerdown", onPointer));
</script>

<template>
  <div ref="root" class="fs" :class="{ 'fs--open': open }">
    <button
      ref="button"
      type="button"
      class="fs__btn"
      aria-haspopup="menu"
      :aria-expanded="open ? 'true' : 'false'"
      :aria-label="`${label}: ${current?.label}`"
      @click="open ? close() : openMenu()"
      @keydown="onButtonKey"
    >
      <svg class="fs__ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16l-6 7v6l-4 2v-8z" /></svg>
      <span class="fs__value">{{ current?.label }}</span>
      <Icon name="chevron-down" :size="18" class="fs__chev" />
    </button>
    <Transition name="fs">
      <ul v-if="open" class="fs__menu" role="menu" :aria-label="label" @keydown="onMenuKey">
        <li v-for="(o, i) in options" :key="o.key" role="none" :style="{ '--i': i }">
          <button
            :ref="(el) => (items[i] = el)"
            type="button"
            role="menuitemradio"
            class="fs__item"
            :class="{ 'fs__item--on': o.key === modelValue }"
            :aria-checked="o.key === modelValue ? 'true' : 'false'"
            @click="pick(o.key)"
          >
            <span>{{ o.label }}</span>
            <svg v-if="o.key === modelValue" class="fs__tick" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </button>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.fs {
  position: relative;
  display: inline-block;
}
.fs__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px 8px 14px;
  background: transparent;
  border: 1.5px solid var(--navy, #243560);
  border-radius: 999px;
  font-family: inherit;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--navy, #243560);
  cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease, box-shadow 160ms ease;
}
.fs__btn:hover {
  background: var(--sand, #e9d9b8);
}
.fs--open .fs__btn {
  background: var(--navy, #243560);
  color: #fff;
}
.fs__btn:focus-visible,
.fs__item:focus-visible {
  outline: 3px solid var(--navy, #243560);
  outline-offset: 2px;
}
.fs__value {
  text-align: left;
}
.fs__chev {
  transition: transform 220ms cubic-bezier(0.34, 1.4, 0.64, 1);
}
.fs--open .fs__chev {
  transform: rotate(180deg);
}
.fs__menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 15;
  min-width: 100%;
  width: max-content;
  margin: 0;
  padding: 8px;
  list-style: none;
  background: var(--cream, #fdf9f0);
  border: 1.5px solid var(--navy, #243560);
  border-bottom-width: 4px;
  border-radius: 20px;
  box-shadow: 0 14px 30px rgb(36 53 96 / 22%);
  transform-origin: top right;
}
.fs__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 10px 14px;
  background: transparent;
  border: 0;
  border-radius: 12px;
  font-family: inherit;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--navy, #243560);
  text-align: left;
  cursor: pointer;
  transition: background-color 140ms ease, transform 140ms ease;
}
.fs__item:hover,
.fs__item:focus-visible {
  background: var(--sand, #e9d9b8);
  transform: translateX(2px);
}
.fs__item--on,
.fs__item--on:hover {
  background: var(--navy, #243560);
  color: #fff;
}
.fs__tick {
  flex: none;
}

/* The menu springs open from the button, and its rows follow one after another. */
.fs-enter-active {
  transition: opacity 160ms ease, transform 260ms cubic-bezier(0.34, 1.4, 0.64, 1);
}
.fs-leave-active {
  transition: opacity 120ms ease, transform 140ms ease;
}
.fs-enter-from,
.fs-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.94);
}
.fs-enter-active .fs__item {
  transition: opacity 200ms ease calc(var(--i) * 35ms + 60ms), transform 240ms cubic-bezier(0.22, 0.61, 0.36, 1) calc(var(--i) * 35ms + 60ms), background-color 140ms ease;
}
.fs-enter-from .fs__item {
  opacity: 0;
  transform: translateY(-6px);
}
@media (prefers-reduced-motion: reduce) {
  .fs__btn,
  .fs__chev,
  .fs__item,
  .fs-enter-active,
  .fs-leave-active,
  .fs-enter-active .fs__item {
    transition: none;
  }
}
</style>
