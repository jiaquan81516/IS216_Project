import { createApp } from "vue";
import { createPinia } from "pinia";

import App from "./App.vue";
import router, { installAuthGuard } from "./router";
import { useAuthStore } from "./stores/authStore";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "./assets/styles/main.css";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
useAuthStore(pinia).initializeAuthListener();
installAuthGuard(pinia);
app.use(router);

app.mount("#app");
