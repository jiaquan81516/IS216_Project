<script setup>
import { computed } from "vue";
import { longDayName } from "@/data/calendar";

const props = defineProps({
  day: { type: Object, required: true },
  events: { type: Array, default: () => [] },
  selected: { type: Boolean, default: false },
  today: { type: Boolean, default: false },
  showMonth: { type: Boolean, default: false },
  tall: { type: Boolean, default: false },
});
defineEmits(["select"]);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = computed(() => (props.showMonth ? `${props.day.day} ${MONTHS[props.day.month]}` : String(props.day.day)));
const aria = computed(() => {
  const n = props.events.length;
  const who = props.day.who === "D" ? "Daniel" : "Mei";
  return `${longDayName(props.day.iso)}${props.today ? ", today" : ""}, ${who} on call, ${n} ${n === 1 ? "event" : "events"}`;
});
</script>

<template>
  <button
    type="button"
    class="cal-day"
    :class="{ 'cal-day--selected': selected, 'cal-day--tall': tall }"
    :aria-pressed="selected"
    :aria-label="aria"
    @click="$emit('select', day.iso)"
  >
    <span class="cal-day__band" :class="`nt-who--${day.who}`" aria-hidden="true" />
    <span class="cal-day__body">
      <span
        class="cal-day__num"
        :class="{ 'cal-day__num--today': today, 'cal-day__num--out': !day.inMonth && !today }"
      >{{ label }}</span>
      <span
        v-for="e in events"
        :key="e.id"
        class="cal-chip"
        :class="e.private ? 'cal-chip--private' : `cal-chip--${e.calendar}`"
      >{{ e.time ? `${e.time} ` : "" }}{{ e.title }}</span>
    </span>
  </button>
</template>

<style scoped>
.cal-day {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  min-height: 112px;
  padding: 0 0 8px;
  text-align: left;
  font: inherit;
  color: var(--nt-ink);
  background: var(--nt-white);
  border: 0;
  border-right: 1px solid var(--nt-line);
  border-bottom: 1px solid var(--nt-line);
  cursor: pointer;
}
.cal-day:nth-child(7n) {
  border-right: 0;
}
.cal-day:hover {
  background: var(--nt-bg);
}
.cal-day--tall {
  min-height: 220px;
}
.cal-day--selected {
  outline: 2px solid var(--nt-plum);
  outline-offset: -2px;
}
.cal-day__band {
  display: block;
  flex: none;
  height: 4px;
}
.cal-day__body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
  padding: 4px 8px 0;
}
.cal-day__num {
  font-size: 0.8125rem;
  font-weight: 500;
}
.cal-day__num--out {
  font-weight: 400;
  color: var(--nt-muted);
}
.cal-day__num--today {
  padding: 2px 7px;
  font-weight: 600;
  color: #fff;
  background: var(--nt-plum);
  border-radius: 6px;
}
.cal-chip {
  box-sizing: border-box;
  width: 100%;
  padding: 3px 6px;
  overflow: hidden;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.25;
  border-radius: 4px;
  overflow-wrap: anywhere;
}
.cal-chip--appointments {
  background: var(--nt-blue);
  color: var(--nt-blue-t);
}
.cal-chip--family {
  background: var(--nt-teal);
  color: var(--nt-teal-t);
}
.cal-chip--work {
  background: var(--nt-gray);
  color: var(--nt-ink);
}
.cal-chip--private {
  background: var(--nt-butter);
  color: var(--nt-butter-d);
  border: 1px dashed var(--nt-butter-d);
}
@media (max-width: 767px) {
  .cal-day {
    min-height: 84px;
  }
  .cal-day__body {
    padding: 4px 4px 0;
  }
  .cal-chip {
    padding: 2px 4px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}
</style>
