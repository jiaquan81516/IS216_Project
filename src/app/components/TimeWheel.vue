<script setup>
import { computed, onMounted } from "vue";
import TimeWheelCol from "@/app/components/TimeWheelCol.vue";
import { usePrefs } from "@/app/composables/usePrefs";

// A time picker that rolls like a clock. The value is "HH:MM" (24 hour), as an <input type="time">
// gives, and the wheels follow the 12 or 24 hour setting. Colours come from --navy, --sand and
// --cream on the page, so it matches the panel it sits in.
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
  <div class="tw" role="group" :aria-label="label">
    <div class="tw__top">
      <p class="tw__read" aria-live="polite">{{ readout }}</p>
      <button type="button" class="tw__now" @click="setNow">Now</button>
    </div>
    <div class="tw__dial">
      <span class="tw__band" aria-hidden="true"></span>
      <TimeWheelCol :key="`h${is12}`" :model-value="hourIndex" :items="is12 ? HOURS_12 : HOURS_24" :loop="true" :step="3" label="Hour" @update:model-value="setHour" />
      <span class="tw__colon" aria-hidden="true">:</span>
      <TimeWheelCol :model-value="minute" :items="MINUTES" :loop="true" :step="5" label="Minute" @update:model-value="setMinute" />
      <TimeWheelCol v-if="is12" :model-value="periodIndex" :items="PERIODS" label="AM or PM" @update:model-value="setPeriod" />
    </div>
  </div>
</template>

<style scoped>
.tw {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px 14px;
  background: #fffdf8;
  border: 1.5px solid var(--sand, #e9d9b8);
  border-bottom-width: 4px;
  border-radius: 20px;
}
.tw__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.tw__read {
  margin: 0;
  font-family: var(--nt-serif, inherit);
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--navy, #243560);
  transition: color 200ms ease;
}
.tw__now {
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
.tw__now:hover {
  background: var(--navy, #243560);
  color: #fff;
}
.tw__now:focus-visible {
  outline: 3px solid var(--navy, #243560);
  outline-offset: 2px;
}
.tw__dial {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
}
/* The row in the middle is lit, so it is clear what the time will be. */
.tw__band {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 40px;
  margin-top: -20px;
  background: rgb(233 217 184 / 55%);
  border: 1.5px solid var(--navy, #243560);
  border-radius: 14px;
  pointer-events: none;
  transition: background-color 200ms ease;
}
.tw__dial:focus-within .tw__band {
  background: rgb(233 217 184 / 90%);
}
.tw__colon {
  position: relative;
  z-index: 1;
  font-family: var(--nt-serif, inherit);
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--navy, #243560);
}
</style>
