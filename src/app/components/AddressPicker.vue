<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import { searchPlaces } from "@/api/roomLocation";
import "@/app/app.css";

defineOptions({ name: "AddressPicker" });

// One search box for any Singapore place: type a mall, street or postal code and pick a
// suggestion. The pick gives back { name, address, postalCode, lat, lng }.
const props = defineProps({
  id: { type: String, required: true },
  label: { type: String, default: "Search for the place" },
  placeholder: { type: String, default: "Mall, street or postal code" },
  hint: { type: String, default: "Pick a suggestion to fill in the address and map position." },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(["pick"]);

const text = ref("");
const places = ref([]);
const open = ref(false);
const state = ref("idle"); // idle | busy | empty | failed
const active = ref(-1);
let timer = null;
let sequence = 0;

const listId = computed(() => `${props.id}-list`);
const optionId = (i) => `${props.id}-opt-${i}`;
const status = computed(() => {
  if (state.value === "busy") return "Searching...";
  if (state.value === "empty") return "No places found. Try a postal code, or type the address yourself.";
  if (state.value === "failed") return "Suggestions are unavailable right now. Type the address yourself.";
  return "";
});

function onInput(event) {
  text.value = event.target.value;
  clearTimeout(timer);
  const query = text.value.trim();
  active.value = -1;
  if (query.length < 3) {
    sequence++;
    places.value = [];
    state.value = "idle";
    open.value = false;
    return;
  }
  state.value = "busy";
  const mine = ++sequence;
  timer = setTimeout(async () => {
    try {
      const found = await searchPlaces(query);
      if (mine !== sequence) return;
      places.value = found;
      state.value = found.length ? "idle" : "empty";
      open.value = found.length > 0;
    } catch {
      if (mine !== sequence) return;
      places.value = [];
      state.value = "failed";
      open.value = false;
    }
  }, 300);
}

function choose(place) {
  emit("pick", place);
  text.value = place.name;
  open.value = false;
  places.value = [];
  state.value = "idle";
  active.value = -1;
}

function onKeydown(event) {
  if (event.key === "Escape") {
    open.value = false;
    return;
  }
  if (!open.value || !places.value.length) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    active.value = (active.value + 1) % places.value.length;
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    active.value = (active.value - 1 + places.value.length) % places.value.length;
  } else if (event.key === "Enter" && active.value >= 0) {
    event.preventDefault();
    choose(places.value[active.value]);
  }
}

// Close when focus leaves the box; a click on a suggestion happens first (mousedown below).
function onBlur() {
  setTimeout(() => (open.value = false), 120);
}
onBeforeUnmount(() => {
  clearTimeout(timer);
  sequence++;
});
</script>

<template>
  <div class="ap">
    <label class="app-field__label" :for="id">{{ label }}</label>
    <div class="ap__box">
    <input
      :id="id"
      class="form-control"
      type="text"
      role="combobox"
      autocomplete="off"
      :value="text"
      :placeholder="placeholder"
      :disabled="disabled"
      aria-autocomplete="list"
      :aria-expanded="open ? 'true' : 'false'"
      :aria-controls="listId"
      :aria-activedescendant="active >= 0 ? optionId(active) : undefined"
      :aria-describedby="`${id}-hint`"
      @input="onInput"
      @keydown="onKeydown"
      @focus="open = places.length > 0"
      @blur="onBlur"
    />
    <ul v-show="open" :id="listId" class="ap__list" role="listbox" :aria-label="label">
      <li
        v-for="(place, i) in places"
        :id="optionId(i)"
        :key="`${place.name}-${place.address}`"
        class="ap__opt"
        :class="{ 'ap__opt--on': i === active }"
        role="option"
        :aria-selected="i === active ? 'true' : 'false'"
        @mousedown.prevent="choose(place)"
        @mousemove="active = i"
      >
        <span class="ap__name">{{ place.name }}</span>
        <span class="ap__addr">{{ place.address }}</span>
      </li>
    </ul>
    </div>
    <p :id="`${id}-hint`" class="ap__hint" role="status">{{ status || hint }}</p>
  </div>
</template>

<style scoped>
.ap { display: flex; flex-direction: column; gap: 6px; }
.ap__box { position: relative; }
.ap__list { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20; max-height: 280px; margin: 0; padding: 4px; overflow-y: auto; list-style: none; background: var(--nt-white, #fff); border: 1px solid var(--nt-line); border-radius: 8px; box-shadow: 0 8px 24px rgb(0 0 0 / 12%); }
.ap__opt { display: flex; flex-direction: column; gap: 2px; padding: 8px 12px; border-radius: 6px; cursor: pointer; }
.ap__opt--on { background: #f3eef4; }
.ap__name { font-size: 0.875rem; font-weight: 600; color: var(--nt-ink); }
.ap__addr { font-size: 0.8125rem; line-height: 1.4; color: var(--nt-muted); }
.ap__hint { margin: 0; font-size: 0.875rem; color: var(--nt-muted); }
</style>
