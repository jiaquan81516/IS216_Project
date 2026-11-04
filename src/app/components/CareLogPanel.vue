<script setup>
import "@/app/app.css";
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import ChipGroup from "@/app/components/ChipGroup.vue";
import Collapse from "@/app/components/Collapse.vue";
import TimeWheel from "@/app/components/TimeWheel.vue";
import Icon from "@/app/components/Icon.vue";
import { dayLabel, ENTRY_TYPES, startOfDay, toDate, toTimeInput } from "@/app/utils/entryHelpers";

defineOptions({ name: "CareLogPanel" });

const props = defineProps({
  open: { type: Boolean, default: false },
  entry: { type: Object, default: null },
  initialType: { type: String, default: "feed" },
  saving: { type: Boolean, default: false },
  error: { type: String, default: "" },
  allowedTypes: { type: Array, default: null },
  lockType: { type: Boolean, default: false },
  caregiver: { type: Boolean, default: false },
});
const emit = defineEmits(["close", "save"]);

const TEXT_MAX = 280;
const MINUTE_CHOICES = [5, 10, 15, 20, 30];
const ML_CHOICES = [30, 60, 90, 120];
const titleId = `clp-title-${Math.random().toString(36).slice(2, 8)}`;

const dialog = ref(null);
let opener = null;

const typeOptions = computed(() => Object.entries(ENTRY_TYPES)
  .filter(([value]) => !props.allowedTypes || props.allowedTypes.includes(value))
  .map(([value, t]) => ({ value, label: t.label })));
const methodOptions = computed(() => [
  { value: "breast", label: "Breast" },
  { value: "bottle", label: "Bottle" },
  { value: "expressed", label: props.caregiver ? "Expressed milk" : "Expressed" },
].filter((option) => !props.caregiver || option.value !== "breast"));
const sideOptions = [
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "both", label: "Both" },
];
const minuteOptions = [...MINUTE_CHOICES.map((m) => ({ value: m, label: `${m} min` })), { value: "other", label: "Other" }];
const mlOptions = [...ML_CHOICES.map((m) => ({ value: m, label: `${m} ml` })), { value: "other", label: "Other" }];
const nappyOptions = [
  { value: "wet", label: "Wet" },
  { value: "dirty", label: "Dirty" },
  { value: "both", label: "Both" },
];

function blank() {
  return {
    type: "feed",
    method: null,
    side: null,
    minutes: null,
    minutesOther: "",
    ml: null,
    mlOther: "",
    nappyType: null,
    drug: "",
    dose: "",
    text: "",
    whenMode: "now",
    day: "today", // today | yesterday | keep
    keepDate: null,
    time: "",
    sleepStart: "",
    sleepEnd: "",
    stillSleeping: false,
  };
}
const form = reactive(blank());
const clock = ref(new Date());

function dayChoiceFor(date, now) {
  const diff = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  return "keep";
}

function init() {
  const now = new Date();
  clock.value = now;
  Object.assign(form, blank());
  const e = props.entry;
  if (!e) {
    form.type = ENTRY_TYPES[props.initialType] ? props.initialType : "feed";
    form.sleepEnd = toTimeInput(now);
    form.sleepStart = toTimeInput(new Date(now.getTime() - 3600000));
    return;
  }
  const d = e.details ?? {};
  const at = toDate(e.at) ?? now;
  const end = toDate(e.endedAt);
  form.type = e.type;
  form.method = d.method ?? null;
  form.side = d.side ?? null;
  if (d.minutes != null) {
    if (MINUTE_CHOICES.includes(d.minutes)) form.minutes = d.minutes;
    else {
      form.minutes = "other";
      form.minutesOther = String(d.minutes);
    }
  }
  if (d.ml != null) {
    if (ML_CHOICES.includes(d.ml)) form.ml = d.ml;
    else {
      form.ml = "other";
      form.mlOther = String(d.ml);
    }
  }
  form.nappyType = d.nappyType ?? null;
  form.drug = d.drug ?? "";
  form.dose = d.dose ?? "";
  form.text = d.text ?? "";
  form.whenMode = "custom";
  const base = e.type === "sleep" && end ? end : at;
  form.day = dayChoiceFor(base, now);
  form.keepDate = startOfDay(base);
  form.time = toTimeInput(at);
  if (e.type === "sleep") {
    form.sleepStart = toTimeInput(at);
    form.sleepEnd = end ? toTimeInput(end) : toTimeInput(now);
    form.stillSleeping = !end;
    form.time = toTimeInput(end ?? at);
  }
}

const isEditing = computed(() => Boolean(props.entry));
const typeLabel = computed(() => ENTRY_TYPES[form.type]?.label ?? "");
const title = computed(() => {
  if (isEditing.value) return `Edit ${typeLabel.value.toLowerCase()}`;
  return props.lockType ? `Log ${typeLabel.value.toLowerCase()}` : "Log care";
});
const saveLabel = computed(() => (props.saving ? "Saving..." : isEditing.value ? "Save changes" : "Save"));

const dayOptions = computed(() => {
  const options = [
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
  ];
  if (form.day === "keep" && form.keepDate) options.push({ value: "keep", label: dayLabel(form.keepDate, clock.value) });
  return options;
});

function dayDate() {
  const base = startOfDay(clock.value);
  if (form.day === "yesterday") base.setDate(base.getDate() - 1);
  else if (form.day === "keep" && form.keepDate) return new Date(form.keepDate);
  return base;
}
function combine(day, hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  const date = new Date(day);
  date.setHours(h, m, 0, 0);
  return date;
}
const validTime = (value) => /^\d{2}:\d{2}$/.test(value ?? "");

// Works out the start and end for the current form. Returns { at, endedAt, problem }.
function resolveTimes(now = new Date()) {
  if (form.type === "sleep") {
    const day = dayDate();
    if (!validTime(form.sleepStart) || (!form.stillSleeping && !validTime(form.sleepEnd))) {
      return { at: null, endedAt: null, problem: "missing" };
    }
    if (form.stillSleeping) {
      const at = combine(day, form.sleepStart);
      return { at, endedAt: null, problem: at > now ? "future" : "" };
    }
    const endedAt = combine(day, form.sleepEnd);
    const at = combine(day, form.sleepStart);
    if (at > endedAt) at.setDate(at.getDate() - 1);
    if (at.getTime() === endedAt.getTime()) return { at, endedAt, problem: "order" };
    return { at, endedAt, problem: endedAt > now ? "future" : "" };
  }
  if (form.whenMode === "now") return { at: now, endedAt: null, problem: "" };
  if (!validTime(form.time)) return { at: null, endedAt: null, problem: "missing" };
  const at = combine(dayDate(), form.time);
  return { at, endedAt: null, problem: at > now ? "future" : "" };
}

const timeError = computed(() => {
  const { problem } = resolveTimes(new Date());
  if (problem === "future") return "Pick a time that has already passed.";
  if (problem === "order") return "The end time must be after the start time.";
  return "";
});

function numberOrNull(raw, max) {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : null;
}
const minutesValue = computed(() => (form.minutes === "other" ? numberOrNull(form.minutesOther, 240) : form.minutes));
const mlValue = computed(() => (form.ml === "other" ? numberOrNull(form.mlOther, 500) : form.ml));

// Plain-language reason Save is not available yet. Empty when everything needed is set.
const missing = computed(() => {
  switch (form.type) {
    case "feed":
      if (!form.method) return "Choose how the feed was given.";
      if (props.caregiver && form.method === "breast") return "Choose bottled or expressed milk.";
      if (form.method === "breast") {
        if (!form.side) return "Choose a side.";
        if (!minutesValue.value) return "Choose how long, or enter the minutes.";
      } else if (!mlValue.value) {
        return "Choose an amount, or enter the millilitres.";
      }
      return "";
    case "nappy":
      return form.nappyType ? "" : "Choose the diaper type.";
    case "note":
      return form.text.trim() ? "" : "Write the note.";
    case "medication":
      return form.drug.trim() && form.dose.trim() ? "" : "Add the name and the dose.";
    default:
      return "";
  }
});

const canSave = computed(() => !props.saving && !timeError.value && !missing.value && resolveTimes().problem !== "missing");

function buildDetails() {
  const text = form.text.trim();
  if (form.type === "feed") {
    const details = { method: form.method };
    if (form.method === "breast") {
      details.side = form.side;
      details.minutes = minutesValue.value;
    } else {
      details.ml = mlValue.value;
    }
    if (text) details.text = text;
    return details;
  }
  if (form.type === "nappy") return { nappyType: form.nappyType, ...(text ? { text } : {}) };
  if (form.type === "medication") return { drug: form.drug.trim(), dose: form.dose.trim(), ...(text ? { text } : {}) };
  if (form.type === "note") return { text };
  return text ? { text } : {};
}

function submit() {
  if (!canSave.value) return;
  const { at, endedAt } = resolveTimes(new Date());
  emit("save", { type: form.type, at, endedAt, details: buildDetails() });
}

function focusables() {
  if (!dialog.value) return [];
  return [...dialog.value.querySelectorAll("button:not([disabled]), input:not([disabled]), textarea:not([disabled])")];
}
function onKeydown(event) {
  if (event.key === "Escape") {
    event.stopPropagation();
    emit("close");
    return;
  }
  if (event.key !== "Tab") return;
  const items = focusables();
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

watch(
  () => props.open,
  async (open, wasOpen) => {
    if (open) {
      opener = document.activeElement;
      init();
      await nextTick();
      const target = dialog.value?.querySelector('[role="radio"]') ?? dialog.value?.querySelector("button, input, textarea");
      target?.focus();
    } else if (wasOpen) {
      if (opener && document.contains(opener)) opener.focus();
      opener = null;
    }
  },
  { immediate: true },
);
watch(() => [props.entry, props.initialType], () => {
  if (props.open) init();
});
onBeforeUnmount(() => {
  opener = null;
});
</script>

<template>
  <Transition name="drawer" :duration="{ enter: 320, leave: 240 }">
  <div v-if="open" class="clp">
    <div class="clp__backdrop" aria-hidden="true" @click="emit('close')" />
    <section
      ref="dialog"
      class="clp__panel"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      @keydown="onKeydown"
    >
      <header class="clp__head">
        <h2 :id="titleId" class="clp__title">{{ title }}</h2>
        <button type="button" class="clp__close" aria-label="Close" @click="emit('close')">
          <Icon name="x" :size="20" />
        </button>
      </header>

      <form class="clp__form" novalidate @submit.prevent="submit">
        <div class="clp__body">
          <div v-if="!isEditing && !lockType" class="clp__group">
            <p class="clp__label">What are you logging?</p>
            <ChipGroup v-model="form.type" :options="typeOptions" label="Type of care" />
          </div>

          <template v-if="form.type === 'feed'">
            <div class="clp__group">
              <p class="clp__label">Method</p>
              <ChipGroup v-model="form.method" :options="methodOptions" label="Method" />
            </div>
            <template v-if="form.method === 'breast'">
              <div class="clp__group">
                <p class="clp__label">Side</p>
                <ChipGroup v-model="form.side" :options="sideOptions" label="Side" />
              </div>
              <div class="clp__group">
                <p class="clp__label">Duration</p>
                <ChipGroup v-model="form.minutes" :options="minuteOptions" label="Duration" />
                <input
                  v-if="form.minutes === 'other'"
                  v-model="form.minutesOther"
                  class="form-control clp__input"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  max="240"
                  aria-label="Minutes"
                  placeholder="Minutes"
                />
              </div>
            </template>
            <div v-else-if="form.method" class="clp__group">
              <p class="clp__label">Amount</p>
              <ChipGroup v-model="form.ml" :options="mlOptions" label="Amount" />
              <input
                v-if="form.ml === 'other'"
                v-model="form.mlOther"
                class="form-control clp__input"
                type="number"
                inputmode="numeric"
                min="1"
                max="500"
                aria-label="Millilitres"
                placeholder="Millilitres"
              />
            </div>
          </template>

          <template v-else-if="form.type === 'sleep'">
            <div class="clp__group">
              <p class="clp__label">Day</p>
              <ChipGroup v-model="form.day" :options="dayOptions" label="Day" />
            </div>
            <div class="clp__times">
              <div class="clp__field">
                <span class="clp__label">Started</span>
                <TimeWheel v-model="form.sleepStart" label="Sleep started" />
              </div>
              <div v-if="!form.stillSleeping" class="clp__field">
                <span class="clp__label">Ended</span>
                <TimeWheel v-model="form.sleepEnd" label="Sleep ended" />
              </div>
            </div>
            <div>
              <button
                type="button"
                class="app-chip"
                :aria-pressed="form.stillSleeping ? 'true' : 'false'"
                @click="form.stillSleeping = !form.stillSleeping"
              >
                Still sleeping
              </button>
            </div>
          </template>

          <div v-else-if="form.type === 'nappy'" class="clp__group">
            <p class="clp__label">Type</p>
            <ChipGroup v-model="form.nappyType" :options="nappyOptions" label="Diaper type" />
          </div>

          <div v-else-if="form.type === 'note'" class="clp__group">
            <label class="clp__label" for="clp-note">Note</label>
            <textarea
              id="clp-note"
              v-model="form.text"
              class="form-control"
              rows="4"
              :maxlength="TEXT_MAX"
            />
            <p class="clp__count">{{ form.text.length }}/{{ TEXT_MAX }}</p>
          </div>

          <div v-else-if="form.type === 'medication'" class="clp__times">
            <label class="clp__field">
              <span class="clp__label">Name</span>
              <input v-model="form.drug" class="form-control" type="text" maxlength="60" autocomplete="off" />
            </label>
            <label class="clp__field">
              <span class="clp__label">Dose</span>
              <input v-model="form.dose" class="form-control" type="text" maxlength="40" autocomplete="off" />
            </label>
          </div>

          <div v-if="form.type !== 'sleep'" class="clp__group">
            <p id="clp-when-label" class="clp__label">When</p>
            <div class="clp__seg" :class="{ 'clp__seg--later': form.whenMode === 'custom' }" role="radiogroup" aria-labelledby="clp-when-label">
              <span class="clp__seg-thumb" aria-hidden="true"></span>
              <button type="button" role="radio" class="clp__seg-btn" :aria-checked="form.whenMode === 'now' ? 'true' : 'false'" @click="form.whenMode = 'now'">
                Just now
              </button>
              <button
                type="button"
                role="radio"
                class="clp__seg-btn"
                :aria-checked="form.whenMode === 'custom' ? 'true' : 'false'"
                @click="
                  form.whenMode = 'custom';
                  if (!form.time) form.time = toTimeInput(new Date());
                "
              >
                Pick a time
              </button>
            </div>
            <Collapse>
              <div v-if="form.whenMode === 'custom'" class="clp__custom">
                <ChipGroup v-model="form.day" :options="dayOptions" label="Day" />
                <div class="clp__field">
                  <span class="clp__label">Time</span>
                  <TimeWheel v-model="form.time" label="Time" />
                </div>
              </div>
            </Collapse>
          </div>

          <p v-if="timeError" class="clp__alert" role="alert">{{ timeError }}</p>

          <div v-if="form.type !== 'note'" class="clp__group">
            <label class="clp__label" for="clp-extra">Add a note (optional)</label>
            <textarea id="clp-extra" v-model="form.text" class="form-control" rows="1" :maxlength="TEXT_MAX" />
          </div>

          <p v-if="missing" class="clp__hint">{{ missing }}</p>
          <p v-if="error" class="clp__alert" role="alert">{{ error }}</p>
        </div>

        <footer class="clp__foot">
          <button type="submit" class="btn btn-primary" :disabled="!canSave">{{ saveLabel }}</button>
          <button type="button" class="btn btn-outline" :disabled="saving" @click="emit('close')">Cancel</button>
        </footer>
      </form>
    </section>
  </div>
  </Transition>
</template>

<style scoped>
.clp {
  position: fixed;
  inset: 0;
  z-index: 1050;
}
.clp__backdrop {
  position: absolute;
  inset: 0;
  background: rgb(24 34 70 / 45%);
}
.clp__panel {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  width: min(520px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  background: var(--nt-bg);
  border: 0;
  border-radius: 24px;
  box-shadow: 0 24px 60px rgb(24 34 70 / 35%);
  overflow: hidden;
  color: var(--nt-ink);
}
.clp__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
  border-bottom: 1px solid var(--nt-line);
}
.clp__title {
  margin: 0;
  font-family: var(--nt-serif);
  font-size: 1.5rem;
  font-weight: 400;
  line-height: 1.3;
  letter-spacing: -0.01em;
}
.clp__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: transparent;
  border: 0;
  border-radius: 8px;
  color: var(--nt-muted);
  cursor: pointer;
}
.clp__close:hover {
  background: var(--nt-gray);
  color: var(--nt-ink);
}
.clp__close:focus-visible {
  outline: 2px solid var(--nt-plum);
  outline-offset: 2px;
}
.clp__form {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}
.clp__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
  padding: 24px;
  overflow-y: auto;
}
.clp__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.clp__panel {
  --navy: #243560;
  --sand: #e9d9b8;
}
.clp__seg {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 4px;
  background: #fffdf8;
  border: 1.5px solid var(--sand);
  border-radius: 999px;
}
.clp__seg-thumb {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 4px;
  width: calc(50% - 4px);
  background: var(--navy);
  border-radius: 999px;
  transition: transform 280ms cubic-bezier(0.34, 1.25, 0.64, 1);
}
.clp__seg--later .clp__seg-thumb {
  transform: translateX(100%);
}
.clp__seg-btn {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  background: transparent;
  border: 0;
  border-radius: 999px;
  font-family: inherit;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--navy);
  cursor: pointer;
  transition: color 200ms ease;
}
.clp__seg-btn[aria-checked="true"] {
  color: #fff;
}
.clp__seg-btn:not([aria-checked="true"]):hover {
  color: #5b6692;
}
.clp__seg-btn:focus-visible {
  outline: 3px solid var(--navy);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .clp__seg-thumb,
  .clp__seg-btn {
    transition: none;
  }
}
.clp__custom {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 4px;
}
/* The accents follow the care log: navy when chosen, sand when touched, and they ease between. */
.clp__panel :deep(.app-chip) {
  padding: 8px 16px;
  border-color: var(--sand);
  color: var(--navy);
  font-weight: 600;
  transition: background-color 180ms ease, color 180ms ease, border-color 180ms ease, transform 160ms ease;
}
.clp__panel :deep(.app-chip:hover) {
  background: var(--sand);
}
.clp__panel :deep(.app-chip:active) {
  transform: scale(0.97);
}
.clp__panel :deep(.app-chip[aria-checked="true"]) {
  background: var(--navy);
  border-color: var(--navy);
  color: #fff;
}
.clp__panel :deep(.app-chip:focus-visible) {
  outline-color: var(--navy);
}
.clp__foot .btn-primary {
  background: var(--navy);
  border-color: var(--navy);
  border-radius: 999px;
  transition: background-color 180ms ease, border-color 180ms ease, opacity 180ms ease, transform 160ms ease;
}
.clp__foot .btn-primary:not(:disabled):hover {
  background: #2d3f70;
  border-color: #2d3f70;
}
.clp__foot .btn-primary:not(:disabled):active {
  transform: scale(0.98);
}
.clp__foot .btn-primary:disabled {
  opacity: 0.45;
}
.clp__foot .btn:not(.btn-primary) {
  border-radius: 999px;
  border-color: var(--navy);
  color: var(--navy);
  transition: background-color 180ms ease;
}
.clp__foot .btn:not(.btn-primary):hover {
  background: var(--sand);
}
.clp__label {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.4;
  color: var(--nt-ink);
}
.clp__times {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.clp__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.clp__input {
  max-width: 160px;
}
.clp__count {
  margin: 0;
  font-size: 0.875rem;
  text-align: right;
  color: var(--nt-muted);
}
.clp__hint {
  margin: 0;
  font-size: 0.875rem;
  color: var(--nt-muted);
}
.clp__alert {
  margin: 0;
  font-size: 0.875rem;
  color: var(--nt-coral);
}
.clp__foot {
  display: flex;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid var(--nt-line);
}
.clp__foot .btn-primary {
  flex: 1;
}

@media (max-width: 575px) {
  .clp__panel {
    top: auto;
    left: 0;
    bottom: 0;
    transform: none;
    width: 100%;
    max-height: 92vh;
    border-radius: 24px 24px 0 0;
  }
  .clp__head,
  .clp__body,
  .clp__foot {
    padding-left: 16px;
    padding-right: 16px;
  }
}
/* The dialog and its backdrop fade in and out; nothing slides. */
.drawer-enter-active .clp__panel,
.drawer-enter-active .clp__backdrop { transition: opacity 220ms ease; }
.drawer-leave-active .clp__panel,
.drawer-leave-active .clp__backdrop { transition: opacity 180ms ease; }
.drawer-enter-from .clp__panel,
.drawer-leave-to .clp__panel,
.drawer-enter-from .clp__backdrop,
.drawer-leave-to .clp__backdrop { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .drawer-enter-active .clp__panel,
  .drawer-leave-active .clp__panel,
  .drawer-enter-active .clp__backdrop,
  .drawer-leave-active .clp__backdrop { transition: none; }
}
</style>
