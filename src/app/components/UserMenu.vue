<script setup>
import "@/app/app.css";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import Avatar from "@/app/components/Avatar.vue";
import Icon from "@/app/components/Icon.vue";
import { ROUTES } from "@/app/routes";

defineOptions({ name: "UserMenu" });

const props = defineProps({
  name: { type: String, required: true },
  // An administrator has no profile or settings pages, only sign out.
  admin: { type: Boolean, default: false },
  // Where the menu opens: "up" in a sidebar foot, "down" from a top bar.
  drop: { type: String, default: "up" },
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
        { label: "Profile", icon: "user", to: ROUTES.PROFILE },
        { label: "Settings", icon: "sliders", to: ROUTES.SETTINGS },
        { label: "Add a baby", icon: "plus", to: { path: ROUTES.PROFILE, query: { addBaby: "1" } } },
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
      <Icon name="chevron-down" :size="16" class="um__chevron" />
      <span class="visually-hidden">Account menu</span>
    </button>

    <Transition name="um-pop">
    <div v-if="open" id="app-user-menu" ref="panel" class="um__panel" :class="`um__panel--${props.drop}`" role="menu" aria-label="Account">
      <RouterLink v-for="link in links" :key="link.label" :to="link.to" class="um__item" role="menuitem">
        <Icon :name="link.icon" :size="18" />
        <span>{{ link.label }}</span>
      </RouterLink>
      <button type="button" class="um__item um__item--btn" role="menuitem" @click="close(); emit('sign-out')">
        <Icon name="logout" :size="18" />
        <span>Sign out</span>
      </button>
    </div>
    </Transition>
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
  padding: 6px 10px 6px 8px;
  background: none;
  border: 1px solid transparent;
  border-radius: 12px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.um__btn:hover,
.um__btn[aria-expanded="true"] {
  background: rgb(255 255 255 / 10%);
}
.um__btn:focus-visible {
  outline: 2px solid #f6d8c6;
  outline-offset: 2px;
}
.um__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--nt-ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.um__chevron {
  flex: none;
  margin-left: auto;
  color: #c9d8ec;
  transition: transform 160ms ease;
}
.um__btn[aria-expanded="true"] .um__chevron {
  transform: rotate(180deg);
}
.um__panel {
  position: absolute;
  width: max-content;
  min-width: 220px;
  max-width: min(280px, calc(100vw - 32px));
  z-index: 25;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  background: #fff8f1;
  border: 1px solid rgb(31 53 86 / 18%);
  border-radius: 14px;
  box-shadow: 0 18px 42px rgb(8 16 32 / 24%), 0 3px 10px rgb(8 16 32 / 12%);
}
.um__panel--up { bottom: calc(100% + 8px); left: 0; }
.um__panel--down { top: calc(100% + 8px); right: 0; }
.um__item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 10px 12px;
  border-radius: 9px;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 20px;
  color: #1f3556;
  text-decoration: none;
}
.um__item :deep(svg) {
  flex: none;
  color: #6d7890;
}
.um__item--btn {
  width: 100%;
  margin-top: 4px;
  padding-top: 11px;
  background: none;
  border: 0;
  border-top: 1px solid rgb(31 53 86 / 12%);
  border-radius: 0 0 9px 9px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.um__item:hover {
  background: #f6d8c6;
  color: #1f3556;
}
.um__item:hover :deep(svg) {
  color: #1f3556;
}
.um__item:focus-visible {
  outline: 2px solid #24456f;
  outline-offset: -2px;
}
.um-pop-enter-active,
.um-pop-leave-active { transition: opacity 140ms ease, transform 160ms ease; }
.um-pop-enter-from,
.um-pop-leave-to { opacity: 0; transform: translateY(-4px); }
@media (max-width: 1099px) {
  .um,
  .um__panel {
    width: 100%;
    max-width: none;
  }
  .um__btn {
    justify-content: flex-start;
    min-height: 48px;
    padding: 6px 10px;
  }
  .um__name {
    flex: 1;
  }
  .um__panel--up,
  .um__panel--down {
    position: static;
    margin-top: 8px;
  }
  .um__panel {
    box-shadow: 0 8px 24px rgb(8 16 32 / 22%);
  }
  .um__item {
    min-height: 46px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .um__chevron,
  .um-pop-enter-active,
  .um-pop-leave-active { transition: none; }
}
</style>
