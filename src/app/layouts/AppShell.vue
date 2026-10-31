<script setup>
import "@/app/app.css";
import { computed, nextTick, onBeforeUnmount, onMounted, provide, reactive, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import BrandLogo from "@/components/ui/BrandLogo.vue";
import { useAuth } from "@/composables/useAuth";
import { useAdmin } from "@/composables/useAdmin";
import Icon from "@/app/components/Icon.vue";
import UserMenu from "@/app/components/UserMenu.vue";
import ChatDock from "@/app/components/ChatDock.vue";
import PartnerToast from "@/app/components/PartnerToast.vue";
import AppToast from "@/app/components/AppToast.vue";
import { useToast } from "@/app/composables/useToast";
import { displayName, useHome, HOME_KEY } from "@/app/composables/useHome";
import { useEntries, ENTRIES_KEY } from "@/app/composables/useEntries";
import { useShared, SHARED_KEY } from "@/app/composables/useShared";
import { useNudges, NUDGES_KEY } from "@/app/composables/useNudges";
import { usePush, usePushMessages } from "@/app/composables/usePush";
import { buildStream, unreadCount } from "@/app/utils/stream";
import { resetLimits } from "@/app/utils/limits";
import { ADMIN_SECTIONS, NAV } from "@/app/data/nav";
import { ROUTES } from "@/app/routes";
import { useSelectedBaby } from "@/app/composables/useSelectedBaby";
import { babySummary } from "@/api/profile";

defineOptions({ name: "AppShell" });

const route = useRoute();
const router = useRouter();
const { logout, currentUser } = useAuth();
const { isAdmin } = useAdmin();
// An administrator sees only the admin tools, even if the same account also has a household.
const adminWorkspace = computed(() => isAdmin.value);
const tone = computed(() => {
  if (route.path === ROUTES.WELLNESS) return "personal";
  if (route.path === ROUTES.SUPPORT || route.path.startsWith(ROUTES.SUPPORT + "/")) return "care";
  return "";
});

// Load the household once here; the sidebar and the page share it.
const home = useHome();
provide(HOME_KEY, home);

// Which baby this dashboard shows. Loaded once the household id is known.
const { babies, selectedBaby, selectBaby, loadBabies } = useSelectedBaby();
watch(home.householdId, (id) => id && loadBabies(id), { immediate: true });

// The switcher only appears on pages that belong to one baby.
const PER_BABY = [ROUTES.HOME, ROUTES.CARE_LOG, ROUTES.CHECKLIST, ROUTES.ROTA, ROUTES.CALENDAR];
const showSwitcher = computed(
  () =>
    babies.value.length > 1 &&
    PER_BABY.some((p) => route.path === p || route.path.startsWith(p + "/")),
);

// One live entries listener, shared by Home and the care log. It waits for the household id.
const entriesShared = useEntries(home.householdId);
provide(ENTRIES_KEY, entriesShared);
// One set of listeners for the shared pages (sleep rota, calendar, return to work). They
// wait for the household id too, and are unbound when it changes or the shell unmounts.
const meUid = computed(() => home.me.value.uid);
const partnerUid = computed(() => home.partner.value?.uid ?? "");
const shared = useShared(home.householdId, meUid, partnerUid);
provide(SHARED_KEY, shared);

// The chat with your partner. The button shows on every page, and a pop up appears when
// something new comes in.
const chat = useNudges({ home, entries: entriesShared, shared });
provide(NUDGES_KEY, chat);
function onToastOpen(toast) {
  chat.closeToast(toast.id);
  if (toast.to) router.push(toast.to);
  else chat.openChat();
}

// Web push. Keep this device's token current when the parent already allowed it. A push that
// arrives while this tab is in front is shown here as a pop up (the service worker only shows
// a system notification when no tab is visible). Chat messages already pop up from the chat
// listener, so only tasks are added here. A tap on a system notification lands here too.
const push = usePush(() => meUid.value);
watch(meUid, (uid) => uid && push.refresh(), { immediate: true });
usePushMessages((message) => {
  if (message.source === "nt-push-open") {
    if (["chat", "feeling", "heavy"].includes(message.type)) chat.openChat();
    else if (message.url) router.push(message.url);
    return;
  }
  if (message.type === "task") {
    chat.showToast({ id: `push:${Date.now()}`, kind: "message", title: message.title, text: message.body, to: ROUTES.CHECKLIST });
  } else if (message.type === "room") {
    chat.showToast({ id: `push:${Date.now()}`, kind: "message", title: message.title, text: message.body, to: message.url || "/support/rooms" });
  }
});
// "/home?chat=1" is where a chat notification opens a fresh tab: open the chat, then tidy the address.
onMounted(() => {
  if (route.query.chat !== "1") return;
  chat.openChat();
  const rest = { ...route.query };
  delete rest.chat;
  router.replace({ path: route.path, query: rest });
});

const { toasts: appToasts, closeToast: closeAppToast } = useToast();

const menuOpen = ref(false);
const menuButton = ref(null);

const ready = computed(() => !home.loading.value && !home.error.value);
const names = computed(() => {
  const mine = displayName(home.me.value.firstName);
  return home.partner.value ? `${mine} & ${displayName(home.partner.value.firstName)}` : mine;
});
const babyName = computed(() => {
  const name = selectedBaby.value?.babyName ?? home.baby.value.name;
  return name ? `Baby ${name}` : "";
});
const babyAge = computed(() =>
  selectedBaby.value ? babySummary(selectedBaby.value).line : home.baby.value.line || "",
);
const userName = computed(() => displayName(home.me.value.displayName || home.me.value.firstName));
// A small dot on Home while there are posts from your partner you have not
// acknowledged. The stream on Home is where you clear them.
const unread = computed(() =>
  unreadCount(buildStream({ posts: shared.posts.posts, uid: meUid.value }), meUid.value),
);
// An administrator's sidebar holds the admin sections; each opens /admin on that section.
const ADMIN_NAV = ADMIN_SECTIONS.map((section) => ({
  key: section.id,
  label: section.label,
  icon: section.icon,
  to: { path: ROUTES.ADMIN, query: { tab: section.id } },
}));
const adminSection = computed(() => (ADMIN_SECTIONS.some((s) => s.id === route.query.tab) ? route.query.tab : ADMIN_SECTIONS[0].id));
const items = computed(() =>
  (adminWorkspace.value ? ADMIN_NAV : NAV).map((item) => ({
    ...item,
    active: adminWorkspace.value
      ? route.path === ROUTES.ADMIN && adminSection.value === item.key
      : item.to === route.path || route.path.startsWith(item.to + "/"),
    dot: item.key === "today" && unread.value > 0,
  })),
);
// The administrator is shown by their account name: display name, else the part of the email before @.
const adminName = computed(() => currentUser.value?.displayName || currentUser.value?.email?.split("@")[0] || "Administrator");

// The highlight behind the current page slides to the new link instead of jumping.
const navWrap = ref(null);
const indicator = reactive({ top: 0, height: 0, on: false, animate: false });
function placeIndicator() {
  const link = navWrap.value?.querySelector(".side__link--active");
  if (!link || !link.offsetHeight) {
    indicator.on = false;
    return;
  }
  indicator.top = link.offsetTop;
  indicator.height = link.offsetHeight;
  indicator.on = true;
}
watch(
  [() => items.value.map((item) => (item.active ? 1 : 0)).join(""), navWrap, menuOpen],
  async () => {
    await nextTick();
    const first = !indicator.on;
    placeIndicator();
    if (first) requestAnimationFrame(() => (indicator.animate = true));
  },
  { flush: "post", immediate: true },
);
onMounted(() => window.addEventListener("resize", placeIndicator));
onBeforeUnmount(() => window.removeEventListener("resize", placeIndicator));

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}
function closeMenu({ restoreFocus = false } = {}) {
  if (!menuOpen.value) return;
  menuOpen.value = false;
  if (restoreFocus) menuButton.value?.focus();
}
function onKeydown(event) {
  if (event.key === "Escape") closeMenu({ restoreFocus: true });
}
function skipToMain(event) {
  event.preventDefault();
  document.getElementById("app-main")?.focus();
}
// Signing out asks first, so a stray click on the menu does not end the session.
const confirmOut = ref(false);
const signingOut = ref(false);
const cancelOut = ref(null);
async function askSignOut() {
  closeMenu();
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
  const wasAdmin = isAdmin.value;
  await logout();
  confirmOut.value = false;
  signingOut.value = false;
  router.push(wasAdmin && ROUTES.ADMIN_SIGN_IN ? ROUTES.ADMIN_SIGN_IN : ROUTES.LANDING);
}

watch(() => route.fullPath, () => closeMenu());
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="appshell">
    <a class="appshell__skip" href="#app-main" @click="skipToMain">Skip to main content</a>

    <aside class="side" aria-label="Household and navigation">
      <div class="side__bar">
        <BrandLogo :to="isAdmin ? ROUTES.ADMIN : ROUTES.HOME" />
        <button
          ref="menuButton"
          type="button"
          class="side__menu"
          :aria-expanded="menuOpen ? 'true' : 'false'"
          aria-controls="app-side-panel"
          @click="toggleMenu"
        >
          <Icon :name="menuOpen ? 'close' : 'menu'" />
          <span>Menu</span>
        </button>
      </div>

      <div id="app-side-panel" class="side__panel" :class="{ 'side__panel--open': menuOpen }">
        <div v-if="adminWorkspace" class="side__chip">
          <p class="side__chip-names">{{ adminName }}</p>
        </div>
        <div v-else-if="ready" class="side__chip">
          <p class="side__chip-names">{{ names }}</p>
          <p v-if="babyName" class="side__chip-baby">{{ babyName }}</p>
          <p v-if="babyAge" class="side__chip-age">{{ babyAge }}</p>
          <select v-if="showSwitcher" class="side__switch" :value="selectedBaby?.id" aria-label="Switch baby" @change="selectBaby($event.target.value)">
            <option v-for="(b, i) in babies" :key="b.id" :value="b.id">
              {{ b.babyName || `Baby ${i + 1}` }}
            </option>
          </select>
          <RouterLink class="side__add" :to="{ path: ROUTES.PROFILE, query: { addBaby: '1' } }" @click="menuOpen = false">Add a baby</RouterLink>
        </div>

        <nav v-if="items.length" ref="navWrap" class="side__navwrap" aria-label="Main">
          <span
            class="side__ind"
            :class="{ 'side__ind--on': indicator.on, 'side__ind--anim': indicator.animate }"
            :style="{ transform: `translateY(${indicator.top}px)`, height: `${indicator.height}px` }"
            aria-hidden="true"
          />
          <ul class="side__nav">
            <li v-for="item in items" :key="item.key">
              <RouterLink
                :to="item.to"
                class="side__link"
                :class="{ 'side__link--active': item.active }"
                :aria-current="item.active ? 'page' : undefined"
              >
                <Icon :name="item.icon" />
                <span>{{ item.label }}</span>
                <span v-if="item.dot" class="side__dot" aria-hidden="true"></span>
                <span v-if="item.dot" class="visually-hidden">unread</span>
              </RouterLink>
            </li>
          </ul>
        </nav>

        <div class="side__foot">
          <p v-if="!adminWorkspace" class="side__note">Your care space is shared. Wellness check-ins stay private by default.</p>
          <div class="side__user">
            <UserMenu :name="adminWorkspace ? adminName : userName" :admin="adminWorkspace" @sign-out="askSignOut" />
          </div>
        </div>
      </div>
    </aside>

    <main id="app-main" class="appshell__main" :class="tone && `appshell__main--${tone}`" tabindex="-1">
      <div class="appshell__content">
        <RouterView v-slot="{ Component, route: current }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="current.meta.pageKey ?? current.path" />
          </Transition>
        </RouterView>
      </div>
    </main>

    <AppToast :toasts="appToasts" @close="closeAppToast" />

    <Teleport to="body">
      <Transition name="so">
        <div v-if="confirmOut" class="so" @click.self="closeConfirm">
          <div class="so__box" role="alertdialog" aria-modal="true" aria-labelledby="so-title" aria-describedby="so-text" @keydown="trapConfirm">
            <h2 id="so-title" class="so__title">Are you sure you want to sign out?</h2>
            <p id="so-text" class="so__text">You will need to sign in again to see your care space.</p>
            <div class="so__actions">
              <button ref="cancelOut" type="button" class="app-btn app-btn--outline" :disabled="signingOut" @click="closeConfirm">Stay signed in</button>
              <button type="button" class="app-btn app-btn--primary" :disabled="signingOut" @click="signOut">{{ signingOut ? "Signing out" : "Sign out" }}</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <template v-if="!adminWorkspace">
      <PartnerToast :toasts="chat.toasts.value" @close="chat.closeToast" @open="onToastOpen" />
      <ChatDock :chat="chat" :me="meUid" />
    </template>
  </div>
</template>

<style scoped>
.appshell {
  display: grid;
  grid-template-columns: 264px minmax(0, 1fr);
  min-height: 100vh;
  background: var(--nt-bg);
}
.appshell__skip {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 30;
  padding: 10px 14px;
  background: #fff;
  border: 1px solid var(--nt-line);
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--nt-ink);
  transform: translateY(-200%);
}
.appshell__skip:focus {
  transform: none;
}
.appshell__main {
  min-width: 0;
  padding: 40px clamp(24px, 4vw, 64px);
}
.appshell__main--care {
  background: var(--nt-bg-care);
}
.appshell__main--personal {
  background: var(--nt-bg-personal);
}
.appshell__main:focus {
  outline: none;
}
.appshell__content {
  width: 100%;
  max-width: 1360px;
  margin: 0 auto;
}

.side {
  position: sticky;
  top: 0;
  align-self: start;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow-y: auto;
  padding: 24px 16px;
  background: var(--nt-bg);
  border-right: 1px solid var(--nt-line);
}
.side__bar {
  padding: 0 8px 20px;
}
.side__menu {
  display: none;
}
.side__panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
}
.side__chip {
  padding: 12px;
  background: var(--nt-gray);
  border: 1px solid var(--nt-line);
  border-radius: 12px;
}
.side__chip-names {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--nt-ink);
}
.side__chip-baby {
  margin: 2px 0 0;
  font-size: 0.875rem;
  line-height: 1.4;
  color: var(--nt-muted);
}
.side__chip-age {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.4;
  color: var(--nt-muted);
}

.side__add {
  display: inline-block;
  margin-top: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--nt-plum);
  text-decoration: none;
}
.side__add:hover { text-decoration: underline; }
.side__add:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; border-radius: 4px; }

.side__switch {
  width: 100%;
  margin-top: 8px;
  padding: 8px 10px;
  background: #fff;
  border: 1px solid var(--nt-line);
  border-radius: 8px;
  font-family: inherit;
  font-size: 0.875rem;
  color: var(--nt-ink);
}

.side__navwrap {
  position: relative;
}
.side__ind {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  border-radius: 8px;
  background: var(--nt-gray);
  opacity: 0;
  pointer-events: none;
}
.side__ind--on {
  opacity: 1;
}
.side__ind--anim {
  transition: transform 300ms cubic-bezier(0.22, 0.61, 0.36, 1), height 300ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 160ms ease;
}
@media (prefers-reduced-motion: reduce) {
  .side__ind--anim {
    transition: none;
  }
}
.side__nav {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.side__link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 20px;
  color: var(--nt-muted);
  text-decoration: none;
  transition: color 200ms ease, background-color 150ms ease;
}
.side__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--nt-coral);
  flex: none;
}
.side__link:hover {
  background: var(--nt-gray);
  color: var(--nt-ink);
}
.side__link--active,
.side__link--active:hover {
  background: transparent;
  color: var(--nt-plum);
}
.side__foot {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: auto;
}
.side__note {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--nt-muted);
}
.side__user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 16px;
  border-top: 1px solid var(--nt-line);
}

@media (max-width: 991px) {
  .appshell {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }
  .appshell__main {
    padding: 24px 16px 64px;
  }
  .side {
    position: sticky;
    z-index: 20;
    height: auto;
    overflow: visible;
    padding: 0;
    border-right: 0;
    border-bottom: 1px solid var(--nt-line);
  }
  .side__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
  }
  .side__menu {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #fff;
    border: 1px solid var(--nt-line);
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--nt-ink);
    cursor: pointer;
  }
  .side__panel {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    max-height: calc(100vh - 66px);
    overflow-y: auto;
    padding: 16px;
    background: var(--nt-bg);
    border-bottom: 1px solid var(--nt-line);
  }
  .side__panel--open {
    display: flex;
  }
}
</style>

<style>
/* A short fade between pages, so changing page from the sidebar is not a hard swap. */
.page-enter-active { transition: opacity 220ms ease, transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1); }
.page-leave-active { transition: opacity 120ms ease; }
.page-enter-from { opacity: 0; transform: translateY(8px); }
.page-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .page-enter-active, .page-leave-active { transition: none; }
}

/* Items added to a list ease in; removed ones fade out. */
.li-enter-active { transition: opacity 0.28s ease, transform 0.3s cubic-bezier(0.22, 0.61, 0.36, 1); }
.li-leave-active { transition: opacity 0.18s ease; }
.li-enter-from { opacity: 0; transform: translateY(8px); }
.li-leave-to { opacity: 0; }
.li-move { transition: transform 0.28s cubic-bezier(0.22, 0.61, 0.36, 1); }
@media (prefers-reduced-motion: reduce) { .li-enter-active, .li-leave-active, .li-move { transition: none; } }
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
