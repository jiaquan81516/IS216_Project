import { createRouter, createWebHistory } from "vue-router";
import { useAuth, waitForAuthInitialization } from "@/composables/useAuth";
import { ROUTES } from "@/app/routes";
import { installGuard } from "@/app/guard";
import AppShell from "@/app/layouts/AppShell.vue";

const appPage = (name) => () => import(`@/app/pages/${name}/index.vue`);

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: ROUTES.LANDING, name: "landing", component: appPage("landing"), meta: { public: true } },
    { path: ROUTES.JOURNEY, name: "journey", component: appPage("journey"), meta: { public: true } },
    { path: ROUTES.ROLE, name: "role", component: appPage("role"), meta: { public: true } },
    { path: ROUTES.ACCOUNT, name: "account", component: appPage("account"), meta: { public: true } },
    { path: ROUTES.SIGN_IN, name: "sign-in", component: appPage("sign-in"), meta: { public: true } },
    { path: ROUTES.HOUSEHOLD, name: "household", component: appPage("household"), meta: { requiresAuth: true } },

    // Invitation links remain valid and open the current household flow.
    {
      path: "/join/:code?",
      name: "join",
      redirect: (to) => ({ path: ROUTES.HOUSEHOLD, query: to.params.code ? { code: to.params.code } : {} }),
    },

    // The signed-in app shares the root with the public landing page and serves child paths.
    {
      path: ROUTES.LANDING,
      component: AppShell,
      meta: { requiresAuth: true },
      children: [
        { path: "home", name: "home", component: appPage("home") },
        { path: "care-log", name: "care-log", component: appPage("care-log") },
        { path: "checklist", name: "checklist", component: appPage("checklist") },
        { path: "rota", name: "rota", component: appPage("rota") },
        { path: "wellness", name: "wellness", component: appPage("wellness") },
        { path: "support", name: "support", component: appPage("support") },
        { path: "support/rooms", name: "pumping-rooms", component: appPage("pumping-rooms") },
        { path: "support/kids-care", name: "kids-care", component: appPage("kids-care") },
        { path: "return-to-work", name: "return-to-work", component: appPage("return-to-work") },
        { path: "calendar", name: "calendar", component: appPage("calendar") },
        { path: "settings", name: "settings", component: appPage("settings") },
        { path: "profile", name: "profile", component: appPage("profile") },
        { path: "users", name: "users", component: appPage("users")}
      ],
    },

    { path: "/:pathMatch(.*)*", redirect: ROUTES.LANDING },
  ],
});

// Install household-aware redirects before the general authentication check.
installGuard(router);

export function installAuthGuard() {
  router.beforeEach(async (to) => {
    const needsAuth = to.matched.some((r) => r.meta.requiresAuth);

    // Public pages must not be blocked while Firebase restores the auth session.
    // This is especially important when the auth service is slow or unavailable.
    if (!needsAuth) return true;

    await waitForAuthInitialization();
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated.value) return { path: ROUTES.SIGN_IN };
  });
}

export default router;
