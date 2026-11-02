<script setup>
import { computed, onMounted } from "vue";
import TimeWheelCol from "@/app/components/TimeWheelCol.vue";
import WheelShell from "@/app/components/WheelShell.vue";

// A date picker that rolls like the time one. The value is "YYYY-MM-DD", as an <input type="date">
// gives. A day that does not exist in the month (31 Feb) rolls back to the last real day.
defineOptions({ name: "DateWheel" });
const props = defineProps({
  modelValue: { type: String, default: "" },
  label: { type: String, default: "Date" },
  yearsBefore: { type: Number, default: 1 },
  yearsAfter: { type: Number, default: 6 },
});
const emit = defineEmits(["update:modelValue"]);

const pad = (v) => String(v).padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const daysIn = (y, m) => new Date(y, m, 0).getDate(); // m is 1 to 12

const today = new Date();
const parsed = computed(() => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(props.modelValue ?? "");
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? { y, mo, d } : null;
});
const cur = computed(() => parsed.value ?? { y: today.getFullYear(), mo: today.getMonth() + 1, d: today.getDate() });

// The years on offer are fixed when the picker opens, and always include the one already chosen.
const firstYear = Math.min(today.getFullYear() - props.yearsBefore, parsed.value?.y ?? Infinity);
const lastYear = Math.max(today.getFullYear() + props.yearsAfter, parsed.value?.y ?? -Infinity);
const YEARS = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => String(firstYear + i));

function commit(y, mo, d) {
  const next = `${y}-${pad(mo)}-${pad(Math.min(d, daysIn(y, mo)))}`;
  if (next !== props.modelValue) emit("update:modelValue", next);
}
const setDay = (i) => commit(cur.value.y, cur.value.mo, i + 1);
const setMonth = (i) => commit(cur.value.y, i + 1, cur.value.d);
const setYear = (i) => commit(firstYear + i, cur.value.mo, cur.value.d);

const QUICK = [
  { label: "Today", days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "Next week", days: 7 },
];
function isoOf(days) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function pick(days) {
  const next = isoOf(days);
  if (next !== props.modelValue) emit("update:modelValue", next);
}
function setToday() {
  commit(today.getFullYear(), today.getMonth() + 1, today.getDate());
}
onMounted(() => {
  if (!parsed.value) setToday();
});
</script>

<template>
  <WheelShell :label="label">
    <template #top>
      <div class="dw__quick">
        <button v-for="q in QUICK" :key="q.label" type="button" class="dw__chip" :aria-pressed="isoOf(q.days) === modelValue ? 'true' : 'false'" @click="pick(q.days)">{{ q.label }}</button>
      </div>
    </template>
    <TimeWheelCol :model-value="Math.min(cur.d, daysIn(cur.y, cur.mo)) - 1" :items="DAYS" :loop="true" :step="5" label="Day" @update:model-value="setDay" />
    <TimeWheelCol :model-value="cur.mo - 1" :items="MONTHS" :loop="true" :step="3" label="Month" @update:model-value="setMonth" />
    <TimeWheelCol :model-value="cur.y - firstYear" :items="YEARS" label="Year" @update:model-value="setYear" />
  </WheelShell>
</template>

<style scoped>
.dw__quick {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.dw__chip {
  padding: 5px 14px;
  background: transparent;
  border: 1.5px solid var(--navy, #243560);
  border-radius: 999px;
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--navy, #243560);
  cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease, transform 160ms cubic-bezier(0.34, 1.4, 0.64, 1);
}
.dw__chip:hover {
  background: var(--sand, #e9d9b8);
}
.dw__chip:active {
  transform: scale(0.95);
}
.dw__chip[aria-pressed="true"] {
  background: var(--navy, #243560);
  color: #fff;
}
.dw__chip:focus-visible {
  outline: 3px solid var(--navy, #243560);
  outline-offset: 2px;
}
</style>
