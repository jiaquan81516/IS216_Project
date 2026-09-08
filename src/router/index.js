import { createRouter, createWebHistory } from "vue-router";
import { ROUTES } from "@/shared/constants/routes";

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
    { path: ROUTES.DASHBOARD, name: "dashboard", component: DashboardPage },
    { path: ROUTES.FEEDING, name: "feeding", component: FeedingPage },
    { path: ROUTES.CALENDAR, name: "calendar", component: CalendarPage },
    { path: ROUTES.INSIGHTS, name: "insights", component: InsightsPage },
    { path: ROUTES.WELLNESS, name: "wellness", component: WellnessPage },
    { path: ROUTES.RESOURCES, name: "resources", component: ResourcesPage },
    {
      path: `${ROUTES.RESOURCES}/:id`,
      name: "resource-detail",
      component: ResourceDetailPage,
      props: true,
    },
    {
      path: ROUTES.SHARED_CARE,
      name: "shared-care",
      component: SharedCarePage,
    },
  ],
});

export default router;
