<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import Collapse from "@/app/components/Collapse.vue";
import PickField from "@/app/components/PickField.vue";
import SegToggle from "@/app/components/SegToggle.vue";
import TimeWheel from "@/app/components/TimeWheel.vue";
import { usePrefs } from "@/app/composables/usePrefs";
import { addDays, mondayOf, toIso, weekNights } from "@/app/utils/rotaHelpers";
import { formatHhmm } from "@/app/utils/pickerHelpers";
import { applyShift, DAY_END, DAY_START, removeShift, toHhmm, toMinutes } from "@/app/utils/scheduleHelpers";

// A small week or day calendar for who looks after the baby between 6 AM and 6 PM. Only the daytime
// is a grid. The night is one band underneath, read only, and comes from the night plan.
defineOptions({ name: "DaySchedule" });
const props = defineProps({
  carers: { type: Array, default: () => [] }, // names of household carers who can see Duty
  rota: { type: Object, required: true }, // the rota view: schedule, plus what weekNights needs
  names: { type: Object, default: () => ({ me: "Me", partner: "Partner" }) },
  hasPartner: { type: Boolean, default: false },
  babyLabel: { type: String, default: "the baby" },
});
const emit = defineEmits(["save"]);

const { timeFormat } = usePrefs();
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const OTHERS = ["Nanny", "Grandma", "Grandpa", "Childcare", "Helper"];
const SPAN = DAY_END - DAY_START; // 720 minutes in the grid

// ---- Names ----
const firstOf = (full) => {
  const first = String(full ?? "").trim().split(/\s+/)[0] || "";
  return first.charAt(0).toUpperCase() + first.slice(1);
};
const myFirst = computed(() => firstOf(props.names.me) || "Me");
const partnerFirst = computed(() => firstOf(props.names.partner) || "Partner");
const nameOf = (who, label = "") => (who === "me" ? "You" : who === "partner" ? partnerFirst.value : who === "both" ? "Both" : label || "Someone else");
const letter = (text) => String(text || "?").trim().charAt(0).toUpperCase();
// The small round label in a block: your initial, your partner's, both, or the first letter of "Nanny".
const badge = (who, label = "") => (who === "both" ? `${letter(myFirst.value)}+${letter(partnerFirst.value)}` : who === "me" ? letter(myFirst.value) : who === "partner" ? letter(partnerFirst.value) : letter(label || "Someone"));

// ---- Which days are showing ----
const view = ref("week");
const VIEWS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
];
const todayIso = toIso(new Date());
const nowTick = ref(new Date());
let timer = null;
onMounted(() => {
  timer = setInterval(() => {
    nowTick.value = new Date();
  }, 60000);
});
onBeforeUnmount(() => clearInterval(timer));

const weekStart = ref(mondayOf(new Date()));
const dayIdx = ref((new Date().getDay() + 6) % 7);
const columns = computed(() => (view.value === "day" ? [dayIdx.value] : [0, 1, 2, 3, 4, 5, 6]));
const dateOf = (day) => addDays(weekStart.value, day);
const dayNumber = (iso) => Number(iso.slice(8, 10));
const monthOf = (iso) => MONTHS[Number(iso.slice(5, 7)) - 1];
const title = computed(() => {
  if (view.value === "day") {
    const iso = dateOf(dayIdx.value);
    return `${DAYS[dayIdx.value]} ${dayNumber(iso)} ${monthOf(iso)}`;
  }
  const a = weekStart.value;
  const b = addDays(a, 6);
  return monthOf(a) === monthOf(b) ? `${dayNumber(a)} to ${dayNumber(b)} ${monthOf(b)}` : `${dayNumber(a)} ${monthOf(a)} to ${dayNumber(b)} ${monthOf(b)}`;
});
function step(n) {
  if (view.value === "week") {
    weekStart.value = addDays(weekStart.value, 7 * n);
    return;
  }
  let d = dayIdx.value + n;
  if (d < 0) {
    d = 6;
    weekStart.value = addDays(weekStart.value, -7);
  } else if (d > 6) {
    d = 0;
    weekStart.value = addDays(weekStart.value, 7);
  }
  dayIdx.value = d;
}
const onThisWeek = computed(() => weekStart.value === mondayOf(new Date()));
function goToday() {
  weekStart.value = mondayOf(new Date());
  dayIdx.value = (new Date().getDay() + 6) % 7;
}

// ---- The grid ----
const PH = computed(() => (view.value === "day" ? 30 : 26)); // pixels for one hour
const shiftsOf = (day) => (props.rota.schedule ?? []).filter((s) => s.day === day);
const nightsOf = computed(() => {
  try {
    return weekNights(props.rota, weekStart.value) || [];
  } catch {
    return [];
  }
});
const HOUR_LABELS = [6, 8, 10, 12, 14, 16, 18].map((h, i) => ({ at: (i * 2 * 60) / SPAN * 100, text: formatHhmm(`${String(h).padStart(2, "0")}:00`, timeFormat.value).replace(":00", "") }));
const blockStyle = (s) => ({ top: `${((s.start - DAY_START) / 60) * PH.value}px`, height: `${((s.end - s.start) / 60) * PH.value - 3}px` });
const sizeOf = (s) => {
  const px = ((s.end - s.start) / 60) * PH.value;
  return px < 24 ? "xs" : px < 52 ? "sm" : "md";
};
const nowTop = computed(() => {
  const n = nowTick.value;
  const min = n.getHours() * 60 + n.getMinutes();
  if (min < DAY_START || min >= DAY_END) return null;
  return `${((min - DAY_START) / 60) * PH.value}px`;
});
const isToday = (day) => dateOf(day) === todayIso;
const range = (s) => `${formatHhmm(toHhmm(s.start), timeFormat.value)} to ${formatHhmm(toHhmm(s.end), timeFormat.value)}`;
const blockLabel = (s) => `${nameOf(s.who, s.label)}, ${DAYS[s.day]}, ${range(s)}. Edit`;

// ---- Tip ----
const TIP_KEY = "nurturetrack-duty-tip";
const tipOpen = ref(true);
try {
  tipOpen.value = localStorage.getItem(TIP_KEY) !== "done";
} catch {
  /* storage can be blocked */
}
function hideTip() {
  tipOpen.value = false;
  try {
    localStorage.setItem(TIP_KEY, "done");
  } catch {
    /* storage can be blocked */
  }
}

// ---- Drag or tap on a day to add ----
let drag = null;
const preview = reactive({ day: -1, start: 0, end: 0 });
const SNAP = 30;
function minuteAt(event, el) {
  const box = el.getBoundingClientRect();
  const frac = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
  return DAY_START + Math.round((frac * SPAN) / SNAP) * SNAP;
}
function onDown(event, day) {
  if (event.target.closest(".ds__sh") || event.button > 0) return;
  const el = event.currentTarget;
  drag = { day, el, a: minuteAt(event, el), b: minuteAt(event, el), y: event.clientY, mouse: event.pointerType === "mouse" };
  if (drag.mouse) el.setPointerCapture?.(event.pointerId);
}
function onMove(event) {
  if (!drag || !drag.mouse) return;
  drag.b = minuteAt(event, drag.el);
  if (Math.abs(event.clientY - drag.y) < 6) return;
  preview.day = drag.day;
  preview.start = Math.min(drag.a, drag.b);
  preview.end = Math.max(drag.a, drag.b, preview.start + SNAP);
}
function onUp(event) {
  if (!drag) return;
  const { day, a, b, y, mouse } = drag;
  drag = null;
  preview.day = -1;
  if (mouse && Math.abs(event.clientY - y) >= 6) {
    const start = Math.min(a, b);
    openSheet({ day, start, end: Math.max(Math.max(a, b), start + SNAP) });
    return;
  }
  // A tap: two hours from the tapped hour, kept inside the day.
  const start = Math.min(Math.floor(a / 60) * 60, DAY_END - 60);
  openSheet({ day, start, end: Math.min(start + 120, DAY_END) });
}
function onCancel() {
  drag = null;
  preview.day = -1;
}

// ---- The sheet ----
const sheetOpen = ref(false);
const sheetEl = ref(null);
const draft = reactive({ id: "", day: 0, start: 480, end: 960, who: "me", label: "", days: [0] });
const elseOpen = ref(false);
const picker = ref(""); // "start", "end" or ""
const error = ref("");
let opener = null;

function openSheet(seed) {
  opener = document.activeElement;
  const existing = seed.id ? (props.rota.schedule ?? []).find((s) => s.id === seed.id) : null;
  const src = existing ?? { id: "", who: "me", label: "", ...seed };
  Object.assign(draft, { id: src.id, day: src.day, start: src.start, end: src.end, who: src.who, label: src.label, days: [src.day] });
  elseOpen.value = src.who === "other";
  customOpen.value = false;
  customText.value = "";
  picker.value = "";
  error.value = "";
  sheetOpen.value = true;
  nextTick(() => sheetEl.value?.focus());
}
function closeSheet() {
  sheetOpen.value = false;
  nextTick(() => opener?.focus?.());
}
const dateLine = computed(() => `${DAYS[draft.day]} ${dayNumber(dateOf(draft.day))} ${monthOf(dateOf(draft.day))}`);

const whoChips = computed(() => [
  { value: "me", label: "You" },
  ...(props.hasPartner ? [{ value: "partner", label: partnerFirst.value }] : []),
  { value: "both", label: "Both" },
]);
function pickWho(value) {
  draft.who = value;
  if (value !== "other") draft.label = "";
  elseOpen.value = false;
}
// Everyone you can pick under "Someone else": the usual carers, then anyone already on the schedule,
// then a name you just typed. Typing a name adds it and picks it.
const customOpen = ref(false);
const customText = ref("");
const otherChips = computed(() => {
  // Household carers first, then the usual roles, then anyone already on the schedule.
  const seen = new Set();
  const out = [];
  const add = (n) => {
    const key = String(n ?? "").trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(n);
  };
  (props.carers ?? []).forEach(add);
  OTHERS.forEach(add);
  for (const s of props.rota.schedule ?? []) if (s.who === "other") add(s.label);
  add(draft.label);
  return out;
});
function addCustom() {
  const name = customText.value.trim().replace(/\s+/g, " ").slice(0, 30);
  if (!name) return;
  draft.who = "other";
  draft.label = name.charAt(0).toUpperCase() + name.slice(1);
  customText.value = "";
  customOpen.value = false;
}
function pickElse() {
  if (draft.who === "other") {
    elseOpen.value = !elseOpen.value;
    return;
  }
  draft.who = "other";
  draft.label = draft.label || "";
  elseOpen.value = true;
}
const startValue = computed({ get: () => toHhmm(draft.start), set: (v) => (draft.start = toMinutes(v) ?? draft.start) });
const endValue = computed({ get: () => toHhmm(draft.end), set: (v) => (draft.end = toMinutes(v) ?? draft.end) });
const PRESETS = [
  { label: "Morning", start: 360, end: 720 },
  { label: "Afternoon", start: 720, end: 1080 },
  { label: "All day", start: 360, end: 1080 },
];
function usePreset(p) {
  draft.start = p.start;
  draft.end = p.end;
  picker.value = "";
}
const presetOn = (p) => draft.start === p.start && draft.end === p.end;
function toggleDay(i) {
  const has = draft.days.includes(i);
  draft.days = has ? draft.days.filter((d) => d !== i) : [...draft.days, i];
  if (!draft.days.length) draft.days = [i];
}
function setDays(kind) {
  draft.days = kind === "weekdays" ? [0, 1, 2, 3, 4] : kind === "all" ? [0, 1, 2, 3, 4, 5, 6] : [draft.day];
}
const daysIs = (kind) => {
  const want = kind === "weekdays" ? [0, 1, 2, 3, 4] : kind === "all" ? [0, 1, 2, 3, 4, 5, 6] : [draft.day];
  return want.length === draft.days.length && want.every((d) => draft.days.includes(d));
};

function save() {
  if (customText.value.trim()) addCustom();
  if (draft.who === "other" && !draft.label) {
    error.value = "Choose who it is, or add a name.";
    return;
  }
  if (draft.end <= draft.start) {
    error.value = "Choose a finish time after the start time.";
    return;
  }
  if (draft.start < DAY_START || draft.end > DAY_END) {
    error.value = "Day shifts run from 6 AM to 6 PM. The night comes from the night plan.";
    return;
  }
  const next = applyShift(props.rota.schedule ?? [], { days: draft.days, start: draft.start, end: draft.end, who: draft.who, label: draft.label }, draft.id);
  emit("save", next);
  closeSheet();
}
function remove() {
  emit("save", removeShift(props.rota.schedule ?? [], draft.id));
  closeSheet();
}
function onSheetKey(event) {
  if (event.key === "Escape") {
    event.stopPropagation();
    closeSheet();
  }
}

const hasAny = computed(() => (props.rota.schedule ?? []).length > 0);
function addButton() {
  openSheet({ day: view.value === "day" ? dayIdx.value : (new Date().getDay() + 6) % 7, start: 480, end: 960 });
}
</script>

<template>
  <div class="ds" :class="`ds--${view}`" :style="{ '--ph': `${PH}px` }">
    <div class="ds__bar">
      <SegToggle v-model="view" :options="VIEWS" label="Calendar view" class="ds__seg" />
      <button type="button" class="ds__add" @click="addButton">Add a shift</button>
    </div>

    <div class="ds__nav">
      <button type="button" class="ds__arr" :aria-label="view === 'week' ? 'Previous week' : 'Previous day'" @click="step(-1)">&lsaquo;</button>
      <p class="ds__title" aria-live="polite">{{ title }}</p>
      <button type="button" class="ds__arr" :aria-label="view === 'week' ? 'Next week' : 'Next day'" @click="step(1)">&rsaquo;</button>
      <button v-if="!onThisWeek" type="button" class="ds__today" @click="goToday">Today</button>
    </div>

    <div v-if="tipOpen" class="ds__tip">
      <ol class="ds__steps">
        <li><i>1</i>Tap or drag on a day</li>
        <li><i>2</i>Choose who</li>
        <li><i>3</i>Save</li>
      </ol>
      <button type="button" class="ds__tipx" @click="hideTip">Got it</button>
    </div>

    <div class="ds__cal">
      <div class="ds__head" :style="{ gridTemplateColumns: `52px repeat(${columns.length}, minmax(0, 1fr))` }">
        <div></div>
        <div v-for="d in columns" :key="d" class="ds__hd" :class="{ 'is-today': isToday(d) }">
          {{ DAYS[d] }}
          <span class="ds__date">{{ dayNumber(dateOf(d)) }}</span>
        </div>
      </div>

      <div class="ds__body" :style="{ gridTemplateColumns: `52px repeat(${columns.length}, minmax(0, 1fr))` }">
        <div class="ds__hours" aria-hidden="true">
          <span v-for="h in HOUR_LABELS" :key="h.at" :style="{ top: `${h.at}%` }">{{ h.text }}</span>
        </div>
        <div
          v-for="d in columns"
          :key="d"
          class="ds__col"
          @pointerdown="onDown($event, d)"
          @pointermove="onMove"
          @pointerup="onUp"
          @pointercancel="onCancel"
        >
          <button
            v-for="s in shiftsOf(d)"
            :key="s.id"
            type="button"
            class="ds__sh"
            :class="[`ds__sh--${s.who}`, `is-${sizeOf(s)}`]"
            :style="blockStyle(s)"
            :aria-label="blockLabel(s)"
            @click.stop="openSheet({ id: s.id, day: s.day, start: s.start, end: s.end })"
          >
            <span class="ds__who">
              <span class="ds__nm">{{ nameOf(s.who, s.label) }}</span>
            </span>
            <span v-if="sizeOf(s) === 'md'" class="ds__time">{{ range(s) }}</span>
          </button>
          <div v-if="preview.day === d" class="ds__prev" :style="{ top: `${((preview.start - DAY_START) / 60) * PH}px`, height: `${((preview.end - preview.start) / 60) * PH}px` }">
            <span v-if="preview.end - preview.start >= 60">{{ formatHhmm(toHhmm(preview.start), timeFormat) }} to {{ formatHhmm(toHhmm(preview.end), timeFormat) }}</span>
          </div>
          <span v-if="isToday(d) && nowTop" class="ds__now" :style="{ top: nowTop }" aria-hidden="true"></span>
          <span v-if="!shiftsOf(d).length && !hasAny" class="ds__empty">Tap to add</span>
        </div>
      </div>

      <div class="ds__night" :style="{ gridTemplateColumns: `52px repeat(${columns.length}, minmax(0, 1fr))` }">
        <div class="ds__nlab">Night<small>6 PM to 6 AM</small></div>
        <div v-for="d in columns" :key="d" class="ds__ncell">
          <template v-if="nightsOf[d] && nightsOf[d].who !== 'open'">
            <span class="ds__pill" :class="`ds__pill--${nightsOf[d].who}`">{{ view === "day" ? nameOf(nightsOf[d].who) : badge(nightsOf[d].who) }}</span>
            <template v-if="nightsOf[d].shared && nightsOf[d].second">
              <span class="ds__then" aria-hidden="true">then</span>
              <span class="ds__pill" :class="`ds__pill--${nightsOf[d].second}`">{{ view === "day" ? nameOf(nightsOf[d].second) : badge(nightsOf[d].second) }}</span>
            </template>
          </template>
          <span v-else class="ds__pill ds__pill--open">Open</span>
        </div>
      </div>
    </div>

    <ul class="ds__legend" aria-label="Colours">
      <li><i class="ds__sw ds__sw--me"></i>You</li>
      <li v-if="hasPartner"><i class="ds__sw ds__sw--partner"></i>{{ partnerFirst }}</li>
      <li><i class="ds__sw ds__sw--both"></i>Both of you</li>
      <li><i class="ds__sw ds__sw--other"></i>Someone else</li>
      <li><i class="ds__sw ds__sw--night"></i>Night, from the night plan</li>
    </ul>

    <Teleport to="body">
      <Transition name="ds-sheet">
        <div v-if="sheetOpen" class="dss" @click.self="closeSheet" @keydown="onSheetKey">
          <div ref="sheetEl" class="dss__sheet" role="dialog" aria-modal="true" aria-labelledby="dss-title" tabindex="-1">
            <h3 id="dss-title" class="dss__title">{{ draft.id ? "Edit shift" : "New shift" }}<span>{{ dateLine }}</span></h3>

            <section class="dss__sec" aria-labelledby="dss-who">
              <p id="dss-who" class="dss__lab">Who looks after {{ babyLabel }}?</p>
              <div class="dss__chips" role="radiogroup" aria-labelledby="dss-who">
                <button v-for="c in whoChips" :key="c.value" type="button" role="radio" class="dss__chip" :aria-checked="draft.who === c.value ? 'true' : 'false'" @click="pickWho(c.value)">{{ c.label }}</button>
                <button type="button" role="radio" class="dss__chip" :aria-checked="draft.who === 'other' ? 'true' : 'false'" @click="pickElse">Someone else</button>
              </div>
              <Collapse>
                <div v-if="elseOpen" class="dss__else">
                  <div class="dss__chips" role="radiogroup" aria-label="Who else">
                    <button v-for="n in otherChips" :key="n" type="button" role="radio" class="dss__chip dss__chip--sm" :aria-checked="draft.who === 'other' && draft.label === n ? 'true' : 'false'" @click="draft.label = n">{{ n }}</button>
                    <button v-if="!customOpen" type="button" class="dss__chip dss__chip--sm dss__chip--add" @click="customOpen = true">+ Someone new</button>
                  </div>
                  <form v-if="customOpen" class="dss__custom" @submit.prevent="addCustom">
                    <label class="visually-hidden" for="dss-name">Name or role</label>
                    <input id="dss-name" v-model="customText" class="dss__input" type="text" maxlength="30" autocomplete="off" placeholder="A name or role, e.g. Aunty May" />
                    <button type="submit" class="dss__addbtn" :disabled="!customText.trim()">Add</button>
                  </form>
                </div>
              </Collapse>
            </section>

            <section class="dss__sec" aria-labelledby="dss-when">
              <p id="dss-when" class="dss__lab">When</p>
              <div class="dss__chips">
                <button v-for="p in PRESETS" :key="p.label" type="button" class="dss__chip dss__chip--sm" :aria-pressed="presetOn(p) ? 'true' : 'false'" @click="usePreset(p)">{{ p.label }}</button>
              </div>
              <div class="dss__times">
                <PickField label="From" icon="clock" :value="formatHhmm(startValue, timeFormat)" :open="picker === 'start'" @toggle="picker = picker === 'start' ? '' : 'start'" />
                <PickField label="Until" icon="clock" :value="formatHhmm(endValue, timeFormat)" :open="picker === 'end'" @toggle="picker = picker === 'end' ? '' : 'end'" />
              </div>
              <Collapse>
                <div v-if="picker" class="dss__wheel">
                  <TimeWheel v-if="picker === 'start'" key="s" v-model="startValue" label="Start time" />
                  <TimeWheel v-else key="e" v-model="endValue" label="Finish time" />
                </div>
              </Collapse>
            </section>

            <section class="dss__sec" aria-labelledby="dss-rep">
              <p id="dss-rep" class="dss__lab">Repeat every week on</p>
              <div class="dss__days" role="group" aria-labelledby="dss-rep">
                <button v-for="(n, i) in DAYS" :key="n" type="button" class="dss__day" :aria-pressed="draft.days.includes(i) ? 'true' : 'false'" :aria-label="n" @click="toggleDay(i)">{{ n.charAt(0) }}</button>
              </div>
              <div class="dss__chips">
                <button type="button" class="dss__chip dss__chip--sm" :aria-pressed="daysIs('one') ? 'true' : 'false'" @click="setDays('one')">Just {{ DAYS[draft.day] }}</button>
                <button type="button" class="dss__chip dss__chip--sm" :aria-pressed="daysIs('weekdays') ? 'true' : 'false'" @click="setDays('weekdays')">Weekdays</button>
                <button type="button" class="dss__chip dss__chip--sm" :aria-pressed="daysIs('all') ? 'true' : 'false'" @click="setDays('all')">Every day</button>
              </div>
            </section>

            <p v-if="error" class="dss__error" role="alert">{{ error }}</p>
            <div class="dss__foot">
              <button type="button" class="dss__save" @click="save">Save shift</button>
              <button type="button" class="dss__cancel" @click="closeSheet">Cancel</button>
              <button v-if="draft.id" type="button" class="dss__del" @click="remove">Delete</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.ds { --ink: #1f2a52; --mut: #6b7392; --sand: #e9d9b8; --navy: #243560; --apr: #c4642f; display: flex; flex-direction: column; gap: 12px; container-type: inline-size; }
.ds__bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.ds__seg { min-width: 200px; }
.ds__add { padding: 10px 20px; background: var(--navy); border: 0; border-bottom: 3px solid #182246; border-radius: 14px; font-family: inherit; font-size: 0.9375rem; font-weight: 600; color: #fff; cursor: pointer; transition: background-color 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.4, 0.64, 1); }
.ds__add:hover { background: #2d3f70; }
.ds__add:active { transform: translateY(1px) scale(0.98); }
.ds__nav { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ds__title { margin: 0 6px; min-width: 150px; text-align: center; font-family: var(--nt-serif, inherit); font-size: 1.25rem; font-weight: 700; color: var(--ink); }
.ds__arr { width: 36px; height: 36px; padding: 0; background: #fffdf8; border: 1.5px solid var(--sand); border-radius: 50%; font-size: 1.125rem; line-height: 1; color: var(--navy); cursor: pointer; transition: border-color 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.4, 0.64, 1); }
.ds__arr:hover { border-color: var(--navy); }
.ds__arr:active { transform: scale(0.92); }
.ds__today { padding: 6px 16px; background: transparent; border: 1.5px solid var(--navy); border-radius: 999px; font-family: inherit; font-size: 0.875rem; font-weight: 600; color: var(--navy); cursor: pointer; }
.ds__today:hover { background: var(--navy); color: #fff; }
.ds__arr:focus-visible, .ds__today:focus-visible, .ds__add:focus-visible, .ds__tipx:focus-visible, .ds__sh:focus-visible { outline: 3px solid var(--navy); outline-offset: 2px; }

.ds__tip { display: flex; align-items: center; gap: 12px 20px; flex-wrap: wrap; padding: 10px 14px; background: #fffdf8; border: 1.5px dashed var(--sand); border-radius: 14px; font-size: 0.875rem; color: var(--ink); }
.ds__steps { display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 0; padding: 0; list-style: none; }
.ds__steps li { display: flex; align-items: center; gap: 8px; }
.ds__steps i { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--navy); font-size: 0.75rem; font-style: normal; font-weight: 700; color: #fff; }
.ds__tipx { margin-left: auto; padding: 0; background: none; border: 0; font-family: inherit; font-size: 0.8125rem; font-weight: 600; color: var(--mut); text-decoration: underline; cursor: pointer; }

.ds__cal { border: 1.5px solid var(--sand); border-radius: 18px; overflow: hidden; background: #fffdf8; }
.ds__head, .ds__body, .ds__night { display: grid; }
.ds__head { border-bottom: 1.5px solid var(--sand); background: #fdf9f0; }
.ds__hd { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 2px; font-size: 0.8125rem; font-weight: 600; text-align: center; color: var(--ink); }
.ds__date { display: grid; place-items: center; min-width: 26px; height: 26px; border-radius: 50%; font-size: 0.8125rem; font-weight: 600; color: var(--mut); }
.ds__hd.is-today { color: var(--apr); }
.ds__hd.is-today .ds__date { background: var(--apr); color: #fff; }
.ds__hours { position: relative; height: calc(12 * var(--ph)); background: #fdf9f0; border-right: 1.5px solid var(--sand); }
.ds__hours span { position: absolute; right: 6px; transform: translateY(-50%); font-size: 0.6875rem; color: var(--mut); white-space: nowrap; }
.ds__hours span:first-child { transform: translateY(2px); }
.ds__hours span:last-child { transform: translateY(-100%); }
.ds__col { position: relative; height: calc(12 * var(--ph)); border-left: 1px solid #efe4cb; cursor: crosshair; touch-action: pan-y; background-image: repeating-linear-gradient(180deg, transparent 0, transparent calc(2 * var(--ph) - 1px), #efe4cb calc(2 * var(--ph) - 1px), #efe4cb calc(2 * var(--ph))); }
.ds__col:nth-child(2) { border-left: 0; }
.ds__empty { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 0.75rem; font-weight: 600; color: var(--mut); pointer-events: none; }

/* Blocks. Everything inside is centred, across and down. */
.ds__sh { position: absolute; left: 3px; right: 3px; margin-top: 1px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 2px 4px; border: 0; border-radius: 10px; overflow: hidden; font-family: inherit; text-align: center; color: var(--ink); cursor: pointer; z-index: 1; transition: filter 0.15s ease, transform 0.15s ease; }
.ds__sh:hover { filter: brightness(0.95); }
.ds__sh:active { transform: scale(0.98); }
.ds__who { display: flex; align-items: center; justify-content: center; gap: 6px; max-width: 100%; font-size: 0.8125rem; font-weight: 700; line-height: 1.15; }
.ds__nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline; }
.ds__time { font-size: 0.6875rem; opacity: 0.85; white-space: nowrap; display: none; }
.ds--week .ds__who { font-size: 0.6875rem; }
.ds__sh.is-xs .ds__nm { font-size: 0.6875rem; }
.ds--day .ds__nm, .ds--day .ds__time { display: inline; }
@container (min-width: 640px) {
  .ds--week .ds__nm { display: inline; }
  .ds--week .ds__time { display: inline; }
}
.ds__sh--me { background: var(--navy); color: #fff; }
.ds__sh--partner { background: var(--sand); color: var(--navy); box-shadow: inset 0 0 0 1px #cdbb94; }
.ds__sh--both { background: #f6d3bb; color: #7a3a17; box-shadow: inset 0 0 0 1px #e5b394; }
.ds__sh--other { background: #cfe3d4; color: #2f5d43; box-shadow: inset 0 0 0 1px #aecab7; }
.ds__prev { position: absolute; left: 3px; right: 3px; display: grid; place-items: center; padding: 2px; background: rgb(196 100 47 / 18%); border: 2px dashed var(--apr); border-radius: 10px; font-size: 0.6875rem; font-weight: 700; text-align: center; color: var(--apr); pointer-events: none; z-index: 2; }
.ds__now { position: absolute; left: 0; right: 0; height: 2px; background: var(--apr); z-index: 3; pointer-events: none; }
.ds__now::before { content: ""; position: absolute; left: -1px; top: -4px; width: 10px; height: 10px; border-radius: 50%; background: var(--apr); }

/* The night band: read only. */
.ds__night { border-top: 1.5px solid var(--sand); background: #e9edf7; }
.ds__nlab { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 8px 2px; background: #fdf9f0; font-size: 0.75rem; font-weight: 600; text-align: center; color: var(--ink); }
.ds__nlab small { font-size: 0.625rem; font-weight: 400; color: var(--mut); }
.ds__ncell { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 2px 4px; padding: 8px 2px; border-left: 1px solid #d7ddee; text-align: center; }
.ds--week .ds__pill { min-width: 24px; padding: 0 5px; }
.ds--week .ds__ncell { gap: 2px; padding: 8px 1px; }
.ds__then { font-size: 0.6875rem; color: var(--mut); }
.ds__pill { display: inline-grid; place-items: center; min-width: 26px; height: 26px; padding: 0 8px; border: 1.5px solid var(--navy); border-radius: 999px; font-size: 0.75rem; font-weight: 700; white-space: nowrap; color: var(--navy); }
.ds__pill--me { background: var(--navy); color: #fff; }
.ds__pill--partner { background: var(--sand); }
.ds__pill--both { background: #f6d3bb; border-color: #e5b394; color: #7a3a17; }
.ds__pill--other { background: #cfe3d4; border-color: #aecab7; color: #2f5d43; }
.ds__pill--open { background: transparent; border-style: dashed; border-color: #9aa3c4; color: var(--mut); font-weight: 600; }

.ds__legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0; padding: 0; list-style: none; font-size: 0.8125rem; color: var(--mut); }
.ds__legend li { display: inline-flex; align-items: center; gap: 6px; }
.ds__sw { width: 12px; height: 12px; border-radius: 4px; display: inline-block; }
.ds__sw--me { background: var(--navy); }
.ds__sw--partner { background: var(--sand); border: 1px solid #cdbb94; }
.ds__sw--both { background: #f6d3bb; border: 1px solid #e5b394; }
.ds__sw--other { background: #cfe3d4; border: 1px solid #aecab7; }
.ds__sw--night { background: #e9edf7; border: 1px solid #cfd6e6; }

/* The sheet */
.dss { position: fixed; inset: 0; z-index: 1100; display: flex; align-items: flex-end; justify-content: center; background: rgb(24 34 70 / 45%); }
.dss__sheet { width: 100%; max-width: 520px; max-height: 92vh; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; padding: 22px 24px 26px; background: #fdf9f0; border-radius: 28px 28px 0 0; box-shadow: 0 -10px 40px rgb(0 0 0 / 27%); color: #1f2a52; outline: none; }
@media (min-width: 640px) {
  .dss { align-items: center; }
  .dss__sheet { border-radius: 28px; border-bottom: 4px solid #e9d9b8; }
}
.dss__title { margin: 0; font-family: var(--nt-serif, inherit); font-size: 1.375rem; font-weight: 700; }
.dss__title span { margin-left: 10px; font-family: inherit; font-size: 0.875rem; font-weight: 400; color: #6b7392; }
.dss__sec { display: flex; flex-direction: column; gap: 10px; }
.dss__lab { margin: 0; font-size: 0.875rem; font-weight: 600; }
.dss__chips { display: flex; flex-wrap: wrap; gap: 8px; }
.dss__chip { padding: 8px 18px; background: transparent; border: 1.5px solid #243560; border-radius: 999px; font-family: inherit; font-size: 0.9375rem; font-weight: 600; color: #243560; cursor: pointer; transition: background-color 0.18s ease, color 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.4, 0.64, 1); }
.dss__chip--sm { padding: 6px 14px; font-size: 0.875rem; background: #fffdf8; border-color: #e9d9b8; }
.dss__chip:hover:not([aria-checked="true"], [aria-pressed="true"]) { background: #e9d9b8; }
.dss__chip:active, .dss__day:active { transform: scale(0.95); }
.dss__chip[aria-checked="true"], .dss__chip[aria-pressed="true"] { background: #243560; border-color: #243560; color: #fff; }
.dss__else { display: flex; flex-direction: column; gap: 10px; }
.dss__chip--add { border-style: dashed; border-color: #243560; background: transparent; }
.dss__custom { display: flex; gap: 8px; }
.dss__input { flex: 1; min-width: 0; height: 44px; padding: 0 14px; background: #fff; border: 1.5px solid #e9d9b8; border-radius: 14px; font-family: inherit; font-size: 0.9375rem; color: #1f2a52; }
.dss__input:focus-visible { outline: 3px solid #243560; outline-offset: 2px; }
.dss__addbtn { padding: 0 20px; background: #243560; border: 0; border-bottom: 3px solid #182246; border-radius: 14px; font-family: inherit; font-size: 0.9375rem; font-weight: 600; color: #fff; cursor: pointer; }
.dss__addbtn:disabled { background: #9aa3c4; border-bottom-color: #8089ad; cursor: not-allowed; }
.dss__times { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.dss__days { display: flex; gap: 6px; }
.dss__day { flex: 1; padding: 9px 0; background: #fffdf8; border: 1.5px solid #e9d9b8; border-radius: 12px; font-family: inherit; font-size: 0.8125rem; font-weight: 700; color: #6b7392; cursor: pointer; transition: background-color 0.18s ease, color 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.4, 0.64, 1); }
.dss__day[aria-pressed="true"] { background: #243560; border-color: #243560; color: #fff; }
.dss__chip:focus-visible, .dss__day:focus-visible, .dss__save:focus-visible, .dss__cancel:focus-visible, .dss__del:focus-visible { outline: 3px solid #243560; outline-offset: 2px; }
.dss__error { margin: 0; font-size: 0.875rem; font-weight: 600; color: #a8473f; }
.dss__foot { display: flex; align-items: center; gap: 10px; }
.dss__save { padding: 12px 26px; background: #243560; border: 0; border-bottom: 3px solid #182246; border-radius: 14px; font-family: inherit; font-size: 1rem; font-weight: 600; color: #fff; cursor: pointer; }
.dss__save:hover { background: #2d3f70; }
.dss__cancel { padding: 11px 22px; background: transparent; border: 1.5px solid #243560; border-radius: 14px; font-family: inherit; font-size: 1rem; font-weight: 600; color: #243560; cursor: pointer; }
.dss__del { margin-left: auto; padding: 0; background: none; border: 0; font-family: inherit; font-size: 0.875rem; font-weight: 600; color: #a8473f; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.ds-sheet-enter-active, .ds-sheet-leave-active { transition: opacity 0.22s ease; }
.ds-sheet-enter-active .dss__sheet, .ds-sheet-leave-active .dss__sheet { transition: transform 0.28s cubic-bezier(0.22, 0.61, 0.36, 1); }
.ds-sheet-enter-from, .ds-sheet-leave-to { opacity: 0; }
.ds-sheet-enter-from .dss__sheet, .ds-sheet-leave-to .dss__sheet { transform: translateY(40px); }
@media (prefers-reduced-motion: reduce) {
  .ds__sh, .ds__add, .ds__arr, .dss__chip, .dss__day { transition: none; }
  .ds-sheet-enter-active, .ds-sheet-leave-active, .ds-sheet-enter-active .dss__sheet, .ds-sheet-leave-active .dss__sheet { transition: none; }
}
</style>
