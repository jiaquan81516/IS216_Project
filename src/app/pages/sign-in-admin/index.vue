<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import Field from "@/app/components/Field.vue";
import { ROUTES } from "@/app/routes";
import { useAuth } from "@/composables/useAuth";
import { signInWithEmail, describeAuthError } from "@/api/emailAuth";
import { hasAdminClaim } from "@/api/adminAccess";
import { logoutUser } from "@/api/authApi";
import "@/app/app.css";

defineOptions({ name: "AdminSignInPage" });

// A plain sign in for administrators only. It is not linked from anywhere: the address is
// shared by hand. Anyone without the admin claim is signed straight back out.
const router = useRouter();

// Keep search engines away from this page while it is open.
let robots = null;
onMounted(() => {
  robots = document.createElement("meta");
  robots.name = "robots";
  robots.content = "noindex, nofollow";
  document.head.appendChild(robots);
});
onBeforeUnmount(() => robots?.remove());
const { currentUser } = useAuth();

const email = ref("");
const password = ref("");
const errors = reactive({ email: "", password: "" });
const error = ref("");
const busy = ref(false);

function validate() {
  errors.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()) ? "" : "Enter a valid email address.";
  errors.password = password.value ? "" : "Enter your password.";
  return !errors.email && !errors.password;
}

// The router guard reads currentUser, which Firebase updates a moment after sign in.
async function waitForUser(uid, timeoutMs = 3000) {
  const started = Date.now();
  while (currentUser.value?.uid !== uid && Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function submit() {
  if (busy.value) return;
  error.value = "";
  if (!validate()) return;
  busy.value = true;
  try {
    const user = await signInWithEmail({ email: email.value, password: password.value });
    if (!(await hasAdminClaim(user))) {
      await logoutUser();
      error.value = "This account is not an administrator.";
      return;
    }
    await waitForUser(user.uid);
    router.push(ROUTES.ADMIN);
  } catch (cause) {
    console.error("[app admin sign in]", cause?.code, cause);
    error.value = describeAuthError(cause);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="adm-in">
    <form class="adm-in__card app-stack app-stack--24" novalidate :aria-busy="busy" @submit.prevent="submit">
      <h1 class="adm-in__h1">NurtureTrack Admin</h1>
      <Field
        id="app-admin-email"
        v-model="email"
        type="email"
        label="Email"
        autocomplete="username"
        :error="errors.email"
        :disabled="busy"
      />
      <Field
        id="app-admin-password"
        v-model="password"
        type="password"
        label="Password"
        autocomplete="current-password"
        :error="errors.password"
        :disabled="busy"
      />
      <div v-if="error" class="alert alert-danger app-alert" role="alert">{{ error }}</div>
      <button type="submit" class="app-btn app-btn--primary app-btn--block" :disabled="busy">
        {{ busy ? "Signing in..." : "Sign in" }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.adm-in { display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; padding: clamp(48px, 14vh, 160px) 16px 64px; background: var(--nt-gray); box-sizing: border-box; }
.adm-in__card { width: 400px; max-width: 100%; box-sizing: border-box; padding: 32px; background: #fff; border: 1px solid var(--nt-line); border-radius: 12px; }
.adm-in__h1 { margin: 0; font-family: var(--nt-serif); font-weight: 400; font-size: 1.75rem; line-height: 1.3; color: var(--nt-ink); }
@media (max-width: 575px) { .adm-in__card { padding: 24px 20px; } }
</style>
