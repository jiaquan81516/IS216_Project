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
const push = usePush(() => meUid.value)
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
  <div class="appshell">
    <a class="appshell__skip" href="#app-main" @click="skipToMain">Skip to main content</a>

    <aside class="side" aria-label="Household and navigation">
      <div class="side__bar">
        <BrandLogo :to="ROUTES.HOME" />
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
        <div v-if="ready" class="side__chip">
          <p class="side__chip-names">{{ names }}</p>
          <p v-if="babyName" class="side__chip-baby">{{ babyName }}</p>
          
          <select v-if="showSwitcher" class="side__switch" :value="selectedBaby?.id" aria-label="Switch baby" @change="selectBaby($event.target.value)">
            <option v-for="(b, i) in babies" :key="b.id" :value="b.id">
              {{ b.babyName || `Baby ${i + 1}` }}
            </option>
          </select>
          <RouterLink class="side__add" :to="{ path: ROUTES.PROFILE, query: { addBaby: '1' } }" @click="menuOpen = false">Add a baby</RouterLink>
        </div>

        <nav aria-label="Main">
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
          <p class="side__note">Your care space is shared. Wellness check-ins stay private by default.</p>
          <div class="side__user">
            <UserMenu :name="userName" @sign-out="signOut" />
          </div>
        </div>
      </div>
    </aside>

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

.side__nav {
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
  background: var(--nt-gray);
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

/* Desktop: the sidebar becomes a horizontal top bar. */
@media (min-width: 992px) {
  .appshell {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }
  .appshell__main {
    padding: 32px clamp(24px, 6vw, 96px);
  }
  .side {
    z-index: 20;
    flex-direction: row;
    align-items: center;
    gap: 16px;
    height: auto;
    overflow: visible;
    padding: 10px 20px;
    border-right: 0;
    border-bottom: 1px solid var(--nt-line);
  }
  .side__bar { flex: none; padding: 0; }
  .side__panel {
    flex-direction: row;
    align-items: center;
    gap: 16px;
    flex: 1;
    min-width: 0;
  }
  .side__chip {
    flex: none;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 10px;
    padding: 6px 10px;
  }
  .side__chip-baby { margin: 0; }
  .side__switch { width: auto; margin-top: 0; }
  .side__add { margin-top: 0; }
  .side__panel nav {
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .side__panel nav::-webkit-scrollbar { display: none; }
  .side__nav { flex-direction: row; gap: 4px; }
  .side__link {
    padding: 8px 8px;
    gap: 6px;
    font-size: 0.8125rem;
    white-space: nowrap;
  }
  .side__foot {
    flex: none;
    flex-direction: row;
    align-items: center;
    margin: 0 0 0 auto;
  }
  .side__note { display: none; }
  .side__user { padding-top: 0; border-top: 0; }
}

/* Mobile and tablet: the Menu button and dropdown panel. */
/* Desktop: a two-row header. Row 1: logo, baby card, user. Row 2: navigation. */
@media (min-width: 992px) {
  .appshell {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }
  .appshell__main {
    padding: 32px clamp(24px, 6vw, 96px);
  }

  .side {
    z-index: 100;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    grid-template-areas:
      "logo . chip user"
      "nav  nav nav  nav";
    align-items: center;
    gap: 12px 24px;
    height: auto;
    overflow: visible;
    padding: 14px clamp(24px, 6vw, 96px) 0;
    border-right: 0;
    border-bottom: 1px solid var(--nt-line);
  }
  .side__panel { display: contents; }

  .side__bar { grid-area: logo; padding: 0; }

  .side__chip {
    grid-area: chip;
    justify-self: end;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 16px;
    padding: 8px 16px;
    border-radius: 999px;
  }
  .side__chip-baby { margin: 0; }
  .side__switch { width: auto; margin: 0; padding: 4px 8px; }
  .side__add { margin: 0; }

  .side__foot {
    grid-area: user;
    justify-self: end;
    margin: 0 0 0 4px;
  }
  
  .side__note { display: none; }
  .side__user { padding: 0; border-top: 0; }

  .side nav {
    grid-area: nav;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    border-top: 1px solid var(--nt-line);
  }
  .side nav::-webkit-scrollbar { display: none; }
  .side__nav { flex-direction: row; gap: 8px; }
  .side__link {
    gap: 8px;
    padding: 12px 14px;
    border-radius: 0;
    border-bottom: 2px solid transparent;
    font-size: 0.9375rem;
    white-space: nowrap;
  }
  .side__link:hover { background: transparent; color: var(--nt-ink); }
  .side__link--active,
  .side__link--active:hover {
    background: transparent;
    border-bottom-color: var(--nt-plum);
    color: var(--nt-plum);
  }
}
</style>
