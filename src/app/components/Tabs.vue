<script setup>
import "@/app/app.css";
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { lastInk } from "@/app/utils/tabInk";

defineOptions({ name: "Tabs" });

// Simple underlined tab bar. The page renders the matching role="tabpanel" elements with
// id `${idBase}-panel-${tab.id}` and aria-labelledby `${idBase}-tab-${tab.id}`.
const props = defineProps({
  modelValue: { type: String, required: true },
  tabs: { type: Array, required: true }, // [{ id, label }]
  label: { type: String, required: true },
  idBase: { type: String, required: true },
});
const emit = defineEmits(["update:modelValue"]);

const root = ref(null);

// The underline is one element that slides under the chosen tab.
const ink = ref({ left: 0, width: 0, on: false });
const inkAnimates = ref(false);
function measure() {
  const tab = root.value?.querySelector('[aria-selected="true"]');
  return tab ? { left: tab.offsetLeft, width: tab.offsetWidth } : null;
}
async function placeInk({ first = false } = {}) {
  await nextTick();
  const now = measure();
  if (!now) return;
  const before = first ? lastInk.get(props.idBase) : null;
  if (before && (before.left !== now.left || before.width !== now.width)) {
    // Start where the last tab bar left off, then glide to this tab.
    inkAnimates.value = false;
    ink.value = { ...before, on: true };
    void root.value?.offsetWidth;
    requestAnimationFrame(() => {
      inkAnimates.value = true;
      ink.value = { ...now, on: true };
    });
  } else {
    ink.value = { ...now, on: true };
    if (first) requestAnimationFrame(() => (inkAnimates.value = true));
    else inkAnimates.value = true;
  }
  lastInk.set(props.idBase, now);
}
const onResize = () => placeInk();
onMounted(() => {
  placeInk({ first: true });
  window.addEventListener("resize", onResize);
});
onBeforeUnmount(() => window.removeEventListener("resize", onResize));
watch(() => props.modelValue, () => placeInk());
watch(() => props.tabs.map((tab) => tab.id).join("|"), () => placeInk());

function select(id, focus = false) {
  emit("update:modelValue", id);
  if (focus) {
    requestAnimationFrame(() => root.value?.querySelector(`#${props.idBase}-tab-${id}`)?.focus());
  }
}

function onKeydown(event, index) {
  const last = props.tabs.length - 1;
  let next = null;
  if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
  else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = last;
  if (next === null) return;
  event.preventDefault();
  select(props.tabs[next].id, true);
}
</script>

<template>
  <div ref="root" class="apptabs" role="tablist" :aria-label="label">
    <span
      class="apptabs__ink"
      :class="{ 'apptabs__ink--on': ink.on, 'apptabs__ink--anim': inkAnimates }"
      :style="{ transform: `translateX(${ink.left}px)`, width: `${ink.width}px` }"
      aria-hidden="true"
    />
    <button
      v-for="(tab, index) in tabs"
      :id="`${idBase}-tab-${tab.id}`"
      :key="tab.id"
      type="button"
      role="tab"
      class="apptabs__tab"
      :aria-selected="modelValue === tab.id ? 'true' : 'false'"
      :aria-controls="`${idBase}-panel-${tab.id}`"
      :tabindex="modelValue === tab.id ? 0 : -1"
      @click="select(tab.id)"
      @keydown="onKeydown($event, index)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<style scoped>
.apptabs {
  position: relative;
  display: flex;
  gap: 24px;
  overflow-x: auto;
  border-bottom: 1px solid var(--nt-line);
}
.apptabs__tab {
  margin-bottom: -1px;
  padding: 10px 2px;
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  font-family: inherit;
  font-size: 0.9375rem;
  font-weight: 500;
  line-height: 22px;
  white-space: nowrap;
  color: var(--nt-muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.apptabs__tab:hover {
  color: var(--nt-ink);
}
.apptabs__tab[aria-selected="true"] {
  color: var(--nt-plum);
}
.apptabs__ink {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  border-radius: 2px;
  background: var(--nt-plum);
  opacity: 0;
  pointer-events: none;
}
.apptabs__ink--on {
  opacity: 1;
}
.apptabs__ink--anim {
  transition: transform 300ms cubic-bezier(0.22, 0.61, 0.36, 1), width 300ms cubic-bezier(0.22, 0.61, 0.36, 1);
}
@media (prefers-reduced-motion: reduce) {
  .apptabs__ink--anim {
    transition: none;
  }
}
.apptabs__tab:focus-visible {
  outline: 2px solid var(--nt-plum);
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
