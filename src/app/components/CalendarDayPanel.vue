<script setup>
import "@/app/app.css";
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import ChipGroup from "@/app/components/ChipGroup.vue";
import Icon from "@/app/components/Icon.vue";
import {
  dateRangeLabel,
  dayHeading,
  EVENT_TYPES,
  eventTimeLabel,
  NOTES_MAX,
  validateEvent,
} from "@/app/api/calendarHelpers";
import { ownerKey, ownerLabel } from "@/app/api/sharedHelpers";

defineOptions({ name: "CalendarDayPanel" });

const props = defineProps({
  open: { type: Boolean, default: false },
  date: { type: String, default: "" }, // ISO day shown in the panel
  events: { type: Array, default: () => [] }, // events on that day, already sorted
  night: { type: Object, default: null }, // { who, shared, second } from nightOwner
  names: { type: Object, default: () => ({ me: "Me", partner: "Your partner" }) },
  meUid: { type: String, default: "" }, // the signed in uid, so an owner uid gets a name
  adding: { type: Boolean, default: false }, // open straight into the add form
});
const emit = defineEmits(["close", "save", "delete"]);

const titleId = `cdp-title-${Math.random().toString(36).slice(2, 8)}`;
const dialog = ref(null);
const titleInput = ref(null);
const closeButton = ref(null);
let opener = null;

const formOpen = ref(false);
const editId = ref("");
const confirmingId = ref("");
const error = ref("");
const form = reactive({
  title: "",
  date: "",
  endDate: "",
  allDay: true,
  start: "09:00",
  end: "10:00",
  owner: "both",
  type: "family",
  notes: "",
});

const ownerOptions = computed(() => [
  { value: "me", label: "Me" },
  { value: "partner", label: props.names.partner },
  { value: "both", label: "Both" },
]);
const typeOptions = EVENT_TYPES.map((t) => ({ value: t.value, label: t.label }));
// An owner is a uid or "both" in Firestore, and a chip key inside the form.
const ownerName = (owner) => ownerLabel(owner, props.meUid, props.names.me, props.names.partner);
const ownerTone = (owner) => ownerKey(owner, props.meUid) ?? "both";
const typeLabel = (type) => EVENT_TYPES.find((t) => t.value === type)?.label ?? "";

const heading = computed(() => (props.date ? dayHeading(props.date) : ""));
const nightLine = computed(() => {
  const n = props.night;
  if (!n) return "";
  const nameOf = (who) => props.names[who] ?? "";
  if (n.who === "open") return "Night duty: open";
  if (n.shared) return `Night duty: ${nameOf(n.who)} first half, ${nameOf(n.second)} second half`;
  return `Night duty: ${nameOf(n.who)}`;
});

async function startForm(event = null) {
  confirmingId.value = "";
  error.value = "";
  editId.value = event?.id ?? "";
  form.title = event?.title ?? "";
  form.date = event?.date ?? props.date;
  form.endDate = event?.endDate ?? props.date;
  form.allDay = event ? event.allDay : true;
  form.start = event?.start ?? "09:00";
  form.end = event?.end ?? "10:00";
  form.owner = event ? (ownerKey(event.owner, props.meUid) ?? "both") : "both";
  form.type = event?.type ?? "family";
  form.notes = event?.notes ?? "";
  formOpen.value = true;
  await nextTick();
  titleInput.value?.focus();
}
function cancelForm() {
  formOpen.value = false;
  editId.value = "";
  error.value = "";
}
function onAllDay() {
  if (!form.allDay && !form.start) form.start = "09:00";
}
function submit() {
  const draft = { ...form, title: form.title.trim() };
  const problem = validateEvent(draft);
  if (problem) {
    error.value = problem;
    return;
  }
  const payload = {
    id: editId.value || undefined,
    title: draft.title,
    date: draft.date,
    endDate: draft.endDate || draft.date,
    allDay: draft.allDay,
    start: draft.allDay ? null : draft.start,
    end: draft.allDay ? null : draft.end || null,
    owner: draft.owner,
    type: draft.type,
    notes: draft.notes.trim(),
  };
  emit("save", payload);
  cancelForm();
}
function confirmDelete(event) {
  emit("delete", event.id);
  confirmingId.value = "";
  if (editId.value === event.id) cancelForm();
}

function focusables() {
  if (!dialog.value) return [];
  return [
    ...dialog.value.querySelectorAll(
      "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href]",
    ),
  ];
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
      formOpen.value = false;
      editId.value = "";
      confirmingId.value = "";
      error.value = "";
      if (props.adding) await startForm();
      else {
        await nextTick();
        closeButton.value?.focus();
      }
    } else if (wasOpen) {
      if (opener && document.contains(opener)) opener.focus();
      opener = null;
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  opener = null;
});
</script>

<template>
  <div v-if="open" class="cdp">
    <div class="cdp__backdrop" aria-hidden="true" @click="emit('close')" />
    <section ref="dialog" class="cdp__panel" role="dialog" aria-modal="true" :aria-labelledby="titleId" @keydown="onKeydown">
      <header class="cdp__head">
        <h2 :id="titleId" class="cdp__title">{{ heading }}</h2>
        <button ref="closeButton" type="button" class="cdp__close" aria-label="Close" @click="emit('close')">
          <Icon name="x" :size="20" />
        </button>
      </header>

      <div class="cdp__body">
        <p v-if="nightLine" class="cdp__night">
          <Icon name="moon" :size="16" />
          <span>{{ nightLine }}</span>
        </p>

        <section aria-labelledby="cdp-events">
          <h3 id="cdp-events" class="cdp__sub">Events</h3>
          <p v-if="!events.length" class="cdp__muted">Nothing planned for this day.</p>
          <ul v-else class="cdp__list">
            <li v-for="event in events" :key="event.id" class="cdp__item" :data-event="event.id">
              <div class="cdp__item-main">
                <p class="cdp__time">{{ eventTimeLabel(event) }}</p>
                <p class="cdp__name">{{ event.title }}</p>
                <p class="cdp__meta">
                  <span class="cdp__owner" :data-owner="ownerTone(event.owner)">{{ ownerName(event.owner) }}</span>
                  <span>{{ typeLabel(event.type) }}</span>
                  <span v-if="event.endDate !== event.date">{{ dateRangeLabel(event.date, event.endDate) }}</span>
                </p>
                <p v-if="event.notes" class="cdp__notes">{{ event.notes }}</p>
              </div>
              <div v-if="confirmingId === event.id" class="cdp__confirm" role="group" :aria-label="`Delete ${event.title}`">
                <span class="cdp__confirm-text">Delete this event?</span>
                <button type="button" class="btn btn-outline btn-sm" @click="confirmDelete(event)">Delete</button>
                <button type="button" class="btn btn-outline btn-sm" @click="confirmingId = ''">Cancel</button>
              </div>
              <div v-else class="cdp__actions">
                <button type="button" class="cdp__icon" :aria-label="`Edit ${event.title}`" @click="startForm(event)">
                  <Icon name="edit" :size="18" />
                </button>
                <button
                  type="button"
                  class="cdp__icon cdp__icon--delete"
                  :aria-label="`Delete ${event.title}`"
                  @click="confirmingId = event.id"
                >
                  <Icon name="trash" :size="18" />
                </button>
              </div>
            </li>
          </ul>
        </section>

        <button v-if="!formOpen" type="button" class="btn btn-outline btn-sm cdp__add" @click="startForm()">
          <Icon name="plus" :size="16" />
          <span>Add an event</span>
        </button>

        <form v-else class="cdp__form" novalidate aria-labelledby="cdp-form-title" @submit.prevent="submit">
          <h3 id="cdp-form-title" class="cdp__sub">{{ editId ? "Edit event" : "Add an event" }}</h3>

          <label class="cdp__field">
            <span class="cdp__label">Title</span>
            <input
              ref="titleInput"
              v-model="form.title"
              class="app-control"
              type="text"
              maxlength="80"
              autocomplete="off"
            />
          </label>

          <div class="form-check form-switch cdp__switch">
            <input id="cdp-allday" v-model="form.allDay" class="form-check-input" type="checkbox" role="switch" @change="onAllDay" />
            <label class="form-check-label" for="cdp-allday">All day</label>
          </div>

          <div class="cdp__row">
            <label class="cdp__field">
              <span class="cdp__label">Start date</span>
              <input v-model="form.date" class="app-control" type="date" />
            </label>
            <label class="cdp__field">
              <span class="cdp__label">End date</span>
              <input v-model="form.endDate" class="app-control" type="date" :min="form.date || undefined" />
            </label>
          </div>

          <div v-if="!form.allDay" class="cdp__row">
            <label class="cdp__field">
              <span class="cdp__label">Start time</span>
              <input v-model="form.start" class="app-control" type="time" />
            </label>
            <label class="cdp__field">
              <span class="cdp__label">End time</span>
              <input v-model="form.end" class="app-control" type="time" />
            </label>
          </div>

          <div class="cdp__field">
            <span class="cdp__label">Who is it for</span>
            <ChipGroup v-model="form.owner" :options="ownerOptions" label="Who is it for" />
          </div>
          <div class="cdp__field">
            <span class="cdp__label">Type</span>
            <ChipGroup v-model="form.type" :options="typeOptions" label="Type" />
          </div>

          <div class="cdp__field">
            <label class="cdp__label" for="cdp-notes">Notes (optional)</label>
            <textarea id="cdp-notes" v-model="form.notes" class="app-control" rows="2" :maxlength="NOTES_MAX" />
            <p class="cdp__count">{{ form.notes.length }}/{{ NOTES_MAX }}</p>
          </div>

          <p v-if="error" class="app-error-text" role="alert">{{ error }}</p>

          <div class="cdp__form-actions">
            <button type="submit" class="btn btn-primary btn-sm">Save event</button>
            <button type="button" class="btn btn-outline btn-sm" @click="cancelForm">Cancel</button>
          </div>
        </form>
      </div>
    </section>
  </div>
</template>

<style scoped>
.cdp { position: fixed; inset: 0; z-index: 1050; }
.cdp__backdrop { position: absolute; inset: 0; background: rgb(31 41 55 / 35%); }
.cdp__panel { position: absolute; top: 0; right: 0; bottom: 0; display: flex; flex-direction: column; width: 380px; max-width: 100%; background: var(--nt-bg); border-left: 1px solid var(--nt-line); color: var(--nt-ink); }
.cdp__head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 24px; border-bottom: 1px solid var(--nt-line); }
.cdp__title { margin: 0; font-family: var(--nt-serif); font-size: 1.5rem; font-weight: 400; line-height: 1.3; letter-spacing: -0.01em; }
.cdp__close { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; background: transparent; border: 0; border-radius: 8px; color: var(--nt-muted); cursor: pointer; transition: background-color 0.15s, color 0.15s; }
.cdp__close:hover { background: var(--nt-gray); color: var(--nt-ink); }
.cdp__close:focus-visible, .cdp__icon:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.cdp__body { display: flex; flex: 1; flex-direction: column; align-items: flex-start; gap: 20px; min-height: 0; padding: 20px 24px 24px; overflow-y: auto; }
.cdp__body > * { width: 100%; }
.cdp__night { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 0.875rem; color: var(--nt-ink); }
.cdp__sub { margin: 0 0 8px; font-family: inherit; font-size: 0.9375rem; font-weight: 600; color: var(--nt-ink); }
.cdp__muted { margin: 0; font-size: 0.875rem; color: var(--nt-muted); }
.cdp__list { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--nt-line); }
.cdp__item { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 8px; padding: 12px 0; border-bottom: 1px solid var(--nt-line); }
.cdp__item-main { flex: 1 1 200px; min-width: 0; }
.cdp__time { margin: 0; font-size: 0.875rem; color: var(--nt-muted); }
.cdp__name { margin: 2px 0 0; font-size: 1rem; font-weight: 600; overflow-wrap: anywhere; }
.cdp__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; margin: 6px 0 0; font-size: 0.875rem; color: var(--nt-muted); }
.cdp__owner { padding: 1px 8px; border-radius: 6px; color: var(--nt-ink); background: var(--nt-gray); border: 1px solid var(--nt-line); }
.cdp__owner[data-owner="me"] { background: var(--nt-apricot); border-color: var(--nt-apricot); }
.cdp__owner[data-owner="partner"] { background: var(--nt-powder); border-color: var(--nt-powder); }
.cdp__owner[data-owner="both"] { border-left: 1px solid var(--nt-plum); }
.cdp__notes { margin: 6px 0 0; font-size: 0.875rem; color: var(--nt-ink); overflow-wrap: anywhere; }
.cdp__actions { display: flex; align-items: center; gap: 2px; }
.cdp__icon { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; padding: 0; background: transparent; border: 0; border-radius: 8px; color: var(--nt-muted); cursor: pointer; transition: background-color 0.15s, color 0.15s; }
.cdp__icon:hover { background: var(--nt-gray); color: var(--nt-ink); }
.cdp__icon--delete:hover { color: var(--nt-coral); }
.cdp__confirm { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.cdp__confirm-text { font-size: 0.875rem; }
.cdp__add { display: inline-flex; align-items: center; gap: 8px; width: auto; align-self: flex-start; }
.cdp__form { display: flex; flex-direction: column; gap: 16px; padding-top: 16px; border-top: 1px solid var(--nt-line); }
.cdp__form .cdp__sub { margin: 0; }
.cdp__field { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.cdp__label { font-size: 0.875rem; font-weight: 600; color: var(--nt-ink); }
.cdp__row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.cdp__switch { margin: 0; }
.cdp__switch .form-check-label { font-size: 0.9375rem; font-weight: 500; }
.cdp__count { margin: 0; font-size: 0.875rem; text-align: right; color: var(--nt-muted); }
.cdp__form-actions { display: flex; flex-wrap: wrap; gap: 8px; }

@media (max-width: 767px) {
  .cdp__panel { top: auto; left: 0; width: 100%; max-height: 92vh; border-left: 0; border-top: 1px solid var(--nt-line); border-radius: 12px 12px 0 0; }
  .cdp__head { padding: 16px; }
  .cdp__body { padding: 16px; }
}
</style>
