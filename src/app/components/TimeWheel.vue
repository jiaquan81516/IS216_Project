<script setup>
import { computed, onMounted } from "vue";
import TimeWheelCol from "@/app/components/TimeWheelCol.vue";
import WheelShell from "@/app/components/WheelShell.vue";
import { usePrefs } from "@/app/composables/usePrefs";

// A time picker that rolls like a clock. The value is "HH:MM" (24 hour), as an <input type="time">
// gives, and the wheels follow the 12 or 24 hour setting.
defineOptions({ name: "TimeWheel" });
const props = defineProps({
  modelValue: { type: String, default: "" },
  label: { type: String, default: "Time" },
});
const emit = defineEmits(["update:modelValue"]);

const { timeFormat } = usePrefs();
const is12 = computed(() => timeFormat.value !== "24h");
const pad = (v) => String(v).padStart(2, "0");

const HOURS_12 = ["12", ...Array.from({ length: 11 }, (_, i) => String(i + 1))];
const HOURS_24 = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i));
const PERIODS = ["AM", "PM"];

const parsed = computed(() => {
  const m = /^(\d{2}):(\d{2})$/.exec(props.modelValue ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? { h, min } : null;
});
const hour = computed(() => parsed.value?.h ?? new Date().getHours());
const minute = computed(() => parsed.value?.min ?? new Date().getMinutes());

function commit(h, min) {
  const next = `${pad(h)}:${pad(min)}`;
  if (next !== props.modelValue) emit("update:modelValue", next);
}
const hourIndex = computed(() => (is12.value ? hour.value % 12 : hour.value));
const periodIndex = computed(() => (hour.value >= 12 ? 1 : 0));
const setHour = (i) => commit(is12.value ? i + periodIndex.value * 12 : i, minute.value);
const setMinute = (i) => commit(hour.value, i);
const setPeriod = (i) => commit((hour.value % 12) + i * 12, minute.value);

const readout = computed(() =>
  is12.value ? `${hour.value % 12 || 12}:${pad(minute.value)} ${hour.value >= 12 ? "PM" : "AM"}` : `${pad(hour.value)}:${pad(minute.value)}`,
);
function setNow() {
  const d = new Date();
  commit(d.getHours(), d.getMinutes());
}
// A picker that shows a time should hold that time, so an empty value is filled in with now.
onMounted(() => {
  if (!parsed.value) setNow();
});
</script>

<template>
  <WheelShell :readout="readout" action="Now" :label="label" @action="setNow">
    <TimeWheelCol :key="`h${is12}`" :model-value="hourIndex" :items="is12 ? HOURS_12 : HOURS_24" :loop="true" :step="3" label="Hour" @update:model-value="setHour" />
    <span class="tw__colon" aria-hidden="true">:</span>
    <TimeWheelCol :model-value="minute" :items="MINUTES" :loop="true" :step="5" label="Minute" @update:model-value="setMinute" />
    <TimeWheelCol v-if="is12" :model-value="periodIndex" :items="PERIODS" label="AM or PM" @update:model-value="setPeriod" />
  </WheelShell>
</template>

<style scoped>
.tw__colon {
  position: relative;
  z-index: 1;
  font-family: var(--nt-serif, inherit);
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--navy, #243560);
}
</style>
