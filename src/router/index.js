import { createRouter, createWebHistory } from "vue-router";
import { useAuth, waitForAuthInitialization } from "@/composables/useAuth";
import { ROUTES } from "@/shared/constants/routes";

const LoginPage = () => import("@/pages/login/index.vue");
const DashboardPage = () => import("@/pages/dashboard/index.vue");

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: ROUTES.LOGIN, name: "login", component: LoginPage },
    {
      path: ROUTES.DASHBOARD,
      name: "dashboard",
      component: DashboardPage,
      meta: { requiresAuth: true },
    },
  ],
});

export function installAuthGuard() {
  router.beforeEach(async (to) => {
    await waitForAuthInitialization();
    const { isAuthenticated } = useAuth();

    if (to.meta.requiresAuth && !isAuthenticated.value) {
      return { name: "login" };
    }

    if (to.name === "login" && isAuthenticated.value) {
      return { name: "dashboard" };
    }
  });
}

export default router;
