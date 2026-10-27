<script setup>
import "@/app/app.css";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import Avatar from "@/app/components/Avatar.vue";
import { ROUTES } from "@/app/routes";

defineOptions({ name: "UserMenu" });

const props = defineProps({
  name: { type: String, required: true },
  // An administrator has no profile or settings pages, only sign out.
  admin: { type: Boolean, default: false },
});
const emit = defineEmits(["sign-out"]);

const route = useRoute();
const open = ref(false);
const button = ref(null);
const panel = ref(null);
const root = ref(null);

const links = computed(() =>
  props.admin
    ? []
    : [
        { label: "Profile", to: ROUTES.PROFILE },
        { label: "Settings", to: ROUTES.SETTINGS },
      ],
);

async function focusFirstItem() {
  await nextTick();
  panel.value?.querySelector("a, button")?.focus();
}

function toggle() {
  open.value = !open.value;
  if (open.value) focusFirstItem();
}

function close({ restoreFocus = false } = {}) {
  if (!open.value) return;
  open.value = false;
  if (restoreFocus) button.value?.focus();
}

function onKeydown(event) {
  if (!open.value) return;
  if (event.key === "Escape") {
    event.preventDefault();
    close({ restoreFocus: true });
    return;
  }
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const items = Array.from(panel.value?.querySelectorAll("a, button") ?? []);
  if (!items.length) return;
  event.preventDefault();
  const at = items.indexOf(document.activeElement);
  const step = event.key === "ArrowDown" ? 1 : -1;
  const next = (at + step + items.length) % items.length;
  items[next].focus();
}

function onPointerDown(event) {
  if (!open.value) return;
  if (!root.value?.contains(event.target)) close();
}

watch(() => route.fullPath, () => close());
onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  document.addEventListener("pointerdown", onPointerDown, true);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  document.removeEventListener("pointerdown", onPointerDown, true);
});
</script>

<template>
  <div ref="root" class="um">
    <button
      ref="button"
      type="button"
      class="um__btn"
      :aria-expanded="open ? 'true' : 'false'"
      aria-controls="app-user-menu"
      aria-haspopup="true"
      @click="toggle"
    >
      <Avatar :name="props.name" tone="apricot" :size="36" />
      <span class="um__name">{{ props.name }}</span>
      <span class="visually-hidden">Account menu</span>
    </button>

    <div v-if="open" id="app-user-menu" ref="panel" class="um__panel" role="menu" aria-label="Account">
      <RouterLink v-for="link in links" :key="link.to" :to="link.to" class="um__item" role="menuitem">
        {{ link.label }}
      </RouterLink>
      <button type="button" class="um__item um__item--btn" role="menuitem" @click="close(); emit('sign-out')">
        Sign out
      </button>
    </div>
  </div>
</template>

<style scoped>
.um {
  position: relative;
}
.um__btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px;
  background: none;
  border: 1px solid transparent;
  border-radius: 8px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.um__btn:hover {
  background: var(--nt-gray);
}
.um__btn:focus-visible {
  outline: 2px solid var(--nt-plum);
  outline-offset: 2px;
}
.um__name {
  min-width: 0;
  overflow: hidden;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--nt-ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.um__panel {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 25;
  display: flex;
  flex-direction: column;
  padding: 4px;
  background: #fff;
  border: 1px solid var(--nt-line);
  border-radius: 8px;
}
.um__item {
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 20px;
  color: var(--nt-ink);
  text-decoration: none;
}
.um__item--btn {
  background: none;
  border: 0;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.um__item:hover {
  background: var(--nt-gray);
  color: var(--nt-plum);
}
.um__item:focus-visible {
  outline: 2px solid var(--nt-plum);
  outline-offset: -2px;
}
</style>
