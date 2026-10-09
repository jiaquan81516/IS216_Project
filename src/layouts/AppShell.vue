<script setup>
import { computed } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import BrandLogo from "@/components/ui/BrandLogo.vue";
import AvatarDot from "@/components/ui/AvatarDot.vue";
import { useAuth } from "@/composables/useAuth";
import { ROUTES } from "@/shared/constants/routes";

const route = useRoute();
const router = useRouter();
const { logout, currentUser } = useAuth();

const NAV = [
  { label: "Home", to: ROUTES.HOME, match: ["/home"] },
  { label: "Care log", to: ROUTES.CARE_LOG, match: ["/care-log", "/handover"] },
  { label: "Sleep rotation", to: ROUTES.ROTA, match: ["/rota"] },
  { label: "Calendar", to: ROUTES.CALENDAR, match: ["/calendar"] },
  { label: "Resources", to: ROUTES.HELP, match: ["/help", "/pumping-rooms", "/return-to-work"] },
];
const isActive = (item) => item.match.some((p) => route.path === p || route.path.startsWith(`${p}/`));
const items = computed(() => NAV.map((n) => ({ ...n, active: isActive(n) })));

async function signOut() {
  await logout();
  router.push(ROUTES.LANDING);
}
</script>

<template>
  <div class="shell">
    <header class="shell__bar">
      <div class="nt-container shell__bar-inner">
        <BrandLogo />
        <nav class="shell__nav" aria-label="Primary">
          <RouterLink
            v-for="item in items"
            :key="item.to"
            :to="item.to"
            class="shell__link"
            :class="{ 'shell__link--active': item.active }"
            :aria-current="item.active ? 'page' : undefined"
          >{{ item.label }}</RouterLink>
        </nav>
        <div class="dropdown">
          <button class="shell__avatars" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Account menu">
            <AvatarDot who="D" :size="32" />
            <AvatarDot who="M" :size="32" />
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li class="dropdown-header">{{ currentUser?.displayName || currentUser?.email || "Daniel and Mei" }}</li>
            <li><RouterLink class="dropdown-item" :to="ROUTES.CHECK_IN">Check-in (private)</RouterLink></li>
            <li><hr class="dropdown-divider" /></li>
            <li><button class="dropdown-item" type="button" @click="signOut">Sign out</button></li>
          </ul>
        </div>
      </div>
    </header>
    <main class="nt-container nt-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.shell__bar { border-bottom: 1px solid var(--nt-line); background: var(--nt-bg); }
.shell__bar-inner { display: flex; align-items: center; justify-content: space-between; gap: 24px; min-height: 65px; }
.shell__nav { display: flex; flex-wrap: wrap; gap: 8px 32px; }
.shell__link { font-size: 0.875rem; color: var(--nt-muted); text-decoration: none; }
.shell__link:hover { color: var(--nt-ink); }
.shell__link--active { color: var(--nt-ink); font-weight: 500; text-decoration: underline; text-underline-offset: 6px; }
.shell__avatars { display: flex; margin: 0; padding: 0; background: none; border: 0; cursor: pointer; }
.shell__avatars > :last-child { margin-left: -6px; }
@media (max-width: 767px) {
  .shell__bar-inner { flex-wrap: wrap; padding-block: 12px; }
  .shell__nav { order: 3; width: 100%; overflow-x: auto; flex-wrap: nowrap; gap: 24px; }
  .shell__link { white-space: nowrap; }
}
</style>
