<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import BrandLogo from "@/components/ui/BrandLogo.vue";
import { useAuth } from "@/composables/useAuth";
import Icon from "@/app/components/Icon.vue";
import UserMenu from "@/app/components/UserMenu.vue";
import { resetLimits } from "@/app/utils/limits";
import { ROUTES } from "@/app/routes";

defineOptions({ name: "CaregiverTopBar" });

// The same top bar as the parent app, with the one page a caregiver can open.
// Caregivers sit outside AppShell (its live listeners are parent-only), so the bar lives here.
const router = useRouter();
const route = useRoute();
// The Duty tab is only offered when a parent has shared the duty schedule with this carer.
defineProps({ showDuty: { type: Boolean, default: false } });
const onDuty = computed(() => route.path === ROUTES.CARE_DUTY);
const { logout, currentUser } = useAuth();

const name = computed(
  () => currentUser.value?.displayName || currentUser.value?.email?.split("@")[0] || "Caregiver",
);

const menuOpen = ref(false);
const menuButton = ref(null);
function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}
function onKeydown(event) {
  if (event.key === "Escape" && menuOpen.value) {
    menuOpen.value = false;
    menuButton.value?.focus();
  }
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));

// Signing out asks first, as in the main app.
const confirmOut = ref(false);
const signingOut = ref(false);
const cancelOut = ref(null);
async function askSignOut() {
  menuOpen.value = false;
  confirmOut.value = true;
  await nextTick();
  cancelOut.value?.focus();
}
function closeConfirm() {
  if (signingOut.value) return;
  confirmOut.value = false;
}
function trapConfirm(event) {
  if (event.key === "Escape") {
    event.stopPropagation();
    closeConfirm();
    return;
  }
  if (event.key !== "Tab") return;
  const items = [...event.currentTarget.querySelectorAll("button:not([disabled])")];
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
async function signOut() {
  signingOut.value = true;
  resetLimits();
  await logout();
  confirmOut.value = false;
  signingOut.value = false;
  router.push(ROUTES.LANDING);
}
</script>

<template>
  <header class="top" aria-label="Navigation">
    <div class="top__bar">
      <BrandLogo :to="ROUTES.CARE_BRIEF" />
      <button
        ref="menuButton"
        type="button"
        class="top__menu"
        :aria-expanded="menuOpen ? 'true' : 'false'"
        aria-controls="cg-top-panel"
        @click="toggleMenu"
      >
        <Icon :name="menuOpen ? 'close' : 'menu'" />
        <span>Menu</span>
      </button>

      <div id="cg-top-panel" class="top__panel" :class="{ 'top__panel--open': menuOpen }">
        <nav class="top__nav" aria-label="Main">
          <ul class="top__list">
            <li>
              <RouterLink
                :to="ROUTES.CARE_BRIEF"
                class="top__link"
                :class="{ 'top__link--active': !onDuty }"
                :aria-current="onDuty ? undefined : 'page'"
              >
                <Icon name="heart" :size="18" />
                <span>Care brief</span>
              </RouterLink>
            </li>
            <li v-if="showDuty">
              <RouterLink
                :to="ROUTES.CARE_DUTY"
                class="top__link"
                :class="{ 'top__link--active': onDuty }"
                :aria-current="onDuty ? 'page' : undefined"
              >
                <Icon name="moon" :size="18" />
                <span>Duty</span>
              </RouterLink>
            </li>
          </ul>
        </nav>
        <div class="top__user">
          <UserMenu :name="name" admin drop="down" @sign-out="askSignOut" />
        </div>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="so">
        <div v-if="confirmOut" class="so" @click.self="closeConfirm">
          <div class="so__box" role="alertdialog" aria-modal="true" aria-labelledby="cg-so-title" aria-describedby="cg-so-text" @keydown="trapConfirm">
            <h2 id="cg-so-title" class="so__title">Are you sure you want to sign out?</h2>
            <p id="cg-so-text" class="so__text">You will need to sign in again to see the care brief.</p>
            <div class="so__actions">
              <button ref="cancelOut" type="button" class="app-btn app-btn--outline" :disabled="signingOut" @click="closeConfirm">Stay signed in</button>
              <button type="button" class="app-btn app-btn--primary" :disabled="signingOut" @click="signOut">{{ signingOut ? "Signing out" : "Sign out" }}</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </header>
</template>

<style scoped>
.top {
  position: sticky;
  top: 0;
  z-index: 20;
  background: #1f3556;
  border-bottom: 1px solid rgb(255 255 255 / 10%);
}
.top :deep(.brand) {
  color: #fdf3e6;
}
.top :deep(.brand img) {
  box-sizing: content-box;
  padding: 3px;
  background: #fdf3e6;
  border-radius: 8px;
}
.top__bar {
  display: flex;
  align-items: center;
  gap: 32px;
  max-width: 1360px;
  margin: 0 auto;
  padding: 0 clamp(16px, 4vw, 64px);
  min-height: 64px;
}
.top__menu {
  display: none;
}
.top__panel {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-width: 0;
}
.top__nav {
  align-self: stretch;
  min-width: 0;
}
.top__list {
  display: flex;
  align-items: stretch;
  gap: 24px;
  height: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}
.top__list > li {
  display: flex;
}
.top__link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 2px;
  font-size: 0.9375rem;
  font-weight: 500;
  color: #c9d8ec;
  text-decoration: none;
  white-space: nowrap;
}
.top__link::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 3px;
  background: transparent;
  border-radius: 3px 3px 0 0;
}
.top__link:focus-visible {
  outline: 2px solid #f6d8c6;
  outline-offset: 4px;
  border-radius: 4px;
}
.top__link--active,
.top__link--active:hover {
  color: #fff;
  font-weight: 600;
}
.top__link--active::after {
  background: #f6d8c6;
}
.top__user {
  flex: none;
  max-width: 15rem;
}
.top__user :deep(.um__name) {
  max-width: 10rem;
  color: #fff;
}
.top__user :deep(.um__btn:hover) {
  background: rgb(255 255 255 / 10%);
}

@media (min-width: 1100px) {
  .top__bar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
  }
  .top__panel {
    display: contents;
  }
  .top__nav {
    justify-self: center;
  }
  .top__user {
    justify-self: end;
  }
  .top__list > li > .top__link :deep(svg) {
    display: none;
  }
}

@media (max-width: 1099px) {
  .top__bar {
    justify-content: space-between;
    min-height: 0;
    padding: 12px 16px;
  }
  .top__menu {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #fff;
    border: 1px solid #c9d3e3;
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    color: #16233b;
    cursor: pointer;
  }
  .top__panel {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
    padding: 16px;
    background: #182a46;
    border-bottom: 1px solid rgb(255 255 255 / 10%);
  }
  .top__panel--open {
    display: flex;
  }
  .top__nav {
    align-self: auto;
  }
  .top__list {
    flex-direction: column;
    gap: 2px;
  }
  .top__link {
    flex: 1;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
  }
  .top__link::after {
    display: none;
  }
  .top__link--active,
  .top__link--active:hover {
    background: #f6d8c6;
    color: #1f3556;
  }
  .top__user {
    order: 3;
  }
}
</style>

<style>
.so { position: fixed; inset: 0; z-index: 1100; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(32, 33, 36, 0.4); }
.so__box { width: 100%; max-width: 400px; padding: 24px; background: #fff; border-radius: 16px; box-shadow: 0 8px 10px rgba(60, 64, 67, 0.2), 0 16px 24px 2px rgba(60, 64, 67, 0.14); }
.so__title { margin: 0 0 8px; font-family: var(--nt-serif, inherit); font-size: 1.25rem; font-weight: 600; color: var(--nt-ink); }
.so__text { margin: 0 0 24px; color: var(--nt-muted); }
.so__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.so-enter-active, .so-leave-active { transition: opacity 0.18s ease; }
.so-enter-active .so__box, .so-leave-active .so__box { transition: transform 0.2s ease; }
.so-enter-from, .so-leave-to { opacity: 0; }
.so-enter-from .so__box, .so-leave-to .so__box { transform: translateY(8px) scale(0.98); }
@media (prefers-reduced-motion: reduce) { .so-enter-active, .so-leave-active, .so-enter-active .so__box, .so-leave-active .so__box { transition: none; } }
</style>
