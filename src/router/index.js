import { createRouter, createWebHistory } from "vue-router";
import { useAuth, waitForAuthInitialization } from "@/composables/useAuth";
import { V3_ROUTES } from "@/v3/routes";
import { installV3Guard } from "@/v3/guard";
import V3AppShell from "@/v3/layouts/V3AppShell.vue";

const v3Page = (name) => () => import(`@/v3/pages/${name}/index.vue`);

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: V3_ROUTES.LANDING, name: "landing", component: v3Page("landing"), meta: { public: true } },
    { path: V3_ROUTES.JOURNEY, name: "journey", component: v3Page("journey"), meta: { public: true } },
    { path: V3_ROUTES.ROLE, name: "role", component: v3Page("role"), meta: { public: true } },
    { path: V3_ROUTES.ACCOUNT, name: "account", component: v3Page("account"), meta: { public: true } },
    { path: V3_ROUTES.SIGN_IN, name: "sign-in", component: v3Page("sign-in"), meta: { public: true } },
    { path: V3_ROUTES.HOUSEHOLD, name: "household", component: v3Page("household"), meta: { requiresAuth: true } },

    // Invitation links remain valid and open the current household flow.
    {
      path: "/join/:code?",
      name: "join",
      redirect: (to) => ({ path: V3_ROUTES.HOUSEHOLD, query: to.params.code ? { code: to.params.code } : {} }),
    },

    // The signed-in app shares the root with the public landing page and serves child paths.
    {
      path: V3_ROUTES.LANDING,
      component: V3AppShell,
      meta: { requiresAuth: true },
      children: [
        { path: "home", name: "home", component: v3Page("home") },
        { path: "care-log", name: "care-log", component: v3Page("care-log") },
        { path: "handover", name: "handover", component: v3Page("handover") },
        { path: "rota", name: "rota", component: v3Page("rota") },
        { path: "wellness", name: "wellness", component: v3Page("wellness") },
        { path: "support", name: "support", component: v3Page("support") },
        { path: "return-to-work", name: "return-to-work", component: v3Page("return-to-work") },
        { path: "calendar", name: "calendar", component: v3Page("calendar") },
        { path: "settings", name: "settings", component: v3Page("settings") },
        { path: "profile", name: "profile", component: v3Page("profile") },
      ],
    },

    // Preserve bookmarks while keeping the canonical URLs version-free.
    {
      path: "/v3/:pathMatch(.*)*",
      redirect: (to) => `/${Array.isArray(to.params.pathMatch) ? to.params.pathMatch.join("/") : to.params.pathMatch || ""}`,
    },

    { path: "/:pathMatch(.*)*", redirect: V3_ROUTES.LANDING },
  ],
});

// Install household-aware redirects before the general authentication check.
installV3Guard(router);

export function installAuthGuard() {
  router.beforeEach(async (to) => {
    const needsAuth = to.matched.some((r) => r.meta.requiresAuth);

    // Public pages must not be blocked while Firebase restores the auth session.
    // This is especially important when the auth service is slow or unavailable.
    if (!needsAuth) return true;

    await waitForAuthInitialization();
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated.value) return { path: V3_ROUTES.SIGN_IN };
  });
}

export default router;
