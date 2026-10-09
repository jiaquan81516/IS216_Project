<script setup>
import "@/v3/v3.css";
import { ref } from "vue";

defineOptions({ name: "V3Tabs" });

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
  <div ref="root" class="v3tabs" role="tablist" :aria-label="label">
    <button
      v-for="(tab, index) in tabs"
      :id="`${idBase}-tab-${tab.id}`"
      :key="tab.id"
      type="button"
      role="tab"
      class="v3tabs__tab"
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
.v3tabs {
  display: flex;
  gap: 24px;
  overflow-x: auto;
  border-bottom: 1px solid var(--nt-line);
}
.v3tabs__tab {
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
.v3tabs__tab:hover {
  color: var(--nt-ink);
}
.v3tabs__tab[aria-selected="true"] {
  border-bottom-color: var(--nt-plum);
  color: var(--nt-plum);
}
.v3tabs__tab:focus-visible {
  outline: 2px solid var(--nt-plum);
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
