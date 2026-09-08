import { createRouter, createWebHistory } from "vue-router";
import { ROUTES } from "@/shared/constants/routes";
import { useAuthStore } from "@/stores/authStore";

const LoginPage = () => import("@/pages/login/index.vue");
const DashboardPage = () => import("@/pages/dashboard/index.vue");
const FeedingPage = () => import("@/pages/feeding/index.vue");
const CalendarPage = () => import("@/pages/calendar/index.vue");
const InsightsPage = () => import("@/pages/insights/index.vue");
const WellnessPage = () => import("@/pages/wellness/index.vue");
const ResourcesPage = () => import("@/pages/resources/index.vue");
const ResourceDetailPage = () => import("@/pages/resources/ResourceDetail.vue");
const SharedCarePage = () => import("@/pages/sharedCare/index.vue");

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
    {
      path: ROUTES.FEEDING,
      name: "feeding",
      component: FeedingPage,
      meta: { requiresAuth: true },
    },
    {
      path: ROUTES.CALENDAR,
      name: "calendar",
      component: CalendarPage,
      meta: { requiresAuth: true },
    },
    {
      path: ROUTES.INSIGHTS,
      name: "insights",
      component: InsightsPage,
      meta: { requiresAuth: true },
    },
    {
      path: ROUTES.WELLNESS,
      name: "wellness",
      component: WellnessPage,
      meta: { requiresAuth: true },
    },
    {
      path: ROUTES.RESOURCES,
      name: "resources",
      component: ResourcesPage,
      meta: { requiresAuth: true },
    },
    {
      path: `${ROUTES.RESOURCES}/:id`,
      name: "resource-detail",
      component: ResourceDetailPage,
      props: true,
      meta: { requiresAuth: true },
    },
    {
      path: ROUTES.SHARED_CARE,
      name: "shared-care",
      component: SharedCarePage,
      meta: { requiresAuth: true },
    },
  ],
});

export function installAuthGuard(pinia) {
  router.beforeEach(async (to) => {
    const authStore = useAuthStore(pinia);
    await authStore.waitForAuthInitialization();

    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
      return { name: "login" };
    }

    if (to.name === "login" && authStore.isAuthenticated) {
      return { name: "dashboard" };
    }
  });
}

export default router;
