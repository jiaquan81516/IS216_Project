<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import AppButton from "@/components/common/AppButton.vue";
import AppCard from "@/components/common/AppCard.vue";
import { useAuth } from "@/composables/useAuth";

defineOptions({ name: "LoginPage" });

const router = useRouter();
const { loading, signInWithGoogle } = useAuth();
const errorMessage = ref("");

async function handleGoogleSignIn() {
  errorMessage.value = "";

  try {
    await signInWithGoogle();
    await router.push({ name: "dashboard" });
  } catch {
    errorMessage.value = "Unable to sign in with Google. Please try again.";
  }
}
</script>

<template>
  <div class="login-page">
    <AppCard class="login-card">
      <h2>Welcome</h2>
      <p>Sign in to continue to your care dashboard.</p>
      <AppButton :disabled="loading" @click="handleGoogleSignIn">
        {{ loading ? "Signing in..." : "Continue with Google" }}
      </AppButton>
      <p v-if="errorMessage" class="login-error" role="alert">
        {{ errorMessage }}
      </p>
    </AppCard>
  </div>
</template>

<style scoped>
.login-page {
  display: grid;
  min-height: calc(100vh - 8rem);
  place-items: center;
}

.login-card {
  width: min(28rem, 100%);
  text-align: center;
}

.login-error {
  color: #a52834;
}
</style>
