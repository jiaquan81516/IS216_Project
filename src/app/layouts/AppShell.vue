<script setup>
import "@/app/app.css";
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from "vue";
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

defineOptions({ name: "AppShell" });

const route = useRoute();
const router = useRouter();
const { logout, currentUser } = useAuth();
const { isAdmin } = useAdmin();
// An administrator sees only the admin tools, even if the same account also has a household.
const adminWorkspace = computed(() => isAdmin.value);
// Home has its own look: a deep blue page with the paper texture on its cards. Other pages keep the paper page for now.
const tone = computed(() => {
  if (route.path === ROUTES.WELLNESS) return "personal";
  if (route.path === ROUTES.SUPPORT || route.path.startsWith(ROUTES.SUPPORT + "/")) return "care";
  if (route.path === ROUTES.CARE_LOG || route.path === ROUTES.CHECKLIST || route.path === ROUTES.ROTA) return "carelog";
  return "";
});

// Load the household once here; the sidebar and the page share it.
const home = useHome();
provide(HOME_KEY, home);

// Which baby this dashboard shows. Loaded once the household id is known.
const { loadBabies } = useSelectedBaby();
watch(home.householdId, (id) => id && loadBabies(id), { immediate: true });

// One live entries listener, shared by Home and the care log. It waits for the household id.
const entriesShared = useEntries(home.householdId);
provide(ENTRIES_KEY, entriesShared);
// One set of listeners for the shared pages (sleep rota, calendar, tasks). They
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

const userName = computed(() => displayName(home.me.value.displayName || home.me.value.firstName));
// A small dot on Home while there are posts from your partner you have not
// acknowledged. The stream on Home is where you clear them.
const unread = computed(() =>
  unreadCount(buildStream({ posts: shared.posts.posts, uid: meUid.value }), meUid.value),
);
// An administrator's bar holds the admin sections; each opens /admin on that section.
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
// Daily pages sit on the bar; the rest live under "More". An administrator's sections are all primary.
const primaryItems = computed(() => items.value.filter((i) => i.group !== "secondary"));
const moreItems = computed(() => items.value.filter((i) => i.group === "secondary"));
const moreActive = computed(() => moreItems.value.some((i) => i.active));
const moreOpen = ref(false);
const moreButton = ref(null);
const moreWrap = ref(null);
function closeMore({ restoreFocus = false } = {}) {
  if (!moreOpen.value) return;
  moreOpen.value = false;
  if (restoreFocus) moreButton.value?.focus();
}
function onDocPointer(event) {
  if (moreOpen.value && !moreWrap.value?.contains(event.target)) closeMore();
}
onMounted(() => document.addEventListener("pointerdown", onDocPointer));
onBeforeUnmount(() => document.removeEventListener("pointerdown", onDocPointer));
// The administrator is shown by their account name: display name, else the part of the email before @.
const adminName = computed(() => currentUser.value?.displayName || currentUser.value?.email?.split("@")[0] || "Administrator");

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}
function closeMenu({ restoreFocus = false } = {}) {
  if (!menuOpen.value) return;
  menuOpen.value = false;
  if (restoreFocus) menuButton.value?.focus();
}
function onKeydown(event) {
  if (event.key === "Escape") {
    closeMore({ restoreFocus: true });
    closeMenu({ restoreFocus: true });
  }
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

watch(() => route.fullPath, () => {
  closeMenu();
  closeMore();
});
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="appshell">
    <a class="appshell__skip" href="#app-main" @click="skipToMain">Skip to main content</a>

    <header class="top" aria-label="Household and navigation">
      <div class="top__bar">
        <BrandLogo :to="isAdmin ? ROUTES.ADMIN : ROUTES.HOME" />
        <button
          ref="menuButton"
          type="button"
          class="top__menu"
          :aria-expanded="menuOpen ? 'true' : 'false'"
          aria-controls="app-top-panel"
          @click="toggleMenu"
        >
          <Icon :name="menuOpen ? 'close' : 'menu'" />
          <span>Menu</span>
        </button>

        <div id="app-top-panel" class="top__panel" :class="{ 'top__panel--open': menuOpen }">
          <nav class="top__nav" aria-label="Main">
            <ul class="top__list">
              <li v-for="item in primaryItems" :key="item.key">
                <RouterLink
                  :to="item.to"
                  class="top__link"
                  :class="{ 'top__link--active': item.active }"
                  :aria-current="item.active ? 'page' : undefined"
                >
                  <Icon :name="item.icon" />
                  <span>{{ item.label }}</span>
                  <span v-if="item.dot" class="top__dot" aria-hidden="true"></span>
                  <span v-if="item.dot" class="visually-hidden">unread</span>
                </RouterLink>
              </li>
              <li v-if="moreItems.length" ref="moreWrap" class="top__more" :class="{ 'top__more--open': moreOpen }">
                <button
                  ref="moreButton"
                  type="button"
                  class="top__link top__morebtn"
                  :class="{ 'top__link--active': moreActive }"
                  :aria-expanded="moreOpen ? 'true' : 'false'"
                  aria-controls="top-more-list"
                  @click="moreOpen = !moreOpen"
                >
                  <span>More</span>
                  <Icon name="chevron-down" :size="16" class="top__morechev" />
                </button>
                <p class="top__moretitle">More</p>
                <ul id="top-more-list" class="top__morelist">
                  <li v-for="item in moreItems" :key="item.key">
                    <RouterLink
                      :to="item.to"
                      class="top__link top__sublink"
                      :class="{ 'top__link--active': item.active }"
                      :aria-current="item.active ? 'page' : undefined"
                    >
                      <Icon :name="item.icon" />
                      <span>{{ item.label }}</span>
                    </RouterLink>
                  </li>
                </ul>
              </li>
            </ul>
          </nav>
          <div class="top__user">
            <UserMenu :name="adminWorkspace ? adminName : userName" :admin="adminWorkspace" drop="down" @sign-out="askSignOut" />
          </div>
        </div>
      </div>

    </header>

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
  overflow-x: clip;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  /* A soft dotted periwinkle behind every page. */
  background-color: #9fb0d0;
  background-image: radial-gradient(rgb(255 255 255 / 35%) 1.5px, transparent 1.5px);
  background-size: 22px 22px;
}
.appshell__skip {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 40;
  padding: 10px 14px;
  background: var(--nt-surface, #fff);
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
  flex: 1;
  min-width: 0;
  padding: 32px clamp(16px, 4vw, 64px) 48px;

  /* Pages sit straight on the pale blue. Cards are pale yellow with a thin plum-tinted border. */
  --nt-plum: #24456f;
  --nt-plum-hover: #1b3555;
  --nt-muted: #2b3b57;
  --nt-line: rgb(59 47 63 / 16%);
  --nt-gray: rgb(59 47 63 / 7%);
  --nt-white: #fff8f1;
  --nt-surface: #fff8f1;
  --nt-bg: #faefe4;
  --nt-bg-care: #faefe4;
  --nt-bg-personal: #faefe4;
}

/* Every page title: a larger serif with a short plum rule under it. */
.appshell__main :deep(h1.nt-title) {
  font-size: clamp(2.25rem, 3.2vw, 3rem);
  line-height: 1.12;
  letter-spacing: -0.03em;
}
.appshell__main :deep(h1.nt-title)::after {
  content: "";
  display: block;
  width: 44px;
  height: 3px;
  margin-top: 14px;
  background: var(--nt-plum);
  border-radius: 2px;
}
.appshell__main:focus {
  outline: none;
}
.appshell__content {
  width: 100%;
  max-width: 1360px;
  margin: 0 auto;
}

/* The top bar: a deep blue bar with the brand, the eight pages as plain words, then the household and account. */
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
  gap: 22px;
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
.top__link:hover {
  color: #fff;
}
.top__link:hover::after {
  background: rgb(255 255 255 / 35%);
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
.top__link--active::after,
.top__link--active:hover::after {
  background: #f6d8c6;
}
.top__more {
  position: relative;
  display: flex;
}
.top__morebtn {
  background: none;
  border: 0;
  font-family: inherit;
  cursor: pointer;
}
.top__morechev {
  transition: transform 180ms ease;
}
.top__more--open .top__morechev {
  transform: rotate(180deg);
}
.top__moretitle {
  display: none;
}
.top__morelist {
  position: absolute;
  top: calc(100% - 6px);
  right: -12px;
  z-index: 30;
  min-width: 13rem;
  margin: 0;
  padding: 6px;
  list-style: none;
  background: #182a46;
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 12px;
  box-shadow: 0 12px 28px rgb(8 16 32 / 35%);
  opacity: 0;
  visibility: hidden;
  transform: translateY(-4px);
  transition: opacity 140ms ease, transform 160ms ease, visibility 0s linear 160ms;
}
.top__more--open .top__morelist {
  opacity: 1;
  visibility: visible;
  transform: none;
  transition: opacity 140ms ease, transform 160ms ease;
}
.top__sublink {
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
}
.top__sublink::after {
  display: none;
}
.top__sublink:hover {
  background: rgb(255 255 255 / 10%);
}
.top__sublink.top__link--active,
.top__sublink.top__link--active:hover {
  background: #f6d8c6;
  color: #1f3556;
}
@media (prefers-reduced-motion: reduce) {
  .top__morechev,
  .top__morelist,
  .top__more--open .top__morelist {
    transition: none;
  }
}
.top__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--nt-coral, #b5532f);
  flex: none;
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

/* On a wide bar the pages are words only; icons come back in the folded menu. */
@media (min-width: 1100px) {
  /* Brand on the left, the pages dead centre, the account on the right. */
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
  .top__list > li > .top__link :deep(svg:not(.top__morechev)) {
    display: none;
  }
}
@media (max-width: 1199px) and (min-width: 1100px) {
  .top__list {
    gap: 16px;
  }
}

/* Narrow screens: the pages fold into a Menu button. */
@media (max-width: 1099px) {
  .appshell__main {
    padding: 24px 16px 64px;
  }
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
    max-height: calc(100vh - 66px);
    overflow-y: auto;
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
    align-items: stretch;
    gap: 2px;
  }
  .top__link {
    gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
  }
  .top__link::after {
    display: none;
  }
  .top__link:hover {
    background: rgb(255 255 255 / 10%);
  }
  .top__link--active,
  .top__link--active:hover {
    background: #f6d8c6;
    color: #1f3556;
  }
  .top__more {
    flex-direction: column;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgb(255 255 255 / 12%);
  }
  .top__morebtn {
    display: none;
  }
  .top__moretitle {
    display: block;
    margin: 0 0 4px;
    padding: 0 12px;
    font-size: 0.8125rem;
    color: #8fa3c2;
  }
  .top__morelist {
    position: static;
    min-width: 0;
    padding: 0;
    background: none;
    border: 0;
    box-shadow: none;
    opacity: 1;
    visibility: visible;
    transform: none;
  }
  .top__sublink {
    padding: 10px 12px;
  }
  .top__user {
    order: 3;
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
