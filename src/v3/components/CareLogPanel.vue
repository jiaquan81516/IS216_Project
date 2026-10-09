<script setup>
import "@/v3/v3.css";
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import V3ChipGroup from "@/v3/components/V3ChipGroup.vue";
import V3Icon from "@/v3/components/V3Icon.vue";
import { dayLabel, ENTRY_TYPES, startOfDay, toDate, toTimeInput } from "@/v3/api/entryHelpers";

defineOptions({ name: "CareLogPanel" });

const props = defineProps({
  open: { type: Boolean, default: false },
  entry: { type: Object, default: null },
  initialType: { type: String, default: "feed" },
  saving: { type: Boolean, default: false },
  error: { type: String, default: "" },
});
const emit = defineEmits(["close", "save"]);

const TEXT_MAX = 280;
const MINUTE_CHOICES = [5, 10, 15, 20, 30];
const ML_CHOICES = [30, 60, 90, 120];
const titleId = `clp-title-${Math.random().toString(36).slice(2, 8)}`;

const dialog = ref(null);
let opener = null;

const typeOptions = Object.entries(ENTRY_TYPES).map(([value, t]) => ({ value, label: t.label }));
const methodOptions = [
  { value: "breast", label: "Breast" },
  { value: "bottle", label: "Bottle" },
  { value: "expressed", label: "Expressed" },
];
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
const title = computed(() => (isEditing.value ? `Edit ${typeLabel.value.toLowerCase()}` : "Log care"));
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
          <V3Icon name="x" :size="20" />
        </button>
      </header>

      <form class="clp__form" novalidate @submit.prevent="submit">
        <div class="clp__body">
          <div v-if="!isEditing" class="clp__group">
            <p class="clp__label">What are you logging?</p>
            <V3ChipGroup v-model="form.type" :options="typeOptions" label="Type of care" />
          </div>

          <template v-if="form.type === 'feed'">
            <div class="clp__group">
              <p class="clp__label">Method</p>
              <V3ChipGroup v-model="form.method" :options="methodOptions" label="Method" />
            </div>
            <template v-if="form.method === 'breast'">
              <div class="clp__group">
                <p class="clp__label">Side</p>
                <V3ChipGroup v-model="form.side" :options="sideOptions" label="Side" />
              </div>
              <div class="clp__group">
                <p class="clp__label">Duration</p>
                <V3ChipGroup v-model="form.minutes" :options="minuteOptions" label="Duration" />
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
              <V3ChipGroup v-model="form.ml" :options="mlOptions" label="Amount" />
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
              <V3ChipGroup v-model="form.day" :options="dayOptions" label="Day" />
            </div>
            <div class="clp__times">
              <label class="clp__field">
                <span class="clp__label">Started</span>
                <input v-model="form.sleepStart" class="form-control" type="time" />
              </label>
              <label v-if="!form.stillSleeping" class="clp__field">
                <span class="clp__label">Ended</span>
                <input v-model="form.sleepEnd" class="form-control" type="time" />
              </label>
            </div>
            <div>
              <button
                type="button"
                class="v3-chip"
                :aria-pressed="form.stillSleeping ? 'true' : 'false'"
                @click="form.stillSleeping = !form.stillSleeping"
              >
                Still sleeping
              </button>
            </div>
          </template>

          <div v-else-if="form.type === 'nappy'" class="clp__group">
            <p class="clp__label">Type</p>
            <V3ChipGroup v-model="form.nappyType" :options="nappyOptions" label="Diaper type" />
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
            <div class="clp__when">
              <p class="clp__label">
                When: <span class="clp__when-value">{{ form.whenMode === "now" ? "Now" : "Set below" }}</span>
              </p>
              <button
                type="button"
                class="clp__link"
                :aria-expanded="form.whenMode === 'custom' ? 'true' : 'false'"
                @click="
                  form.whenMode = form.whenMode === 'now' ? 'custom' : 'now';
                  if (form.whenMode === 'custom' && !form.time) form.time = toTimeInput(new Date());
                "
              >
                {{ form.whenMode === "now" ? "Change time" : "Use now" }}
              </button>
            </div>
            <template v-if="form.whenMode === 'custom'">
              <V3ChipGroup v-model="form.day" :options="dayOptions" label="Day" />
              <label class="clp__field">
                <span class="clp__label">Time</span>
                <input v-model="form.time" class="form-control" type="time" />
              </label>
            </template>
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
  background: rgb(31 41 55 / 35%);
}
.clp__panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  width: 420px;
  max-width: 100%;
  background: var(--nt-bg);
  border-left: 1px solid var(--nt-line);
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
.clp__label {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.4;
  color: var(--nt-ink);
}
.clp__when {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.clp__when-value {
  font-weight: 400;
  color: var(--nt-muted);
}
.clp__link {
  padding: 4px 0;
  background: none;
  border: 0;
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--nt-plum);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.clp__link:hover {
  color: var(--nt-plum-hover);
}
.clp__link:focus-visible {
  outline: 2px solid var(--nt-plum);
  outline-offset: 2px;
  border-radius: 4px;
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
    width: 100%;
    border-left: 0;
  }
  .clp__head,
  .clp__body,
  .clp__foot {
    padding-left: 16px;
    padding-right: 16px;
  }
}
</style>
