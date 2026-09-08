<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import AppButton from "@/components/common/AppButton.vue";
import AppCard from "@/components/common/AppCard.vue";
import { useAuth } from "@/composables/useAuth";

defineOptions({ name: "DashboardPage" });

const router = useRouter();
const { currentUser, loading, logout } = useAuth();
const errorMessage = ref("");

async function handleLogout() {
  errorMessage.value = "";

  try {
    await logout();
    await router.replace({ name: "login" });
  } catch {
    errorMessage.value = "Unable to sign out. Please try again.";
  }
}
</script>

<template>
  <div class="page auth-dashboard">
    <AppCard class="profile-card">
      <img
        v-if="currentUser?.photoURL"
        class="profile-photo"
        :src="currentUser.photoURL"
        :alt="`${currentUser.displayName || 'User'} profile photo`"
        referrerpolicy="no-referrer"
      />
      <div>
        <h2>Dashboard</h2>
        <p>
          <strong>Name:</strong>
          {{ currentUser?.displayName || "Not provided" }}
        </p>
        <p>
          <strong>Email:</strong> {{ currentUser?.email || "Not provided" }}
        </p>
      </div>
      <AppButton :disabled="loading" @click="handleLogout">
        {{ loading ? "Signing out..." : "Logout" }}
      </AppButton>
      <p v-if="errorMessage" class="auth-error" role="alert">
        {{ errorMessage }}
      </p>
    </AppCard>
  </div>
</template>

<style scoped>
.auth-dashboard {
  max-width: 36rem;
}

.profile-card {
  display: grid;
  gap: 1rem;
}

.profile-photo {
  width: 5rem;
  height: 5rem;
  border-radius: 50%;
  object-fit: cover;
}

.auth-error {
  margin: 0;
  color: #a52834;
}
</style>
