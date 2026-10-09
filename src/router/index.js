import { createRouter, createWebHistory } from "vue-router";
import { useAuth, waitForAuthInitialization } from "@/composables/useAuth";
import { ROUTES } from "@/shared/constants/routes";
import AppShell from "@/layouts/AppShell.vue";
import AuthShell from "@/layouts/AuthShell.vue";
import { V3_ROUTES } from "@/v3/routes";
import { installV3Guard } from "@/v3/guard";
import V3AppShell from "@/v3/layouts/V3AppShell.vue";

const page = (name) => () => import(`@/pages/${name}/index.vue`);
const v3Page = (name) => () => import(`@/v3/pages/${name}/index.vue`);

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: ROUTES.LANDING, name: "landing", component: page("landing"), meta: { public: true } },

    // Public auth pages
    {
      path: "/_auth",
      redirect: ROUTES.LANDING,
      component: AuthShell,
      meta: { public: true },
      children: [
        { path: ROUTES.SIGN_UP, name: "sign-up", component: page("sign-up"), meta: { public: true, authHeader: "signup" } },
        { path: ROUTES.SIGN_IN, name: "sign-in", component: page("sign-in"), meta: { public: true, authHeader: "signin" } },
        { path: ROUTES.GOOGLE, name: "google-handoff", component: page("google-handoff"), meta: { public: true, authHeader: "google" } },
        { path: ROUTES.JOIN, name: "join", component: page("join"), meta: { public: true, authHeader: "invite" } },
      ],
    },

    // Setup (signed in, before the household is ready)
    {
      path: "/_setup",
      redirect: ROUTES.LANDING,
      component: AuthShell,
      meta: { requiresAuth: true },
      children: [
        { path: ROUTES.SETUP_ABOUT, name: "setup-about", component: page("setup-about"), meta: { requiresAuth: true, authHeader: "user" } },
        { path: ROUTES.SETUP_BABY, name: "setup-baby", component: page("setup-baby"), meta: { requiresAuth: true, authHeader: "user" } },
        { path: ROUTES.SETUP_PARTNER, name: "setup-partner", component: page("setup-partner"), meta: { requiresAuth: true, authHeader: "user" } },
        { path: ROUTES.SETUP_NIGHTS, name: "setup-nights", component: page("setup-nights"), meta: { requiresAuth: true, authHeader: "user" } },
      ],
    },

    // The app
    {
      path: "/_app",
      redirect: ROUTES.LANDING,
      component: AppShell,
      meta: { requiresAuth: true },
      children: [
        { path: ROUTES.HOME, name: "home", component: page("home") },
        { path: ROUTES.CARE_LOG, name: "care-log", component: page("care-log") },
        { path: ROUTES.ADD_ENTRY, name: "add-entry", component: page("add-entry") },
        { path: ROUTES.HANDOVER, name: "handover", component: page("handover") },
        { path: ROUTES.HANDOVER_RECEIVED, name: "handover-received", component: page("handover-received") },
        { path: ROUTES.ROTA, name: "rota", component: page("rota") },
        { path: ROUTES.CALENDAR, name: "calendar", component: page("calendar") },
        { path: ROUTES.CHECK_IN, name: "check-in", component: page("check-in") },
        { path: ROUTES.HELP, name: "help", component: page("help") },
        { path: ROUTES.HELP_READING, name: "help-reading", component: page("help-reading") },
        { path: ROUTES.GUIDE, name: "guide", component: page("guide") },
        { path: ROUTES.RETURN_TO_WORK, name: "return-to-work", component: page("return-to-work") },
        { path: ROUTES.PUMPING, name: "pumping-rooms", component: page("pumping-rooms") },
        { path: ROUTES.PUMPING_NEW, name: "pumping-room-new", component: page("pumping-room-new") },
        { path: ROUTES.PUMPING_DETAIL, name: "pumping-room-detail", component: page("pumping-room-detail") },
      ],
    },

    // Prototype V3
    { path: V3_ROUTES.LANDING, name: "v3-landing", component: v3Page("landing"), meta: { public: true } },
    { path: V3_ROUTES.JOURNEY, name: "v3-journey", component: v3Page("journey"), meta: { public: true } },
    { path: V3_ROUTES.ROLE, name: "v3-role", component: v3Page("role"), meta: { public: true } },
    { path: V3_ROUTES.ACCOUNT, name: "v3-account", component: v3Page("account"), meta: { public: true } },
    { path: V3_ROUTES.SIGN_IN, name: "v3-sign-in", component: v3Page("sign-in"), meta: { public: true } },
    { path: V3_ROUTES.HOUSEHOLD, name: "v3-household", component: v3Page("household"), meta: { requiresAuth: true } },
    // V3 app layout. It shares the "/v3" path with the landing route above; landing is
    // registered first so it keeps the exact match, and the shell only serves its children.
    {
      path: V3_ROUTES.LANDING,
      component: V3AppShell,
      meta: { requiresAuth: true },
      children: [
        { path: "home", name: "v3-home", component: v3Page("home") },
        { path: "care-log", name: "v3-care-log", component: v3Page("care-log") },
        { path: "rota", name: "v3-rota", component: v3Page("rota") },
        { path: "wellness", name: "v3-wellness", component: v3Page("wellness") },
        { path: "support", name: "v3-support", component: v3Page("support") },
        { path: "return-to-work", name: "v3-return-to-work", component: v3Page("return-to-work") },
        { path: "calendar", name: "v3-calendar", component: v3Page("calendar") },
      ],
    },

    { path: "/:pathMatch(.*)*", redirect: ROUTES.LANDING },
  ],
});

// V3 guard is registered first so its redirects win over the V2 guard for V3 routes.
installV3Guard(router);

export function installAuthGuard() {
  router.beforeEach(async (to) => {
    const needsAuth = to.matched.some((r) => r.meta.requiresAuth);

    // Public pages must not be blocked while Firebase restores the auth session.
    // This is especially important when the auth service is slow or unavailable.
    if (!needsAuth) return true;

    await waitForAuthInitialization();
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated.value) return { name: "sign-in" };
  });
}

export default router;
