import { createRouter, createWebHistory } from "vue-router";
import Dashboard from "@/views/DashboardView.vue";
import StreamList from "../components/StreamList.vue";
import StreamDetails from "../components/StreamDetails.vue";

const routes = [
  {
    path: "/",
    name: "Dashboard",
    component: Dashboard,
  },
  {
    path: "/streams",
    name: "StreamList",
    component: StreamList,
  },
  {
    path: "/streams/:name",
    name: "StreamDetails",
    component: StreamDetails,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
