<script setup>
import { FILTER_FEATURES } from "@/app/data/pumpingRooms";
import { activeFilterCount } from "@/app/utils/mapHelpers";

defineOptions({ name: "RoomFilterPanel" });
const props = defineProps({
  modelValue: { type: Object, default: () => ({ features: [], verifiedOnly: false }) },
});
const emit = defineEmits(["update:modelValue"]);

function toggleFeature(feature) {
  const has = props.modelValue.features.includes(feature);
  const features = has ? props.modelValue.features.filter((f) => f !== feature) : [...props.modelValue.features, feature];
  emit("update:modelValue", { ...props.modelValue, features });
}
function setVerified(event) {
  emit("update:modelValue", { ...props.modelValue, verifiedOnly: event.target.checked });
}
function clear() {
  emit("update:modelValue", { features: [], verifiedOnly: false });
}
</script>

<template>
  <section class="rf" aria-label="Filter rooms">
    <fieldset class="rf__group">
      <legend class="rf__legend">Features</legend>
      <label v-for="f in FILTER_FEATURES" :key="f" class="rf__row">
        <input type="checkbox" class="rf__box" :checked="modelValue.features.includes(f)" @change="toggleFeature(f)" />
        <span>{{ f }}</span>
      </label>
    </fieldset>
    <label class="rf__row">
      <input type="checkbox" class="rf__box" :checked="modelValue.verifiedOnly" @change="setVerified" />
      <span>Verified only</span>
    </label>
    <button v-if="activeFilterCount(modelValue)" type="button" class="app-textbtn rf__clear" @click="clear">Clear filters</button>
  </section>
</template>

<style scoped>
.rf { display: flex; flex-direction: column; gap: 12px; margin: 0 24px 16px; padding: 16px; border: 1px solid var(--nt-line); border-radius: 12px; background: var(--nt-white); }
.rf__group { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; border: 0; }
.rf__legend { float: none; width: auto; margin: 0 0 4px; padding: 0; font-size: 0.875rem; font-weight: 600; color: var(--nt-ink); }
.rf__row { display: flex; align-items: center; gap: 10px; font-size: 0.875rem; color: var(--nt-ink); cursor: pointer; }
.rf__box { width: 18px; height: 18px; margin: 0; accent-color: var(--nt-plum); }
.rf__box:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.rf__clear { align-self: flex-start; }
</style>
