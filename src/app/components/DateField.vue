<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Icon from "@/app/components/Icon.vue";

// A date field for forms, in place of the browser's own calendar: a rounded field that opens a
// cream month grid in the app's colours. The value is "YYYY-MM-DD", as <input type="date"> gives.
// Arrow keys move between days, Esc closes, and days outside min and max cannot be picked.
defineOptions({ name: "DateField", inheritAttrs: false });
const props = defineProps({
  modelValue: { type: String, default: "" },
  min: { type: String, default: "" },
  max: { type: String, default: "" },
  placeholder: { type: String, default: "Pick a date" },
  clearable: { type: Boolean, default: true },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue", "change"]);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`; // m is 0 to 11
const parse = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  return m ? { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) } : null;
};

const open = ref(false);
const root = ref(null);
const button = ref(null);
const grid = ref(null);
const view = ref("days"); // "days" or "years"
const now = new Date();
const todayIso = iso(now.getFullYear(), now.getMonth(), now.getDate());

const selected = computed(() => parse(props.modelValue));
const shown = ref({ y: now.getFullYear(), m: now.getMonth() });
const focusIso = ref(todayIso);
const yearPage = ref(0);

const label = computed(() => {
  const s = selected.value;
  return s ? `${s.d} ${MONTHS[s.m].slice(0, 3)} ${s.y}` : "";
});

// Six rows of seven, with the days of the neighbouring months faded.
const cells = computed(() => {
  const { y, m } = shown.value;
  const first = new Date(y, m, 1).getDay();
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(y, m, i - first + 1);
    const value = iso(date.getFullYear(), date.getMonth(), date.getDate());
    return {
      value,
      day: date.getDate(),
      outside: date.getMonth() !== m,
      off: Boolean((props.min && value < props.min) || (props.max && value > props.max)),
    };
  });
});

const years = computed(() => {
  const start = shown.value.y - (shown.value.y % 12) + yearPage.value * 12;
  return Array.from({ length: 12 }, (_, i) => start + i);
});

function step(delta) {
  const date = new Date(shown.value.y, shown.value.m + delta, 1);
  shown.value = { y: date.getFullYear(), m: date.getMonth() };
}
function reveal(value) {
  const p = parse(value) ?? parse(todayIso);
  shown.value = { y: p.y, m: p.m };
  focusIso.value = value || todayIso;
}
async function openPicker() {
  if (props.disabled) return;
  reveal(props.modelValue || (props.max && todayIso > props.max ? props.max : todayIso));
  view.value = "days";
  yearPage.value = 0;
  open.value = true;
  await nextTick();
  focusDay();
}
function close(restoreFocus = false) {
  if (!open.value) return;
  open.value = false;
  if (restoreFocus) button.value?.focus();
}
function focusDay() {
  grid.value?.querySelector(`[data-date="${focusIso.value}"]`)?.focus();
}
function choose(value) {
  emit("update:modelValue", value);
  emit("change", value);
  close(true);
}
function clear() {
  emit("update:modelValue", "");
  emit("change", "");
  close(true);
}
function pickToday() {
  if ((props.min && todayIso < props.min) || (props.max && todayIso > props.max)) return;
  choose(todayIso);
}
function chooseYear(year) {
  shown.value = { y: year, m: shown.value.m };
  yearPage.value = 0;
  view.value = "days";
  focusIso.value = iso(year, shown.value.m, 1);
}
async function moveFocus(days) {
  const p = parse(focusIso.value);
  const date = new Date(p.y, p.m, p.d + days);
  focusIso.value = iso(date.getFullYear(), date.getMonth(), date.getDate());
  if (date.getMonth() !== shown.value.m || date.getFullYear() !== shown.value.y) shown.value = { y: date.getFullYear(), m: date.getMonth() };
  await nextTick();
  focusDay();
}
function onGridKey(event) {
  const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  if (event.key in moves) (event.preventDefault(), moveFocus(moves[event.key]));
  else if (event.key === "PageUp") (event.preventDefault(), step(-1), (focusIso.value = iso(shown.value.y, shown.value.m, 1)), nextTick(focusDay));
  else if (event.key === "PageDown") (event.preventDefault(), step(1), (focusIso.value = iso(shown.value.y, shown.value.m, 1)), nextTick(focusDay));
}
function onKey(event) {
  if (event.key === "Escape") (event.stopPropagation(), event.preventDefault(), close(true));
}
function onPointer(event) {
  if (open.value && !root.value?.contains(event.target)) close();
}
onMounted(() => document.addEventListener("pointerdown", onPointer));
onBeforeUnmount(() => document.removeEventListener("pointerdown", onPointer));
watch(view, () => (yearPage.value = 0));
</script>

<template>
  <div ref="root" class="df" :class="{ 'df--open': open }" @keydown="onKey">
    <button
      ref="button"
      v-bind="$attrs"
      type="button"
      class="df__btn"
      aria-haspopup="dialog"
      :aria-expanded="open ? 'true' : 'false'"
      :disabled="disabled"
      @click="open ? close() : openPicker()"
    >
      <Icon name="calendar" :size="18" class="df__ico" />
      <span class="df__value" :class="{ 'df__value--empty': !label }">{{ label || placeholder }}</span>
      <Icon name="chevron-down" :size="18" class="df__chev" />
    </button>
    <Transition name="df">
      <div v-if="open" class="df__pop" role="dialog" aria-label="Choose a date">
        <div class="df__head">
          <button type="button" class="df__nav" :aria-label="view === 'days' ? 'Previous month' : 'Earlier years'" @click="view === 'days' ? step(-1) : (yearPage -= 1)">
            <Icon name="chevron-down" :size="18" class="df__prev" />
          </button>
          <button type="button" class="df__title" :aria-label="view === 'days' ? 'Choose a year' : 'Back to days'" @click="view = view === 'days' ? 'years' : 'days'">
            {{ view === "days" ? `${MONTHS[shown.m]} ${shown.y}` : `${years[0]} to ${years[11]}` }}
            <Icon name="chevron-down" :size="16" class="df__tchev" :class="{ 'df__tchev--up': view === 'years' }" />
          </button>
          <button type="button" class="df__nav" :aria-label="view === 'days' ? 'Next month' : 'Later years'" @click="view === 'days' ? step(1) : (yearPage += 1)">
            <Icon name="chevron-down" :size="18" class="df__next" />
          </button>
        </div>

        <div v-if="view === 'days'" ref="grid" class="df__grid" role="grid" @keydown="onGridKey">
          <span v-for="w in WEEK" :key="w" class="df__dow" aria-hidden="true">{{ w }}</span>
          <button
            v-for="c in cells"
            :key="c.value"
            type="button"
            class="df__day"
            :class="{
              'df__day--out': c.outside,
              'df__day--today': c.value === todayIso,
              'df__day--on': c.value === modelValue,
            }"
            :data-date="c.value"
            :tabindex="c.value === focusIso ? 0 : -1"
            :disabled="c.off"
            :aria-label="`${c.day} ${MONTHS[parse(c.value).m]} ${parse(c.value).y}`"
            :aria-pressed="c.value === modelValue ? 'true' : 'false'"
            @click="choose(c.value)"
          >
            {{ c.day }}
          </button>
        </div>
        <div v-else class="df__years">
          <button
            v-for="year in years"
            :key="year"
            type="button"
            class="df__year"
            :class="{ 'df__year--on': year === shown.y }"
            :disabled="Boolean((min && year < Number(min.slice(0, 4))) || (max && year > Number(max.slice(0, 4))))"
            @click="chooseYear(year)"
          >
            {{ year }}
          </button>
        </div>

        <div class="df__foot">
          <button type="button" class="df__link" @click="pickToday">Today</button>
          <button v-if="clearable && modelValue" type="button" class="df__link df__link--quiet" @click="clear">Clear</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.df { position: relative; width: 100%; }
.df__btn { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 10px 14px 10px 16px; background: #fff; border: 1.5px solid var(--sand, #e9d9b8); border-radius: 14px; font-family: inherit; font-size: 1rem; font-weight: 500; color: var(--navy, #243560); text-align: left; cursor: pointer; transition: border-color 0.15s ease, box-shadow 0.15s ease; }
.df__btn:hover:not(:disabled) { border-color: var(--navy, #243560); }
.df__btn:focus-visible, .df--open .df__btn { outline: none; border-color: var(--navy, #243560); box-shadow: 0 0 0 3px rgb(36 53 96 / 15%); }
.df__btn:disabled { opacity: 0.6; cursor: default; }
.df__ico { flex: none; color: #6b7392; }
.df__value { flex: 1; min-width: 0; }
.df__value--empty { color: var(--mut, #6b7392); font-weight: 400; }
.df__chev { flex: none; transition: transform 0.22s cubic-bezier(0.34, 1.4, 0.64, 1); }
.df--open .df__chev { transform: rotate(180deg); }

.df__pop { position: absolute; top: calc(100% + 6px); left: 0; z-index: 30; width: min(320px, calc(100vw - 32px)); padding: 14px; background: var(--cream, #fdf9f0); border: 1.5px solid var(--navy, #243560); border-bottom-width: 4px; border-radius: 20px; box-shadow: 0 14px 30px rgb(36 53 96 / 22%); transform-origin: top left; }
.df__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.df__title { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 6px 10px; background: transparent; border: 0; border-radius: 10px; font-family: var(--nt-serif, inherit); font-size: 1.125rem; color: var(--navy, #243560); cursor: pointer; transition: background-color 0.14s ease; }
.df__title:hover, .df__title:focus-visible { outline: none; background: var(--sand, #e9d9b8); }
.df__tchev { transition: transform 0.2s ease; }
.df__tchev--up { transform: rotate(180deg); }
.df__nav { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 44px; height: 44px; background: #fff; border: 1.5px solid var(--sand, #e9d9b8); border-radius: 50%; color: var(--navy, #243560); cursor: pointer; transition: border-color 0.14s ease, background-color 0.14s ease; }
.df__nav:hover, .df__nav:focus-visible { outline: none; border-color: var(--navy, #243560); background: var(--cream, #fdf9f0); }
.df__prev { transform: rotate(90deg); }
.df__next { transform: rotate(-90deg); }

.df__grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.df__dow { padding: 4px 0 6px; font-size: 0.8125rem; font-weight: 700; text-align: center; color: #6b7392; }
.df__day { display: flex; align-items: center; justify-content: center; aspect-ratio: 1; min-height: 38px; padding: 0; background: transparent; border: 0; border-radius: 50%; font-family: inherit; font-size: 0.9375rem; font-weight: 600; color: var(--navy, #243560); cursor: pointer; transition: background-color 0.14s ease, color 0.14s ease; }
.df__day:hover:not(:disabled), .df__day:focus-visible { outline: none; background: var(--sand, #e9d9b8); }
.df__day--out { color: #a4abc2; font-weight: 500; }
.df__day--today { box-shadow: inset 0 0 0 2px #f2a477; }
.df__day--on, .df__day--on:hover:not(:disabled), .df__day--on:focus-visible { background: var(--navy, #243560); color: #fff; }
.df__day:disabled { color: #c4c9d9; cursor: not-allowed; }

.df__years { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.df__year { padding: 12px 0; background: #fff; border: 1.5px solid var(--sand, #e9d9b8); border-radius: 14px; font-family: inherit; font-size: 0.9375rem; font-weight: 600; color: var(--navy, #243560); cursor: pointer; transition: background-color 0.14s ease, border-color 0.14s ease; }
.df__year:hover:not(:disabled), .df__year:focus-visible { outline: none; border-color: var(--navy, #243560); }
.df__year--on, .df__year--on:hover:not(:disabled) { background: var(--navy, #243560); border-color: var(--navy, #243560); color: #fff; }
.df__year:disabled { color: #c4c9d9; cursor: not-allowed; }

.df__foot { display: flex; justify-content: space-between; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--sand, #e9d9b8); }
.df__link { padding: 6px 10px; background: transparent; border: 0; border-radius: 10px; font-family: inherit; font-size: 0.9375rem; font-weight: 700; color: var(--navy, #243560); cursor: pointer; }
.df__link:hover, .df__link:focus-visible { outline: none; background: var(--sand, #e9d9b8); }
.df__link--quiet { color: #6b7392; font-weight: 600; }

.df-enter-active { transition: opacity 0.16s ease, transform 0.24s cubic-bezier(0.34, 1.4, 0.64, 1); }
.df-leave-active { transition: opacity 0.12s ease, transform 0.14s ease; }
.df-enter-from, .df-leave-to { opacity: 0; transform: translateY(-6px) scale(0.97); }
@media (prefers-reduced-motion: reduce) {
  .df__chev, .df__tchev, .df__day, .df-enter-active, .df-leave-active { transition: none; }
}
</style>
