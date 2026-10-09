<script setup>
import "@/v3/v3.css";
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import BrandLogo from "@/components/ui/BrandLogo.vue";
import { useAuth } from "@/composables/useAuth";
import V3Avatar from "@/v3/components/V3Avatar.vue";
import V3Icon from "@/v3/components/V3Icon.vue";
import { displayName, useV3Home, V3_HOME_KEY } from "@/v3/composables/useV3Home";
import { useV3Entries, V3_ENTRIES_KEY } from "@/v3/composables/useV3Entries";
import { V3_NAV } from "@/v3/data/nav";
import { V3_ROUTES } from "@/v3/routes";

defineOptions({ name: "V3AppShell" });

const route = useRoute();
const router = useRouter();
const { logout } = useAuth();

// Load the household once here; the sidebar and the page share it.
const home = useV3Home();
provide(V3_HOME_KEY, home);
// One live entries listener, shared by Home and the care log. It waits for the household id.
provide(V3_ENTRIES_KEY, useV3Entries(home.householdId));

const menuOpen = ref(false);
const menuButton = ref(null);

const ready = computed(() => !home.loading.value && !home.error.value);
const names = computed(() => {
  const mine = displayName(home.me.value.firstName);
  return home.partner.value ? `${mine} & ${displayName(home.partner.value.firstName)}` : mine;
});
const babyName = computed(() => (home.baby.value.name ? `Baby ${home.baby.value.name}` : ""));
const babyAge = computed(() => home.baby.value.line || "");
const userName = computed(() => displayName(home.me.value.displayName || home.me.value.firstName));
const items = computed(() => V3_NAV.map((item) => ({ ...item, active: item.to === route.path })));

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
  document.getElementById("v3-main")?.focus();
}
async function signOut() {
  await logout();
  router.push(V3_ROUTES.LANDING);
}

watch(() => route.fullPath, () => closeMenu());
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="v3shell">
    <a class="v3shell__skip" href="#v3-main" @click="skipToMain">Skip to main content</a>

    <aside class="side" aria-label="Household and navigation">
      <div class="side__bar">
        <BrandLogo :to="V3_ROUTES.HOME" />
        <button
          ref="menuButton"
          type="button"
          class="side__menu"
          :aria-expanded="menuOpen ? 'true' : 'false'"
          aria-controls="v3-side-panel"
          @click="toggleMenu"
        >
          <V3Icon :name="menuOpen ? 'close' : 'menu'" />
          <span>Menu</span>
        </button>
      </div>

      <div id="v3-side-panel" class="side__panel" :class="{ 'side__panel--open': menuOpen }">
        <div v-if="ready" class="side__chip">
          <p class="side__chip-names">{{ names }}</p>
          <p v-if="babyName" class="side__chip-baby">{{ babyName }}</p>
          <p v-if="babyAge" class="side__chip-age">{{ babyAge }}</p>
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
                <V3Icon :name="item.icon" />
                <span>{{ item.label }}</span>
              </RouterLink>
            </li>
          </ul>
        </nav>

        <div class="side__foot">
          <p class="side__note">Your care space is shared. Wellness check-ins stay private by default.</p>
          <div class="side__user">
            <V3Avatar :name="userName" tone="apricot" :size="36" />
            <div class="side__user-text">
              <p class="side__user-name">{{ userName }}</p>
              <button type="button" class="side__signout" @click="signOut">Sign out</button>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <main id="v3-main" class="v3shell__main" tabindex="-1">
      <div class="v3shell__content">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<style scoped>
.v3shell {
  display: grid;
  grid-template-columns: 264px minmax(0, 1fr);
  min-height: 100vh;
  background: var(--nt-bg);
}
.v3shell__skip {
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
.v3shell__skip:focus {
  transform: none;
}
.v3shell__main {
  min-width: 0;
  padding: 32px;
}
.v3shell__main:focus {
  outline: none;
}
.v3shell__content {
  width: 100%;
  max-width: 1120px;
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
.side__user-text {
  min-width: 0;
}
.side__user-name {
  margin: 0;
  overflow: hidden;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--nt-ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.side__signout {
  padding: 0;
  background: none;
  border: 0;
  font-family: inherit;
  font-size: 0.875rem;
  line-height: 1.3;
  color: var(--nt-muted);
  text-decoration: none;
  cursor: pointer;
}
.side__signout:hover {
  color: var(--nt-plum);
  text-decoration: underline;
  text-underline-offset: 3px;
}

@media (max-width: 991px) {
  .v3shell {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }
  .v3shell__main {
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
