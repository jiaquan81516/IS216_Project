<script setup>
import { useAuth } from "@/composables/useAuth";

defineOptions({ name: "DashboardPage" });

const { currentUser } = useAuth();
</script>

<template>
  <div class="page">
    <h2>Dashboard</h2>
    <p>Welcome, {{ currentUser?.displayName || currentUser?.email }}.</p>
  </div>
</template>
