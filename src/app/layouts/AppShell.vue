<script setup>
import "@/app/app.css";
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import BrandLogo from "@/components/ui/BrandLogo.vue";
import { useAuth } from "@/composables/useAuth";
import Icon from "@/app/components/Icon.vue";
import UserMenu from "@/app/components/UserMenu.vue";
import ChatDock from "@/app/components/ChatDock.vue";
import PartnerToast from "@/app/components/PartnerToast.vue";
import { displayName, useHome, HOME_KEY } from "@/app/composables/useHome";
import { useEntries, ENTRIES_KEY } from "@/app/composables/useEntries";
import { useShared, SHARED_KEY } from "@/app/composables/useShared";
import { useNudges, NUDGES_KEY } from "@/app/composables/useNudges";
import { usePush, usePushMessages } from "@/app/composables/usePush";
import { buildStream, unreadCount } from "@/app/utils/stream";
import { resetLimits } from "@/app/utils/limits";
import { NAV } from "@/app/data/nav";
import { ROUTES } from "@/app/routes";
import { useSelectedBaby } from "@/app/composables/useSelectedBaby";
import { babySummary } from "@/api/profile";

defineOptions({ name: "AppShell" });

const route = useRoute();
const router = useRouter();
const { logout } = useAuth();
// Home has its own look: a deep blue page with the paper texture on its cards. Other pages keep the paper page for now.
const isHome = computed(() => route.path === ROUTES.HOME);
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
const items = computed(() =>
  NAV.map((item) => ({
    ...item,
    active: item.to === route.path || route.path.startsWith(item.to + "/"),
    dot: item.key === "today" && unread.value > 0,
  })),
);

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
async function signOut() {
  resetLimits();
  await logout();
  router.push(ROUTES.LANDING);
}

watch(() => route.fullPath, () => closeMenu());
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="appshell" :class="{ 'appshell--home': isHome }">
    <a class="appshell__skip" href="#app-main" @click="skipToMain">Skip to main content</a>

    <header class="top" aria-label="Household and navigation">
      <div class="top__bar">
        <BrandLogo :to="ROUTES.HOME" />
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
              <li v-for="item in items" :key="item.key">
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
            </ul>
          </nav>
          <div v-if="ready" class="top__ctx">
            <p class="top__ctx-text">
              <strong>{{ names }}</strong>
              <template v-if="babyName"> · {{ babyName }}</template>
              <span v-if="babyAge" class="top__ctx-age"> · {{ babyAge }}</span>
            </p>
            <select v-if="showSwitcher" class="top__switch" :value="selectedBaby?.id" aria-label="Switch baby" @change="selectBaby($event.target.value)">
              <option v-for="(b, i) in babies" :key="b.id" :value="b.id">
                {{ b.babyName || `Baby ${i + 1}` }}
              </option>
            </select>
          </div>
          <div class="top__user">
            <UserMenu :name="userName" drop="down" @sign-out="signOut" />
          </div>
        </div>
      </div>

    </header>

    <main id="app-main" class="appshell__main" :class="tone && `appshell__main--${tone}`" tabindex="-1">
      <div class="appshell__content">
        <RouterView />
      </div>
    </main>

    <PartnerToast :toasts="chat.toasts.value" @close="chat.closeToast" @open="onToastOpen" />
    <ChatDock :chat="chat" :me="meUid" />
  </div>
</template>

<style scoped>
.appshell {
  overflow-x: clip;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  /* A soft, grainy sky blue behind every page. */
  background-color: #8fb0d6;
  background-image: url("/bg-sky.jpg");
  background-size: 675px 1200px;
  background-attachment: fixed;
}
.appshell--home .top {
  zoom: 0.9;
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

.top__ctx {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  margin-left: auto;
  padding-left: 20px;
  border-left: 1px solid rgb(255 255 255 / 18%);
}
.top__ctx-text {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.4;
  color: #b3c4dc;
  white-space: nowrap;
}
.top__ctx-text strong {
  font-weight: 600;
  color: #fff;
}
.top__switch {
  padding: 4px 8px;
  background: #fff;
  border: 1px solid #c9d3e3;
  border-radius: 8px;
  font-family: inherit;
  font-size: 0.875rem;
  color: #16233b;
}

/* On a wide bar the pages are words only; icons come back in the folded menu. */
@media (min-width: 1100px) {
  .top__link :deep(svg) {
    display: none;
  }
}
/* A little less room: the baby's age drops out first. */
@media (max-width: 1499px) and (min-width: 1100px) {
  .top__ctx-text .top__ctx-age {
    display: none;
  }
}
@media (max-width: 1299px) and (min-width: 1100px) {
  .top__ctx {
    display: none;
  }
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
  .top__ctx {
    order: 2;
    margin-left: 0;
    padding: 12px 0 0;
    border-left: 0;
    border-top: 1px solid rgb(255 255 255 / 12%);
  }
  .top__ctx-text {
    white-space: normal;
  }
  .top__user {
    order: 3;
  }
}
</style>
