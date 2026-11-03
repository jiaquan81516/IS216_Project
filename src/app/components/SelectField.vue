<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "@/app/components/Icon.vue";

// A drop-down for forms, in place of the browser's own menu: a rounded field that opens a small
// cream menu in the app's colours. Arrow keys, Home/End and Esc work as in any menu.
defineOptions({ name: "SelectField", inheritAttrs: false });
const props = defineProps({
  modelValue: { type: String, default: "" },
  options: { type: Array, required: true }, // [{ value, label }]
  placeholder: { type: String, default: "Choose" },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue", "change"]);

const open = ref(false);
const root = ref(null);
const button = ref(null);
const items = ref([]);
const current = computed(() => props.options.find((o) => o.value === props.modelValue) ?? null);

function focusItem(index) {
  const list = items.value.filter(Boolean);
  if (list.length) list[(index + list.length) % list.length]?.focus();
}
async function openMenu(at = "current") {
  if (props.disabled) return;
  open.value = true;
  await nextTick();
  const selected = Math.max(0, props.options.findIndex((o) => o.value === props.modelValue));
  focusItem(at === "last" ? props.options.length - 1 : selected);
}
function close(restoreFocus = false) {
  if (!open.value) return;
  open.value = false;
  if (restoreFocus) button.value?.focus();
}
function pick(value) {
  emit("update:modelValue", value);
  emit("change", value);
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
  else if (event.key === "Escape") (event.stopPropagation(), event.preventDefault(), close(true));
  else if (event.key === "Tab") close();
}
function onPointer(event) {
  if (open.value && !root.value?.contains(event.target)) close();
}
onMounted(() => document.addEventListener("pointerdown", onPointer));
onBeforeUnmount(() => document.removeEventListener("pointerdown", onPointer));
</script>

<template>
  <div ref="root" class="ss" :class="{ 'ss--open': open }">
    <button
      ref="button"
      v-bind="$attrs"
      type="button"
      class="ss__btn"
      aria-haspopup="listbox"
      :aria-expanded="open ? 'true' : 'false'"
      :disabled="disabled"
      @click="open ? close() : openMenu()"
      @keydown="onButtonKey"
    >
      <span class="ss__value" :class="{ 'ss__value--empty': !current }">{{ current ? current.label : placeholder }}</span>
      <Icon name="chevron-down" :size="18" class="ss__chev" />
    </button>
    <Transition name="ss">
      <ul v-if="open" class="ss__menu" role="listbox" @keydown="onMenuKey">
        <li v-for="(o, i) in options" :key="o.value" role="none" :style="{ '--i': i }">
          <button
            :ref="(el) => (items[i] = el)"
            type="button"
            role="option"
            class="ss__item"
            :class="{ 'ss__item--on': o.value === modelValue }"
            :aria-selected="o.value === modelValue ? 'true' : 'false'"
            @click="pick(o.value)"
          >
            <span>{{ o.label }}</span>
            <svg v-if="o.value === modelValue" class="ss__tick" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </button>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.ss { position: relative; width: 100%; }
.ss__btn { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; min-height: 48px; padding: 10px 14px 10px 16px; background: #fff; border: 1.5px solid var(--sand, #e9d9b8); border-radius: 14px; font-family: inherit; font-size: 1rem; font-weight: 500; color: var(--navy, #243560); text-align: left; cursor: pointer; transition: border-color 0.15s ease, box-shadow 0.15s ease; }
.ss__btn:hover:not(:disabled) { border-color: var(--navy, #243560); }
.ss__btn:focus-visible, .ss--open .ss__btn { outline: none; border-color: var(--navy, #243560); box-shadow: 0 0 0 3px rgb(36 53 96 / 15%); }
.ss__btn:disabled { opacity: 0.6; cursor: default; }
.ss__value--empty { color: var(--mut, #6b7392); font-weight: 400; }
.ss__chev { flex: none; transition: transform 0.22s cubic-bezier(0.34, 1.4, 0.64, 1); }
.ss--open .ss__chev { transform: rotate(180deg); }
.ss__menu { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 20; max-height: 260px; margin: 0; padding: 6px; overflow-y: auto; list-style: none; background: var(--cream, #fdf9f0); border: 1.5px solid var(--navy, #243560); border-bottom-width: 4px; border-radius: 18px; box-shadow: 0 14px 30px rgb(36 53 96 / 22%); transform-origin: top center; }
.ss__item { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; padding: 10px 14px; background: transparent; border: 0; border-radius: 12px; font-family: inherit; font-size: 0.9375rem; font-weight: 600; color: var(--navy, #243560); text-align: left; cursor: pointer; transition: background-color 0.14s ease, transform 0.14s ease; }
.ss__item:hover, .ss__item:focus-visible { outline: none; background: var(--sand, #e9d9b8); transform: translateX(2px); }
.ss__item--on, .ss__item--on:hover, .ss__item--on:focus-visible { background: var(--navy, #243560); color: #fff; }
.ss__tick { flex: none; }
.ss-enter-active { transition: opacity 0.16s ease, transform 0.24s cubic-bezier(0.34, 1.4, 0.64, 1); }
.ss-leave-active { transition: opacity 0.12s ease, transform 0.14s ease; }
.ss-enter-from, .ss-leave-to { opacity: 0; transform: translateY(-6px) scale(0.97); }
@media (prefers-reduced-motion: reduce) {
  .ss__chev, .ss__item, .ss-enter-active, .ss-leave-active { transition: none; }
}
</style>
